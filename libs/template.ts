import fs from 'fs-extra'
import globby from 'globby'
import mustache from 'mustache'
import R from 'ramda'
import { TemplateVariables } from '../cmds/server'
import { filters } from '../prompts/inputs'

export const _getTemplateVariabless = (checkedToken: string) => (template: string) => {
  const tokens = mustache.parse(template)

  return R.pipe(
    R.filter(([key]) => key === checkedToken),
    R.map((token) => R.pathOr('', ['1'], token).split('.')),
    R.flatten,
    R.uniq,
    R.values,
  )(tokens) as any
}

export const getRequiredVariables = _getTemplateVariabless('name')
export const getOptionalVariables = _getTemplateVariabless('#')

export const getFilesFromDirectory = async (directory: string) =>
  globby([`${directory}/**/.*`, `${directory}/**/*`, `${directory}/.deploy/**/*`], {
    expandDirectories: true,
  })

export const getTemplateVariabless = async (directory: string) => {
  const files = await getFilesFromDirectory(directory)
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
  const filePaths = await getFilesFromDirectory(directory)
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
