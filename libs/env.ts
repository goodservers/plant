import fs from 'fs-extra'
import R from 'ramda'

interface EnvVariables {
  [key: string]: string
}

export const parseEnvVariables = async (files: string[]): Promise<EnvVariables> => {
  const filesP = await R.pipe(
    R.map(async (filePath: string) => {
      const content = await fs.readFile(filePath, 'utf8')
      return parseEnv(content)
    }),
    Promise.all.bind(Promise),
  )(files) as EnvVariables[]

  return R.reduce((acc, current) => ({ ...acc, ...current }), {}, filesP) as EnvVariables
}

const parseEnv = (content: string): EnvVariables =>
  content
    .split('\n')
    .filter((x) => !R.isEmpty(x))
    .map(parseEnvRow)
    .reduce((acc, current) => ({ ...acc, ...current }))

const parseEnvRow = (row: string): any => {
  const envArr = row.split(/=(.+)?/)

  // clean up value, extracting from quotation if necessary
  if (!envArr[1]) {
    envArr[1] = ''
  }
  const val = envArr[1].replace(/^['"]/, '').replace(/['"]$/, '')

  return {
    [envArr[0]]: val,
  }
}
