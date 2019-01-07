import fs from 'fs-extra'
import mustache from 'mustache'
import R from 'ramda'
import { TemplateVariables } from '../cmds/server'
import { filters } from '../prompts/inputs'
import { getAllFilesFromDirectory } from './filesystem'
import * as github from './github'

export const _getTemplateVariables = (checkedToken: string) => (template: string) => {
  const tokens = mustache.parse(template)

  return R.pipe(
    R.filter(([key]) => key === checkedToken),
    R.map((token) => R.pathOr('', ['1'], token).split('.')),
    R.flatten,
    R.uniq,
    R.values,
  )(tokens) as any
}

export const getRequiredVariables = _getTemplateVariables('name')
export const getOptionalVariables = _getTemplateVariables('#')

export const getTemplateVariables = async (directory: string) => {
  const files = await getAllFilesFromDirectory(directory)
  const filesP = (await R.pipe(
    R.map(async (filePath: string) => {
      const template = await fs.readFile(filePath, 'utf8')
      return [...getRequiredVariables(template), ...getOptionalVariables(template)]
    }),
    Promise.all.bind(Promise),
  )(files)) as string[]

  return R.flatten(R.uniq(filesP))
}

export const _writeTemplateVariables = async (
  path: string,
  template: string,
  variables: TemplateVariablesNull,
): Promise<void> => {
  const finalTemplate = mustache.render(template, variables)
  return fs.outputFile(path, finalTemplate)
}

export interface InputVariable {
  key: string
  value: string
  protected?: boolean
}
export interface TemplateVariablesNull {
  [key: string]: string | null
}

const emptyToNullVariable = (variables: TemplateVariables): TemplateVariablesNull => {
  const variablesWithNull: TemplateVariablesNull = {}
  Object.keys(variables).map((variable) => (variablesWithNull[variable] = filters.trimOrNull(variables[variable])))
  return variablesWithNull
}

export const writeTemplateVariables = async (directory: string, variables: TemplateVariables) => {
  const filePaths = await getAllFilesFromDirectory(directory)
  const variablesWithNull = emptyToNullVariable(variables)

  return await R.pipe(
    R.map(async (filePath: string) => {
      const template = await fs.readFile(filePath, 'utf8')
      return _writeTemplateVariables(filePath, template, variablesWithNull)
    }),
    Promise.all.bind(Promise),
  )(filePaths)
}

export const renderTemplate = (template: string, variables: { [key: string]: string }): string =>
  mustache.render(template, variables)

export interface Template {
  name: string
  isDatabase: boolean
  path: string
}

export const getListOfTemplates = async (): Promise<Template[]> =>
  (await github.getListOfDirectories()).map(matchTypeOfTemplate)

const matchTypeOfTemplate = (path: string): Template => ({
  name: path.replace('-db', ''),
  isDatabase: path.endsWith('-db'),
  path,
})
