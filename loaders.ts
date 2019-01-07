import * as github from './libs/github'
import * as template from './libs/template'
import { config, handleError, spinner } from './util'

const deleteKey = (key: string) => {
  if (config.isExpired(key)) {
    config.delete(key)
  }
}

export const checkGithubApiLimit = async (): Promise<boolean> => {
  const limit = await github.getApiLimit()
  return limit === 0
}

export interface Choice<T> {
  name: string
  value: T
}

const cachedLoader = async <T>(
  cacheKey: string,
  asyncLoadingFunction: () => Promise<T[]>,
  mappingFunction: (item: T) => Choice<T>,
  maxAge = 8640000,
): Promise<Array<Choice<T>>> => {
  let choices: any[] = []

  deleteKey(cacheKey)
  try {
    spinner.start(`Loading available ${cacheKey}...`)

    if (config.has(cacheKey)) {
      choices = config.get(cacheKey) as Array<Choice<T>>
      spinner.stop()
    } else {
      const input = await asyncLoadingFunction()
      spinner.stop()

      choices = input.map(mappingFunction) as Array<Choice<T>>

      config.setKey(cacheKey, choices, {
        maxAge,
      })
    }

    return choices
  } catch (error) {
    await handleError(spinner, error)
  }
  return []
}

export const loadAvailableTemplates = async (filter: (template: template.Template) => boolean) => {
  const templateList = await cachedLoader('templates', template.getListOfTemplates, (template: template.Template) => ({
    name: template.name,
    value: template,
  }))

  return templateList.filter((choice: Choice<template.Template>) => filter(choice.value))
}
