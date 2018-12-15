import chalk from 'chalk'
import Gitlab from 'gitlab'
import Ora from 'ora'
import CacheConf from './libs/cache-conf'
import * as Create from './prompts/create'

export const config = new CacheConf({ projectName: 'plant' })
export const spinner = new Ora()
// config.delete('gitlabToken');
export const CURRENT_USER = config.get('currentUser')
export const GITLAB_DOMAIN = config.get('gitlabDomain')
export const ACCESS_TOKEN = config.get('gitlabToken')
export const GitlabAPI = new Gitlab({
  url: `https://${GITLAB_DOMAIN}`,
  token: ACCESS_TOKEN,
})

// /Users/xxx/Library/Preferences/shark-nodejs/config.json

export const initAccount = async () => {
  const verifyAccount = async ({ gitlabToken, gitlabDomain }: { gitlabToken: string; gitlabDomain: string }) => {
    console.log('token,', gitlabToken, gitlabDomain)
    try {
      const api = new Gitlab({
        url: `https://${gitlabDomain}`,
        token: gitlabToken,
      })

      spinner.start('Verifying your account...')

      const currentUser = await api.Users.current()

      if (api) {
        spinner.succeed('Account verified!')
        console.log(`
          ${chalk.green(`Hi ${currentUser.name}! Your access token is valid.`)}
        `)

        config.set('gitlabToken', gitlabToken)
        config.set('gitlabDomain', gitlabDomain)
        config.set('currentUser', currentUser)
      }
    } catch (error) {
      spinner.fail('Verification failed!')
      console.error(`
          ${chalk.red('Please make sure you are using a valid access token')}
          `)
    }
  }

  const answers = await Create.gitlabAccess()

  await verifyAccount(answers)
}

export const callMatchingMethod = (object, method) => {
  if (Object.prototype.hasOwnProperty.call(object, method)) {
    object[method]()
  } else if (Object.prototype.hasOwnProperty.call(object, 'init')) {
    object.init()
  } else {
    console.error(`Couldn't find the method/property ${method} in ${object} `)
  }
}
