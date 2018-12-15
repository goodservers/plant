import fs from 'fs-extra'
import globby from 'globby'
import mustache from 'mustache'
import R from 'ramda'

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

export const getFilesFromDirectory = async (directory: string) =>
  globby([`${directory}/**/.*`, `${directory}/**/*`, `${directory}/.deploy/**/*`], {
    expandDirectories: true,
  })

export const getTemplateVariables = async (directory: string) => {
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
  variables: { [key: string]: string },
): Promise<void> => {
  const finalTemplate = mustache.render(template, variables)
  return fs.outputFile(path, finalTemplate)
}

export const writeTemplateVariables = async (directory: string, variables: { [key: string]: string }) => {
  const filePaths = await getFilesFromDirectory(directory)
  return await R.pipe(
    R.map(async (filePath: string) => {
      const template = await fs.readFile(filePath, 'utf8')
      return _writeTemplateVariables(filePath, template, variables)
    }),
    Promise.all.bind(Promise),
  )(filePaths)
}

export const renderTemplate = (template: string, variables: { [key: string]: string }): string =>
  mustache.render(template, variables)
