import inquirer from 'inquirer'
import * as inputs from './inputs'

export const create = async (): Promise<{
  name: string
  domain: string
  DEPLOYMENT_SERVER_IP: string
  DEPLOY_SERVER_PRIVATE_KEY: string
}> =>
  inquirer.prompt([
    inputs.text({
      name: 'name',
      message: 'Server name:',
      validate: (val: string) => !!val.length || 'Please fill the name',
    }),
    inputs.domain({
      name: 'DEPLOYMENT_SERVER_IP',
    }),
    inputs.text({
      type: 'editor',
      name: 'DEPLOY_SERVER_PRIVATE_KEY',
      message: 'Private Key',
      validate: (val: string) => !!val.length || 'Please fill the private key',
    }),
  ])

export const init = (): Promise<{ server: string }> =>
  inquirer.prompt([
    {
      type: 'list',
      name: 'server',
      message: 'What do you want to do?',
      choices: [
        { name: 'Create server', value: 'create' },
        { name: 'List servers', value: 'list' },
        { name: 'Edit server', value: 'edit' },
        { name: 'Add ssh key', value: 'ssh_keys' },
        { name: '<- Back', value: 'back' },
        { name: 'Exit', value: 'exit' },
      ],
    },
  ])
