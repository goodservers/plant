import * as Github from './libs/github'
import { Choice } from './prompts/inputs'
import { config, spinner } from './util'

const deleteKey = (key: string) => {
  if (config.isExpired(key)) {
    config.delete(key)
  }
}

const checkGithubApiLimit = async (spinner) => {
  const limit = await Github.getApiLimit()
  if (limit === 0) {
    spinner.fail('Github API rate limit was exceeded, please wait until:')
  }
}

const stringMapFunction = (item: string) => ({ name: item, value: item })

const cachedLoader = async (
  cacheKey: string,
  asyncLoadingFunction: () => Promise<any[]>,
  mappingFunction: (x: any) => Choice,
  maxAge = 8640000,
) => {
  let choices: any[] = []

  deleteKey(cacheKey)
  try {
    spinner.start(`Loading available ${cacheKey}...`)

    if (config.has(cacheKey)) {
      choices = config.get(cacheKey) as Choice[]
      spinner.stop()
    } else {
      const input = await asyncLoadingFunction()
      spinner.stop()

      choices = input.map(mappingFunction)

      config.setKey(cacheKey, choices, {
        maxAge,
      })
    }

    return choices
  } catch (error) {
    spinner.stop()
    checkGithubApiLimit(spinner)
    spinner.fail(error)
  }
}

export const loadAvailableTemplates = async () =>
  cachedLoader('templates', Github.getListOfDirectories, stringMapFunction)
