import chalk from 'chalk';
import inquirer from 'inquirer';
import node_ssh from 'node-ssh'
import * as server from '../cmds/server'
import { confirm } from '../prompts/create';
import * as inputs from '../prompts/inputs'
import { spinner } from '../util';

const dockerExec = ({ PROJECT_NAME }: server.TemplateVariables) => (command: string) =>
  `docker exec -t ${PROJECT_NAME} ${command}`

const cli = {
  mysql: ({ DB_USER = 'root', DB_PASSWORD }: server.TemplateVariables) => (command: string) =>
    `mysql -u"${DB_USER}" -p"${DB_PASSWORD}" --execute="${command}"`,
}

export const commands  = {
  docker: {
    exec: dockerExec
  },
  cli
}

export const connect = async (host: string, privateKey: string, port = 22, username = 'user'): Promise<any> => {
  const ssh = new node_ssh()
  await ssh.connect({
    host,
    port,
    username,
    privateKey,
  })
  return ssh
}


interface Output {
  stdout: string
  options?: any
  stderr: string
  signal: string
  code: number
}

export const runCommandUntilSucceed = (sshInstance: any) => async (
  command: (vars: server.TemplateVariables) => string,
  variables: server.TemplateVariables,
): Promise<server.TemplateVariables> => {
  try {
    const output: Output = await sshInstance.execCommand(command(variables), {
      cwd: '/',
    })
    // console.log('output', command(variables), output)
    if (output.stderr) {
      throw new Error(output.stderr)
    }
    return variables
  } catch (error) {
    spinner.fail(error)
    const userInput = await confirm('Do you want to change some variable?')
    if (userInput.confirm) {
      const newVariables: server.TemplateVariables = await inquirer.prompt([
        ...Object.keys(variables).map((variableName) =>
          inputs.text({
            default: variables[variableName],
            message: chalk.yellow(`Please fill variable: ${variableName}`),
            name: variableName,
            validate: (val: string) => !!val.length,
          }),
        ),
      ])
      runCommandUntilSucceed(sshInstance)(command, newVariables)
      return newVariables
    }
    return {}
  }
}
