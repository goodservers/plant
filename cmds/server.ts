import chalk from 'chalk'
import inquirer from 'inquirer'
import R from 'ramda'
import { Group, Variable } from '../libs/gitlab.types'
import { convertToSlug, randomNine } from '../libs/helpers'
import { Choice } from '../loaders'
import * as serverPrompt from '../prompts/server'
import { callMatchingMethod, GitlabAPI, spinner } from '../util'

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

  spinner.succeed(`${chalk.bold(server.name)} is saved. 🎉`)

  return newGroup
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

export const getVariablesForServer = async (groupId: number): Promise<TemplateVariables> =>
  (await GitlabAPI.GroupVariables.all(groupId))
    .map((variable: Variable) => ({ [variable.key]: variable.value }))
    .reduce(R.merge, {})
