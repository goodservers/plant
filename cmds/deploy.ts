import chalk from 'chalk'
import fs from 'fs-extra'
import { Remote, Repository } from 'nodegit'
import R from 'ramda'
import { getExternalSources, loadDockerCompose } from '../libs/docker'
import * as filesystem from '../libs/filesystem'
import * as git from '../libs/git'
import * as github from '../libs/github'
import * as gitlab from '../libs/gitlab'
import { Status } from '../libs/gitlab.types'
import { getRandomDBName, getRandomPassword } from '../libs/helpers'
import { connect, commands } from '../libs/ssh'
import { loadAvailableTemplates } from '../loaders'
import { confirm, repositoryName, selectGitlabProject } from '../prompts/create'
import * as gitlabPrompt from '../prompts/gitlab'
import { selectTemplate } from '../prompts/templates'
import { CURRENT_USER, GITLAB_DOMAIN, handleError, spinner, TMP_DIRECTORY } from '../util'
import * as server from './server'


const sql = {
  createDb: ({ DB_NAME }: server.TemplateVariables) => () => `CREATE DATABASE ${DB_NAME};`,
  grant: ({ DB_USERNAME, DB_PASSWORD, DB_DATABASE = '*', DB_TABLE = '*' }: server.TemplateVariables) => () =>
    `GRANT ALL PRIVILEGES ON ${DB_DATABASE}.${DB_TABLE} TO '${DB_USERNAME}'@'%' IDENTIFIED BY '${DB_PASSWORD}';`,
}

