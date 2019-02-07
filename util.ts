import chalk from 'chalk'
import Gitlab from 'gitlab'
import Ora from 'ora'
import tmp from 'tmp'
import CacheConf from './libs/cache-conf'
import { CurrentUser } from './libs/gitlab.types'
import { checkGithubApiLimit } from './loaders';
import * as Create from './prompts/create'

export const config = new CacheConf({ projectName: 'plant' })
export const spinner = new Ora()
// config.delete('gitlabToken');
export const CURRENT_USER: CurrentUser = config.get('currentUser')
export const GITLAB_DOMAIN: string = config.get('gitlabDomain')
export const ACCESS_TOKEN: string = config.get('gitlabToken')

const tmpDirectory = tmp.dirSync()
export const TMP_DIRECTORY = tmpDirectory.name


// console.log('ACCESS_TOKEN', ACCESS_TOKEN)
export const GitlabAPI = new Gitlab({
  url: `https://${GITLAB_DOMAIN}`,
  token: ACCESS_TOKEN,
})

// /Users/xxx/Library/Preferences/shark-nodejs/config.json

export const initAccount = async () => {
  const verifyAccount = async ({ gitlabToken, gitlabDomain }: { gitlabToken: string; gitlabDomain: string }) => {
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

export const handleError = async (spinner: any, error: string) => {
  spinner.stop()
  const isLimitError = await checkGithubApiLimit()
  if (isLimitError) {
    spinner.fail('Github API rate limit was exceeded, please wait. (check https://api.github.com/rate_limit)')
  } else {
    spinner.fail(error)
  }
}
