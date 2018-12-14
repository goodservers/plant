import inquirer from 'inquirer';
import chalk from 'chalk';
import * as input from './inputs';

export const repositoryName = (): Promise<{ name: string }> => {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Give a repository name:'
    }
  ];

  return inquirer.prompt(questions);
};

export const gitlabAccess = (): Promise<{ gitlabDomain: string, gitlabToken: string }> =>
  inquirer.prompt([
    input.domain({
      name: 'gitlabDomain',
      message: 'Enter Gitlab domain',
      default: 'gitlab.com'
    }),
    input.text({
      name: 'gitlabToken',
      type: 'input',
      validate: (val: string) => !!val.length || 'We need gitlab acces token :(',
      message: chalk.yellow('Please provide your Gitlab access token:')
    })
  ]);
