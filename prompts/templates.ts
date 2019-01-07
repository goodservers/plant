import inquirer from 'inquirer'
import { Template } from '../libs/template';
import { loadAvailableTemplates } from '../loaders'

export const selectTemplate = async (filter: (template: Template) => boolean): Promise<{ template: Template }> =>
  inquirer.prompt([
    {
      type: 'list',
      name: 'template',
      message: 'Select init template',
      choices: await loadAvailableTemplates(filter),
    },
  ])
