
// import chalk from 'chalk';
import inquirer from 'inquirer';
import * as inputs from './inputs';

type Choice = {
  name: string,
  value: string,
}

export const selectRightGitlabRemote = async (choices: Choice[]): Promise<{ name: string }> =>
  inquirer.prompt([
    inputs.text({
      type: 'list',
      name: 'name',
      message: 'Please select your git remote:',
      choices
    })
  ]);
