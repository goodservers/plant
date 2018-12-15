import inquirer, { Question } from 'inquirer'
import { randomNine } from '../libs/helpers'
import * as inputs from './inputs'

const defaultVariable = (variable: string): Partial<Question> => ({
  name: variable,
  message: `Set variable ${variable}`,
})

export const formatXipIoDomain = (ip: string, subdomain?: string): string => (subdomain ? `${subdomain}.` : '') + `${ip}.xip.io`

export const pairVariables = async (variables: string[], context?: { serverDomainOrIp: string }): Promise<any> =>
  inquirer.prompt(
    variables.map((variable) => {
      switch (variable) {
        case 'LETSENCRYPT_HOST':
        case 'VIRTUAL_HOST':
          return inputs.domain({
            ...defaultVariable(variable),
            default: context && formatXipIoDomain(context.serverDomainOrIp, randomNine()),
          })
        case 'LETSENCRYPT_EMAIL':
          return inputs.email(defaultVariable(variable))
        case 'VIRTUAL_PORT':
          return inputs.text({
            ...defaultVariable(variable),
            validate: (input: string) => inputs.validator.port(input),
          })
        default:
          return inputs.text({
            ...defaultVariable(variable),
          })
      }
    }),
  )
