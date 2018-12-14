
import inquirer from 'inquirer';

export const pairVariables = async (variables: string[]): Promise<any> =>
  inquirer.prompt(
    variables.map((variable) => ({
      type: 'input',
      name: variable,
      message: `Set variable ${variable}`
    }))
  );
