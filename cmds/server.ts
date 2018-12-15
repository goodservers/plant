import chalk from 'chalk'
import inquirer from 'inquirer'
import { convertToSlug, randomNine } from '../libs/helpers'
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

export const create = async () => {
  try {
    const server = await serverPrompt.create()

    spinner.start(`Saving ${server.name}...`)

    const newGroup = await GitlabAPI.Groups.create({
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

    return {
      name: server.name,
      value: newGroup.id,
    }
  } catch (error) {
    spinner.stop()
    console.error(error)
  }
}

export const listOrCreate = async (): Promise<{ name: string }> => {
  // try {
  spinner.start(`Listing servers...`)

  const list: any[] = await GitlabAPI.Groups.all({
    owned: true,
  })

  const choices = list
    .filter((server) => server.path.startsWith(SERVER_PREFIX))
    .map((server) => ({
      name: server.name,
      value: server.id,
    }))

  spinner.stop()
  switch (choices.length) {
    case 0:
      spinner.warn(`No server to deployment found, please create new.`)
      const newServer = await create()
      list.push(newServer)
      return new Promise((resolve) => resolve({ name: newServer && newServer.value }))
    case 1:
      const choice = choices[0]
      spinner.succeed(`Setting deployment to ${choice.name} server`)
      return new Promise((resolve) => resolve({ name: choice.value }))
    default:
      return inquirer.prompt([
        {
          type: 'list',
          name: 'name',
          message: 'Choose server to deploy',
          choices,
        },
      ])
  }
  // } catch (error) {
  //   spinner.stop();
  //   console.error(error);
  // }
}

export interface GitlabVariable {
  key: string
  value: string
  id?: number | string
  protected?: boolean
  environment_scope?: string
}

export const getVariablesForServer = async (groupId: string): Promise<GitlabVariable[]> =>
  GitlabAPI.GroupVariables.all(groupId)
