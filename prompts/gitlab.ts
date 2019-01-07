import inquirer from 'inquirer'
import { Choice } from '../loaders'
import * as inputs from './inputs'

export const selectRightGitlabRemote = async (choices: Array<Choice<string>>): Promise<{ name: string }> =>
  inquirer.prompt([
    inputs.text({
      type: 'list',
      name: 'name',
      message: 'Please select your git remote:',
      choices,
    }),
  ])
