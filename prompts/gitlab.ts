import inquirer from 'inquirer'
import * as inputs from './inputs'

export const selectRightGitlabRemote = async (choices: inputs.Choice[]): Promise<{ name: string }> =>
  inquirer.prompt([
    inputs.text({
      type: 'list',
      name: 'name',
      message: 'Please select your git remote:',
      choices,
    }),
  ])
