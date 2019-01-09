import chalk from 'chalk'
import fs from 'fs-extra'
import inquirer from 'inquirer'
import mustache from 'mustache'
import { Remote, Repository } from 'nodegit'
import R from 'ramda'
import tmp from 'tmp'
import { getExternalSources, loadDockerCompose } from '../libs/docker'
import { parseEnvVariables } from '../libs/env'
import * as filesystem from '../libs/filesystem'
import * as git from '../libs/git'
import * as github from '../libs/github'
import * as gitlab from '../libs/gitlab'
import { Status } from '../libs/gitlab.types'
import { getRandomDBName, getRandomPassword } from '../libs/helpers'
import { connect } from '../libs/ssh'
import * as template from '../libs/template'
import { loadAvailableTemplates } from '../loaders'
import { confirm, repositoryName, selectGitlabProject } from '../prompts/create'
import * as gitlabPrompt from '../prompts/gitlab'
import * as inputs from '../prompts/inputs'
import { selectTemplate } from '../prompts/templates'
import { pairVariables, VariablesContext } from '../prompts/variables'
import { CURRENT_USER, GITLAB_DOMAIN, handleError, spinner } from '../util'
import * as server from './server'

export const tmpDirectory = tmp.dirSync()
console.log('tmpDirectory', tmpDirectory)
const tempDirectory = tmpDirectory.name

const fillVariables = async (
  remoteUrl: string,
  projectId: number,
  serverId: number,
  selectedTemplate: template.Template,
  variablesContext: Partial<VariablesContext>,
): Promise<server.TemplateVariables> => {
  const serverVariables = await server.getVariablesForServer(serverId)

  const knownVariables = {
    ...serverVariables,
    REGISTRY_URL: `${gitlab.getRegistryDomain()}/${gitlab.getUserAndProjectName(remoteUrl)}`,
  }

  const templateVariables = await template.getTemplateVariables(`${tempDirectory}/${selectedTemplate.path}`)
  const neededTemplateVariables = templateVariables.filter(
    (variable) => !Object.keys(knownVariables).includes(variable),
  )

  const userVariables = await pairVariables(R.uniq(neededTemplateVariables), {
    ...variablesContext,
    serverDomainOrIp: serverVariables.DEPLOYMENT_SERVER_IP,
  } as VariablesContext)

  const variables = {
    ...knownVariables,
    ...userVariables,
  }

  await template.writeTemplateVariables(`${tempDirectory}/${selectedTemplate.path}`, variables)
  await gitlab.saveOrUpdateVariables(projectId, serverVariables)

  return variables
}

const waitUntilFinishedPipeline = async (
  repository: Repository,
  projectId: number,
  firstStatus: (status: Status) => any,
): Promise<true | number> => {
  const branch = await repository.getCurrentBranch()
  const commitSha = (await repository.getReferenceCommit(branch)).sha()
  try {
    await gitlab.waitUntilPipelineStatus(projectId, commitSha, firstStatus)
    return true
  } catch (pipelineID) {
    return pipelineID
  }
}

const dockerExec = ({ PROJECT_NAME }: server.TemplateVariables) => (command: string) =>
  `docker exec -t ${PROJECT_NAME} ${command}`

const cli = {
  mysql: ({ DB_USER = 'root', DB_PASSWORD }: server.TemplateVariables) => (command: string) =>
    `mysql -u${DB_USER} -p${DB_PASSWORD} --execute="${command}"`,
}

const sql = {
  createDb: ({ DB_USERNAME }: server.TemplateVariables) => () => `CREATE DATABASE ${DB_USERNAME};`,
  grant: ({ DB_USERNAME, DB_PASSWORD, DB_DATABASE = '*', DB_TABLE = '*' }: server.TemplateVariables) => () =>
    `GRANT ALL PRIVILEGES ON ${DB_DATABASE}.${DB_TABLE} TO '${DB_USERNAME}'@'%' IDENTIFIED BY '${DB_PASSWORD}';`,
}

