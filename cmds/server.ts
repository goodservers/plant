import chalk from 'chalk'
import inquirer from 'inquirer'
import { Remote, Repository } from 'nodegit'
import R from 'ramda'
import { parseEnvVariables } from '../libs/env'
import * as filesystem from '../libs/filesystem'
import * as git from '../libs/git'
import * as github from '../libs/github'
import * as gitlab from '../libs/gitlab'
import { Status } from '../libs/gitlab.types'
import { Group } from '../libs/gitlab.types'
import { convertToSlug, randomNine } from '../libs/helpers'
import { selectGitlabProject } from '../prompts/create'
import * as serverPrompt from '../prompts/server'
import { selectTemplate } from '../prompts/templates'
import { pairVariables } from '../prompts/variables'
import { callMatchingMethod, CURRENT_USER, GitlabAPI, handleError, spinner, TMP_DIRECTORY, GITLAB_DOMAIN } from '../util'
import * as action from './init'
import * as server from './server'
import { connect } from '../libs/ssh'

export const init = async () => {
  try {
    const answers = await serverPrompt.init()
    callMatchingMethod(module.exports, answers.server)
  } catch (error) {
    console.error(error)
  }
}

export const SERVER_PREFIX = 'servers'
export const SERVER_VARIABLES = ['DEPLOYMENT_SERVER_IP', 'DEPLOY_SERVER_PRIVATE_KEY']

export const create = async (): Promise<Group> => {
  const server = await serverPrompt.create()

  spinner.start(`Saving ${server.name}...`)

  const newGroup: Group = await GitlabAPI.Groups.create({
    name: server.name,
    path: `${SERVER_PREFIX}-${convertToSlug(server.name)}-${randomNine()}`,
  })

  await GitlabAPI.GroupVariables.create(newGroup.id, {
    key: 'DEPLOYMENT_SERVER_IP',
    value: server.DEPLOYMENT_SERVER_IP,
    protected: false,
  })

  await GitlabAPI.GroupVariables.create(newGroup.id, {
    key: 'DEPLOY_SERVER_PRIVATE_KEY',
    value: server.DEPLOY_SERVER_PRIVATE_KEY,
    protected: false,
  })

  // TODO: test ssh access
  spinner.succeed(`Server ${chalk.bold(server.name)} is setuped in Gitlab. 🎉`)

  return newGroup
}

export const createDatabase = async () => {
  try {
    const { server: selectedServer } = await server.listOrCreate()
    await initDatabase(selectedServer.id)
  } catch (error) {
    await handleError(spinner, error)
  }
}

export const deleteDatabase = async () => {
  try {
    const { server: selectedServer } = await server.listOrCreate()
    await removeDatabase(selectedServer.id)
  } catch (error) {
    await handleError(spinner, error)
  }
}

export const removeDatabase = async (serverId: number): Promise<void> => {
  const variables = await gitlab.getVariablesForServer(serverId)

  const ssh = await connect(
    variables.DEPLOYMENT_SERVER_IP,
    variables.DEPLOY_SERVER_PRIVATE_KEY,
  )

  const projects = (await gitlab.getProjects('')).filter((project) => project.namespace.id === serverId)
  const project = (await selectGitlabProject(projects)).project

  const z = await ssh.execCommand(`docker stop ${project.name} && docker rm ${project.name}`)
  // @TODO not working due to user rights
  // const x = await ssh.execCommand(
  //   `mkdir --parents /docker/_deleted && mv -f /docker/${project.name} /docker/_deleted/${project.name}`,
  // )
  // console.log('x', x)
  // console.log('z', z)
  await gitlab.deleteRepository(project.id)
  spinner.succeed(`Your project ${project.name} was successfuly deleted`)
}

export const initDatabase = async (
  serverId: number,
): Promise<{ name: string; variables: server.TemplateVariables }> => {
  const { template } = await selectTemplate((template) => template.isDatabase === true)

  await R.pipeP(
    github.getTemplateFiles,
    github.downloadTemplateFiles(TMP_DIRECTORY),
  )(template.path)

  const projects = await gitlab.getProjects(template.name)
  const groupProjects = projects.filter((project) => project.namespace.id === serverId)
  // console.log(projects)

  let repo = groupProjects[0]
  if (groupProjects.length === 0) {
    // spinner.start('Creating new database instance.')

    repo = await gitlab.createRepository(template.name, {
      namespace_id: serverId,
      container_registry_enabled: true,
    })
    const serverVariables = await gitlab.getVariablesForServer(serverId)

    const dbRepo = await Repository.init(`${TMP_DIRECTORY}/${template.path}`, 0)
    await Remote.create(dbRepo, 'origin', repo.ssh_url_to_repo)

    const remote = await git.getGitRemote(dbRepo, 'origin')

    const projectSlug = git.getProjectSlug(remote.url())

    // TODO: remove
    const variablesContext = {
      currentUser: CURRENT_USER,
      projectName: projectSlug,
      serverDomainOrIp: serverVariables.DEPLOYMENT_SERVER_IP,
    }

    const dbVariables = await gitlab.fillVariables(remote.url(), repo.id, serverId, template, variablesContext)

    // ENV variables
    const envFiles = await filesystem.getEnvFiles(`${TMP_DIRECTORY}/${template.path}`)
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

    const pipelineResult = await gitlab.waitUntilFinishedPipeline(dbRepo, repo.id, (status: Status) => {
      spinner.start(
        `Pipeline for db deployment has been started, you can check pipeline status on web: https://${GITLAB_DOMAIN}/${
          repo.path_with_namespace
        }/-/jobs/${status.id}`,
      )
    })
    spinner.stop()
    !pipelineResult
      ? spinner.succeed(`Your ${repo.name} instance is deployed!`)
      : spinner.fail(`Something wrong happened, see https://${GITLAB_DOMAIN}/${repo.path}/-/jobs/${pipelineResult}`)

    return { name: template.name, variables: { ...dbVariables, ...environmentVariables } }
  } else if (groupProjects.length > 1) {
    repo = (await selectGitlabProject(projects)).project
  }

  const repoVariables = await gitlab.getProjectVariables(repo.id)
  return { name: template.name, variables: repoVariables }
}

export const listOrCreate = async (): Promise<{ server: Group }> => {
  spinner.start(`Listing servers...`)

  const list: Group[] = await GitlabAPI.Groups.all({
    owned: true,
  })

  const choices = list
    .filter((server) => server.path.startsWith(SERVER_PREFIX))
    .map((server) => ({
      name: server.name,
      value: server,
    }))

  spinner.stop()
  switch (choices.length) {
    case 0:
      spinner.warn(`No server to deployment found, please create new.`)
      const newServer = await create()
      list.push(newServer)
      return new Promise((resolve) => resolve({ server: newServer }))
    case 1:
      const choice = choices[0]
      spinner.succeed(`Setting deployment to ${choice.name} server`)
      return new Promise((resolve) => resolve({ server: choice.value }))
    default:
      return inquirer.prompt([
        {
          type: 'list',
          name: 'server',
          message: 'Choose server to deploy',
          choices,
        },
      ])
  }
}

export interface TemplateVariables {
  [key: string]: string
}

export const back = async () => {
  try {
    console.log('back')
    await action.init()
  } catch (error) {
    console.error(error.message)
  }
}

export const exit = () => process.exit()
