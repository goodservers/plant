import inquirer from 'inquirer'

export const init = (): Promise<{ init: string }> => {
  const questions = [
    {
      type: 'list',
      name: 'init',
      message: 'What do you want to do?',
      choices: [
        { name: 'Deploy', value: 'deploy' },
        { name: 'Server', value: 'server' },
        { name: 'Exit', value: 'exit' },
      ],
    },
  ]

  return inquirer.prompt(questions)
}