export const init = async () => {
  try {
    const isGit = await git.isGitRepository('.')

    const repository = isGit ? await Repository.open('.') : await Repository.init(`.`, 0)
    if (!(await gitlab.hasGitlabRemote(repository))) {
      const project = await repositoryName()
      const newRepo = await gitlab.createRepository(project.name, {
        container_registry_enabled: true,
      })

      spinner.start('Creating gitlab repository...')

      // create git remote
      await Remote.create(repository, 'deploy', newRepo.ssh_url_to_repo)

      if (newRepo.http_url_to_repo) {
        spinner.stop()
        spinner.succeed(`New repository ${chalk.bold(newRepo.name_with_namespace)} is created. 🎉`)
      }
    }

    const oid = await git.addStatusFilesToCommit(repository)

    if (await git.isNewRepository(repository)) {
      git.commit(repository, oid, 'Init 🌱')
    }
    // else {
    //   const commitChanges = await confirm('Do you want to commit your unstaged changes? (required)')
    //   if (commitChanges.confirm) {
    //     git.commit(repository, oid, )
    //   }
    // }

    const { template } = await selectTemplate((template) => template.isDatabase === false)
    await R.pipeP(
      github.getTemplateFiles,
      github.downloadTemplateFiles(TMP_DIRECTORY),
    )(template.path)

    const { server: selectedServer } = await server.listOrCreate()
    const gitlabRemotes = await gitlab.getRemotes(repository)

    // TODO: filter remotes with my username only
    const remoteName =
      gitlabRemotes.length > 1
        ? (await gitlabPrompt.selectRightGitlabRemote(
            gitlabRemotes.map((remote: Remote) => ({ name: remote.name() + ' ' + remote.url(), value: remote.name() })),
          )).name
        : gitlabRemotes[0].name()

    const remote = await git.getGitRemote(repository, remoteName)
    const projectSlug = git.getProjectSlug(remote.url())
    const projects = await gitlab.getProjects(projectSlug)

    const gitlabProject = projects.length > 1 ? (await selectGitlabProject(projects)).project : projects[0]

    const variablesContext = {
      currentUser: CURRENT_USER,
      projectName: projectSlug,
    }

    // TODO: Get variables from .env?
    const variables = await gitlab.fillVariables(remote.url(), gitlabProject.id, selectedServer.id, template, variablesContext)

    const composeFileContent = await fs.readFile(`${TMP_DIRECTORY}/${template.path}/docker-compose.yml`, 'utf8')
    const compose = loadDockerCompose(composeFileContent)
    const externalDependencies = getExternalSources(compose)

    const matchDependenciesInTemplates = R.intersection
    const allTemplates = (await loadAvailableTemplates((template) => template.isDatabase === true)).map(
      (template) => template.name,
    )
    const matchedTemplates = matchDependenciesInTemplates(allTemplates, externalDependencies)

    if (
      !R.isEmpty(matchedTemplates) &&
      (await confirm(`Do you want to initiate also some database? Seems like you need: ${matchedTemplates.join(',')}`))
        .confirm
    ) {
      const database = await server.initDatabase(selectedServer.id)

      const ssh = await connect(
        variables.DEPLOYMENT_SERVER_IP,
        variables.DEPLOY_SERVER_PRIVATE_KEY,
      )

      // check db and setup users
      const container = await ssh.execCommand(`docker ps -q --filter "name=${database.name}"`, { cwd: '/' })

      // console.log('database', database)

      let dbAccess: server.TemplateVariables = {
        DB_HOSTNAME: database.name,
        ROOT_DB_USERNAME: database.variables.DB_USERNAME,
        ROOT_DB_PASSWORD: database.variables.DB_PASSWORD,
        DB_NAME: getRandomDBName(),
        DB_USERNAME: getRandomDBName(),
        DB_PASSWORD: getRandomPassword(),
      }

      if (!R.isEmpty(container.stdout)) {
        const createDb = (props: server.TemplateVariables) =>
          R.compose(
            commands.docker.exec({ PROJECT_NAME: props.DB_HOSTNAME }),
            commands.cli.mysql({ DB_USER: 'root', DB_PASSWORD: props.ROOT_DB_PASSWORD }),
            sql.createDb({ DB_NAME: props.DB_NAME }),
          )()

        dbAccess = await ssh.runCommandUntilSucceed(createDb, { ...dbAccess, PROJECT_NAME: dbAccess.DB_HOSTNAME })

        const grantDbPermission = (props: server.TemplateVariables) =>
          R.compose(
            commands.docker.exec({ PROJECT_NAME: props.DB_HOSTNAME }),
            commands.cli.mysql({ DB_USER: 'root', DB_PASSWORD: props.ROOT_DB_PASSWORD }),
            sql.grant({ DB_USERNAME: props.DB_USERNAME, DB_PASSWORD: props.DB_PASSWORD, DB_DATABASE: props.DB_NAME }),
          )()

        dbAccess = await ssh.runCommandUntilSucceed(grantDbPermission, { ...dbAccess })
      }

      console.log(chalk.green(`${database.name} credentials`))
      console.log(chalk.green(`===============================`))
      console.log(chalk.green(`hostname: ${dbAccess.DB_HOSTNAME}`))
      console.log(chalk.green(`database: ${dbAccess.DB_NAME}`))
      console.log(chalk.green(`login: ${dbAccess.DB_USERNAME}`))
      console.log(chalk.green(`password: ${dbAccess.DB_PASSWORD}`))
      console.log(chalk.green(`===============================`))

      // TODO: save DB variables
      await gitlab.saveOrUpdateVariables(gitlabProject.id, dbAccess)
    }

    // Copy and remove
    const filesToCommit = await filesystem.copyFilesFromDirectoryToCurrent(`${TMP_DIRECTORY}/${template.path}`)
    await filesystem.removeFolder(TMP_DIRECTORY)

    // Commit and wait for pipeline
    const commitChanges = await confirm('Do you want to commit and push your changes to deploy?')
    if (commitChanges.confirm) {
      const relativeFilesToCommit = filesToCommit.map((filePath) => filePath.replace(process.cwd() + '/', ''))

      const hasSSHKey = await gitlab.hasUserSomeSSHKeys(CURRENT_USER)
      if (!hasSSHKey) {
        spinner.warn(
          `Plase upload your public ssh key into you Gitlab repository. Visit https://${GITLAB_DOMAIN}/profile/keys.`,
        )
        // TODO: Prompt generate new ssh keys for Gitlab
      }

      const oid = await git.addFilesToCommit(repository, relativeFilesToCommit)
      await git.commit(repository, oid, 'Deploy with 🌱 plant 🎉')
      await git.push(remote)

      spinner.start(`Waiting until pipeline will be finished (takes around 2-5 minutes)`)

      const pipelineResult = await gitlab.waitUntilFinishedPipeline(repository, gitlabProject.id, (status: Status) => {
        spinner.start(
          `Pipeline for deployment has been started, you can check pipeline status on web: ${
            CURRENT_USER.web_url
          }/${projectSlug}/-/jobs/${status.id}`,
        )
      })
      spinner.stop()
      !pipelineResult
        ? spinner.succeed(`Your project is deployed 🎉 visit: http://${variables.VIRTUAL_HOST}`)
        : spinner.fail(`Something wrong happened, see ${CURRENT_USER.web_url}/${projectSlug}/-/jobs/${pipelineResult}`)
    }

    // remove temp dir
    // tmpDirectory.removeCallback();
    await filesystem.removeFolder(TMP_DIRECTORY)
  } catch (error) {
    // await filesystem.removeFolder(TMP_DIRECTORY)
    // tmpDirectory.removeCallback();
    await handleError(spinner, error)
  }
}

export const back = async () => {
  try {
    await init();
  } catch (error) {
    console.error(error.message);
  }
};
