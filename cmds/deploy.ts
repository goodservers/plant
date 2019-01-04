import chalk from 'chalk'
import { Remote, Repository, StatusFile } from 'nodegit'
import R from 'ramda'
import tmp from 'tmp'
import { parseEnvVariables } from '../libs/env'
import * as filesystem from '../libs/filesystem'
import * as git from '../libs/git'
import * as github from '../libs/github'
import * as gitlab from '../libs/gitlab'
import { Status } from '../libs/gitlab.types'
import { getRandomPassword } from '../libs/helpers'
import { connect } from '../libs/ssh'
import * as template from '../libs/template'
import { confirm, repositoryName, selectGitlabProject } from '../prompts/create'
import * as gitlabPrompt from '../prompts/gitlab'
import { selectTemplate } from '../prompts/templates'
import { pairVariables, VariablesContext } from '../prompts/variables'
import { CURRENT_USER, GITLAB_DOMAIN, spinner } from '../util'
import * as server from './server'

export const tmpDirectory = tmp.dirSync()
console.log('tmpDirectory', tmpDirectory)
const tempDirectory = tmpDirectory.name

const fillVariables = async (
  remoteUrl: string,
  projectId: number,
  serverId: string,
  templateName: string,
  variablesContext: Partial<VariablesContext>,
): Promise<server.TemplateVariables> => {
  const serverVariables = await server.getVariablesForServer(serverId)
  const registryVariables = {
    REGISTRY_URL: `${gitlab.getRegistryDomain()}/${gitlab.getUserAndProjectName(remoteUrl)}`,
  }

  const templateVariables = await template.getTemplateVariables(`${tempDirectory}/${templateName}`)
  const neededTemplateVariabless = templateVariables.filter(
    (variable) => ![...server.SERVER_VARIABLES, ...Object.keys(registryVariables)].includes(variable),
  )
  const userVariables = await pairVariables(neededTemplateVariabless, {
    ...variablesContext,
    serverDomainOrIp: serverVariables.DEPLOYMENT_SERVER_IP,
  } as VariablesContext)

  const variables = {
    ...serverVariables,
    ...registryVariables,
    ...userVariables,
  }

  await template.writeTemplateVariables(`${tempDirectory}/${templateName}`, variables)
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

const dockerExec = (containerName: string, command: string) => `docker exec -t ${containerName} ${command}`
const mysql = (user = 'root', pass: string) => (command: string) => `mysql -u${user} -p${pass} --execute="${command}"`
const sql = {
  createDb: (dbname: string) => `CREATE DATABASE ${dbname};`,
  grant: (username: string, password: string, database = '*', table = '*') =>
    `GRANT ALL PRIVILEGES ON ${database}.${table} TO '${username}'@'%' IDENTIFIED BY '${password}';`,
}

const initDatabase = async (serverId: string): Promise<server.TemplateVariables> => {
  const { name: dbTemplateName } = await selectTemplate()

  await R.pipeP(
    github.getTemplateFiles,
    github.downloadTemplateFiles(tempDirectory),
  )(dbTemplateName)

  // const { name: serverId } = await server.listOrCreate()

  const projects = await gitlab.getProjects(dbTemplateName)

  let repo = projects[0];
  if (projects.length > 1) {
    repo = (await selectGitlabProject(projects)).project
  } else {
    repo = await gitlab.createRepository(dbTemplateName, {
      namespace_id: parseInt(serverId, 10),
      container_registry_enabled: true,
    })
  }

  const serverVariables = await server.getVariablesForServer(serverId)

  // spinner.start('Creating gitlab repository...')
  const dbRepo = await Repository.init(`${tempDirectory}/${dbTemplateName}`, 0)
  await Remote.create(dbRepo, 'origin', repo.ssh_url_to_repo)

  const remote = await git.getGitRemote(dbRepo, 'origin')

  const projectSlug = git.getProjectSlug(remote.url())
  const projectId = repo.id

  // TODO: remove
  const variablesContext = {
    currentUser: CURRENT_USER,
    projectName: projectSlug,
    serverDomainOrIp: serverVariables.DEPLOYMENT_SERVER_IP,
  }

  const dbVariables = await fillVariables(remote.url(), projectId, serverId, dbTemplateName, variablesContext)

  // ENV variables
  const envFiles = await filesystem.getEnvFiles(`${tempDirectory}/${dbTemplateName}`)
  const emptyEnvVariables = await parseEnvVariables(envFiles)
  // TODO: auto fill variables (USERNAME, PASSWORD)
  const environmentVariables = await pairVariables(Object.keys(emptyEnvVariables), variablesContext)

  await gitlab.saveOrUpdateVariables(repo.id, environmentVariables)

  const repositoryStatus = await dbRepo.getStatus()
  const unstagedFilesToCommit = repositoryStatus.map((file: StatusFile) => file.path())
  const oid = await git.addFilesToCommit(dbRepo, unstagedFilesToCommit)
  if (await git.isNewRepository(dbRepo)) {
    git.commit(dbRepo, oid, 'Init database 🌱')
  }

  await git.push(remote)

  spinner.start(`Waiting until deployment will be finished (takes around 2-5 minutes)`)

  const pipelineResult = await waitUntilFinishedPipeline(dbRepo, projectId, (status: Status) => {
    spinner.start(
      `Pipeline for db deployment has been started, you can check pipeline status on web: ${
        CURRENT_USER.web_url
      }/${projectSlug}/-/jobs/${status.id}`,
    )
  })
  spinner.stop()
  pipelineResult
    ? spinner.succeed(`Your db is deployed, username`)
    : spinner.fail(`Something wrong happened, see ${CURRENT_USER.web_url}/${projectSlug}/-/jobs/${pipelineResult}`)

  // const repoVariables = await gitlab.getProjectVariables(repo.id)

  return { ...dbVariables, ...environmentVariables }
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

    const repositoryStatus = await repository.getStatus()
    const unstagedFilesToCommit = repositoryStatus.map((file: StatusFile) => file.path())
    const oid = await git.addFilesToCommit(repository, unstagedFilesToCommit)
    if (await git.isNewRepository(repository)) {
      git.commit(repository, oid, 'Init 🌱')
    }
    // else {
    //   const commitChanges = await confirm('Do you want to commit your unstaged changes? (required)')
    //   if (commitChanges.confirm) {
    //     git.commit(repository, oid, )
    //   }
    // }

    const { name: templateName } = await selectTemplate()
    await R.pipeP(
      github.getTemplateFiles,
      github.downloadTemplateFiles(tempDirectory),
    )(templateName)

    const { name: serverId } = await server.listOrCreate()
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
    const projectId = gitlabProject.id

    const variablesContext = {
      currentUser: CURRENT_USER,
      projectName: projectSlug,
    }

    // TODO: Get variables from .env?
    const variables = await fillVariables(remote.url(), projectId, serverId, templateName, variablesContext)

    const initDB = await confirm('Do you want to initiate also some database?')

    // TODO: check external_links in docker-compose
    if (initDB.confirm) {
      const dbVariables = await initDatabase(serverId)

      const ssh = await connect(
        variables.DEPLOYMENT_SERVER_IP,
        variables.DEPLOY_SERVER_PRIVATE_KEY,
      )

      // check db and setup users
      const container = await ssh.execCommand(`docker ps -q --filter "name=${dbVariables.PROJECT_NAME}"`, { cwd: '/' })

      const dbAccess: server.TemplateVariables = {
        DB_HOSTNAME: dbVariables.PROJECT_NAME,
        DB_NAME: 'test',
        DB_USERNAME: 'test',
        DB_PASSWORD: getRandomPassword(),
      }
      if (!R.isEmpty(container.stdout)) {
        const mysqlRun = mysql('root', dbVariables.DB_PASSWORD)
        const response1 = await ssh.execCommand(
          dockerExec(container.stdout, mysqlRun(sql.createDb(dbAccess.DB_NAME))),
          {
            cwd: '/',
          },
        )
        const response2 = await ssh.execCommand(
          dockerExec(
            container.stdout,
            mysqlRun(
              sql.grant(dbAccess.DB_USERNAME, dbAccess.DB_PASSWORD, dbAccess.DB_NAME),
            ),
          ),
          { cwd: '/' },
        )
        // TODO: handle errors
      }

      // TODO: save DB variables
      await gitlab.saveOrUpdateVariables(projectId, dbAccess)
    }

    // Copy and remove
    const filesToCommit = await filesystem.copyFilesFromDirectoryToCurrent(`${tempDirectory}/${templateName}`)
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
      }

      const oid = await git.addFilesToCommit(repository, relativeFilesToCommit)
      await git.commit(repository, oid, 'Deploy with 🌱 plant 🎉')
      await git.push(remote)

      spinner.start(`Waiting until pipeline will be finished (takes around 2-5 minutes)`)

      const pipelineResult = await waitUntilFinishedPipeline(repository, projectId, (status: Status) => {
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
    spinner.stop()
    spinner.fail(error)
  }
}