const initDatabase = async (serverId: number): Promise<{ name: string; variables: server.TemplateVariables }> => {
  const { template } = await selectTemplate((template) => template.isDatabase === true)

  await R.pipeP(
    github.getTemplateFiles,
    github.downloadTemplateFiles(tempDirectory),
  )(template.path)

  const projects = await gitlab.getProjects(template.name)

  let repo = projects[0]
  if (projects.length === 0) {
    spinner.start('Creating new database instance.')

    repo = await gitlab.createRepository(template.name, {
      namespace_id: serverId,
      container_registry_enabled: true,
    })
    const serverVariables = await server.getVariablesForServer(serverId)

    const dbRepo = await Repository.init(`${tempDirectory}/${template.path}`, 0)
    await Remote.create(dbRepo, 'origin', repo.ssh_url_to_repo)

    const remote = await git.getGitRemote(dbRepo, 'origin')

    const projectSlug = git.getProjectSlug(remote.url())

    // TODO: remove
    const variablesContext = {
      currentUser: CURRENT_USER,
      projectName: projectSlug,
      serverDomainOrIp: serverVariables.DEPLOYMENT_SERVER_IP,
    }

    const dbVariables = await fillVariables(remote.url(), repo.id, serverId, template, variablesContext)

    // ENV variables
    const envFiles = await filesystem.getEnvFiles(`${tempDirectory}/${template.path}`)
    const emptyEnvVariables = await parseEnvVariables(envFiles)
    // TODO: auto fill variables (USERNAME, PASSWORD)
    const environmentVariables = await pairVariables(Object.keys(emptyEnvVariables), variablesContext)

    await gitlab.saveOrUpdateVariables(repo.id, environmentVariables)

    const oid = await git.addStatusFilesToCommit(dbRepo)

    if (await git.isNewRepository(dbRepo)) {
      git.commit(dbRepo, oid, 'Init database 🌱')
    }

    await git.push(remote)

    spinner.start(`Waiting until deployment will be finished (takes around 2-5 minutes)`)

    const pipelineResult = await waitUntilFinishedPipeline(dbRepo, repo.id, (status: Status) => {
      spinner.start(
        `Pipeline for db deployment has been started, you can check pipeline status on web: ${
          CURRENT_USER.web_url
        }/${projectSlug}/-/jobs/${status.id}`,
      )
    })
    spinner.stop()
    pipelineResult
      ? spinner.succeed(`Your db instance is deployed!`)
      : spinner.fail(`Something wrong happened, see ${CURRENT_USER.web_url}/${projectSlug}/-/jobs/${pipelineResult}`)

    return { name: template.name, variables: { ...dbVariables, ...environmentVariables } }
  } else if (projects.length > 1) {
    repo = (await selectGitlabProject(projects)).project
  }

  const repoVariables = await gitlab.getProjectVariables(repo.id)
  return { name: template.name, variables: repoVariables }
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
      github.downloadTemplateFiles(tempDirectory),
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
    const variables = await fillVariables(remote.url(), gitlabProject.id, selectedServer.id, template, variablesContext)

    const composeFileContent = await fs.readFile(`${tempDirectory}/${template.path}/docker-compose.yml`, 'utf8')
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
      const database = await initDatabase(selectedServer.id)

      const ssh = await connect(
        variables.DEPLOYMENT_SERVER_IP,
        variables.DEPLOY_SERVER_PRIVATE_KEY,
      )

      // check db and setup users
      const container = await ssh.execCommand(`docker ps -q --filter "name=${database.name}"`, { cwd: '/' })

      const dbAccess: server.TemplateVariables = {
        DB_HOSTNAME: database.variables.PROJECT_NAME,
        DB_NAME: 'xxx' || getRandomDBName(),
        DB_USERNAME: getRandomDBName(),
        DB_PASSWORD: getRandomPassword(),
      }

      interface Output {
        stdout: string
        options?: any
        stderr: string
        signal: string
        code: number
      }

      const runCommandUntilSucceed = async (
        command: (vars: server.TemplateVariables) => string,
        variables: server.TemplateVariables,
      ) => {
        try {
          const output: Output = await ssh.execCommand(command(variables), {
            cwd: '/',
          })
          console.log('output', command(variables), output);
          if (output.stderr) {
            throw new Error(output.stderr)
          }
        } catch (error) {
          spinner.fail(error)
          const userInput = await confirm('Do you want to change some variable?')
          if (userInput.confirm) {
            const newVariables: server.TemplateVariables = await inquirer.prompt([
              ...Object.keys(variables).map((variableName) =>
                inputs.text({
                  default: variables[variableName],
                  message: chalk.yellow(`Please fill variable: ${variableName}`),
                  name: variableName,
                  validate: (val: string) => !!val.length,
                }),
              ),
            ])
            runCommandUntilSucceed(command, newVariables)
          }
        }
      }

      // const mapParams = (variables: Map<string, string>): string[] => Array.from(variables.values())

      // inputs.text({
      //   name: 'gitlabToken',
      //   validate: (val: string) => !!val.length || 'We need gitlab acces token :(',
      //   message: chalk.yellow('Please provide your Gitlab access token:'),
      // })

      if (!R.isEmpty(container.stdout)) {
        const createDb = (props: server.TemplateVariables) =>
          R.compose(
            dockerExec(props),
            cli.mysql(props),
            sql.createDb(props),
          )()

        // console.log('xxx', createDb({ ...dbAccess }))
        await runCommandUntilSucceed(createDb, { ...dbAccess, PROJECT_NAME: dbAccess.DB_HOSTNAME })

        // try {
        //   // TODO: check if database exists in db, create
        //   await ssh.execCommand(dockerExec(container.stdout)(mysqlCli(sql.createDb(dbAccess.DB_NAME))), {
        //     cwd: '/',
        //   })
        // } catch (error) {
        //   // TODO: handle errors - add posibility to enter manual input
        //   console.log('Shell Error:', error)
        // }

        // try {
        //   // TODO: check if user exists in db, create
        //   await ssh.execCommand(
        //     dockerExec(container.stdout)(
        //       mysqlCli(sql.grant(dbAccess.DB_USERNAME, dbAccess.DB_PASSWORD, dbAccess.DB_NAME)),
        //     ),
        //     { cwd: '/' },
        //   )
        // } catch (error) {
        //   // TODO: handle errors - add posibility to enter manual input
        //   console.log('Shell Error:', error)
        // }
      }

      // TODO: save DB variables
      await gitlab.saveOrUpdateVariables(gitlabProject.id, dbAccess)
    }

    // Copy and remove
    const filesToCommit = await filesystem.copyFilesFromDirectoryToCurrent(`${tempDirectory}/${template.path}`)
    await filesystem.removeFolder(tempDirectory)

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

      const pipelineResult = await waitUntilFinishedPipeline(repository, gitlabProject.id, (status: Status) => {
        spinner.start(
          `Pipeline for deployment has been started, you can check pipeline status on web: ${
            CURRENT_USER.web_url
          }/${projectSlug}/-/jobs/${status.id}`,
        )
      })
      spinner.stop()
      pipelineResult
        ? spinner.succeed(`Your project is deployed 🎉 visit: http://${variables.VIRTUAL_HOST}`)
        : spinner.fail(`Something wrong happened, see ${CURRENT_USER.web_url}/${projectSlug}/-/jobs/${pipelineResult}`)
    }

    // remove temp dir
    // tmpDirectory.removeCallback();
    await filesystem.removeFolder(tempDirectory)
  } catch (error) {
    // await filesystem.removeFolder(tempDirectory)
    // tmpDirectory.removeCallback();
    await handleError(spinner, error)
  }
}
