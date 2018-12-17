import chalk from 'chalk'
import inquirer from 'inquirer'
import { Project } from '../libs/gitlab.types';
import * as inputs from './inputs'

export const repositoryName = async (): Promise<{ name: string }> => {
  const questions = [
    {
      type: 'inputs',
      name: 'name',
      message: 'Give a repository name:',
    },
  ]

  return inquirer.prompt(questions)
}

export const gitlabAccess = async (): Promise<{ gitlabDomain: string; gitlabToken: string }> =>
  inquirer.prompt([
    inputs.domain({
      name: 'gitlabDomain',
      message: 'Enter Gitlab domain',
      default: 'gitlab.com',
    }),
    inputs.text({
      name: 'gitlabToken',
      validate: (val: string) => !!val.length || 'We need gitlab acces token :(',
      message: chalk.yellow('Please provide your Gitlab access token:'),
    }),
  ])

export const confirmGitCommitAndPush = async (): Promise<{ confirm: boolean }> =>
  inquirer.prompt([
    inputs.confirm({
      message: 'Do you want to commit and push your changes to deploy?',
    }),
  ])

export const selectGitlabProject = async (projects: Project[]): Promise<{ project: Project }> =>
  inquirer.prompt([
    {
      type: 'list',
      name: 'id',
      message: 'Select gitlab project',
      choices: projects.map(project => ({ name: project.name + ' (' + project.id + ')',  value: project }))
    },
  ])
