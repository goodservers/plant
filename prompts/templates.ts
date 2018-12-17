import inquirer from 'inquirer'
import { loadAvailableTemplates } from '../loaders'

export const selectTemplate = async (): Promise<{ name: string }> =>
  inquirer.prompt([
    {
      type: 'list',
      name: 'name',
      message: 'Select init template',
      choices: await loadAvailableTemplates(),
    },
  ])
