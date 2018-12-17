import inquirer, { Question } from 'inquirer'
import R from 'ramda'
import { TemplateVariables } from '../cmds/server';
import { CurrentUser } from '../libs/gitlab.types'
import * as inputs from './inputs'

const defaultVariable = (variable: string): Partial<Question> => ({
  name: variable,
  message: `Set variable ${variable}`,
})

export const formatXipIoDomain = (ip: string | null, subdomain?: string): string =>
  (subdomain ? `${subdomain}.` : '') + `${ip}.xip.io`

export const pairVariables = async (
  variables: string[],
  context: { currentUser: CurrentUser; projectName: string; serverDomainOrIp: string | null },
): Promise<TemplateVariables> => {
  const xipIoDomain = formatXipIoDomain(context.serverDomainOrIp, context.projectName)

  return inquirer.prompt(
    variables.map((variable) => {
      switch (variable) {
        case 'PROJECT_NAME':
          return inputs.slug({
            ...defaultVariable(variable),
            default: context.projectName,
          })
        case 'LETSENCRYPT_HOST':
        case 'VIRTUAL_HOST':
          return inputs.domain({
            ...defaultVariable(variable),
            default: xipIoDomain,
            validate: (val: string) => (!R.isEmpty(val) ? inputs.validator.domain(val) : true),
          })
        case 'LETSENCRYPT_EMAIL':
          return inputs.email({
            ...defaultVariable(variable),
            default: context.currentUser.email,
            validate: (val: string) => (!R.isEmpty(val) ? inputs.validator.email(val) : true),
          })
        case 'VIRTUAL_PORT':
          return inputs.text({
            ...defaultVariable(variable),
            default: '3000',
            validate: (input: string) => inputs.validator.port(input),
          })
        default:
          return inputs.text({
            ...defaultVariable(variable),
          })
      }
    }),
  )
}
