import fs from 'fs-extra'
import path from 'path'

export const getDirectoryPaths = (dir: string, filelist: string[] = []) => {
  const nDir = dir.endsWith('/') ? dir : `${dir}/`
  const files = fs.readdirSync(nDir)
  filelist = filelist || []
  files.forEach((file) => {
    if (fs.statSync(nDir + file).isDirectory()) {
      filelist = getDirectoryPaths(`${nDir}${file}/`, filelist)
    } else {
      filelist.push(`${nDir}${file}`)
    }
  })
  return filelist
}

export const pathToParent = (path: string) => path.replace(/(\.\/).*[^\/](.*)/, '')

export const copyFilesFromDirectoryToCurrent = async (directory: string) => {
  if (!path.isAbsolute(directory)) {
    throw Error('copyFilesFromDirectoryToCurrent error')
  }
  const currentDir = path.resolve(process.cwd())
  const filePaths = getDirectoryPaths(directory)
  return Promise.all(
    filePaths.map(
      async (filePath) =>
        await fs.copy(
          filePath,
          filePath.replace(directory, currentDir), // , {
          //   overwrite: trues
          // }
        ),
    ),
  )
}

export const removeFolder = async (directory: string) => await fs.remove(path.resolve(process.cwd(), directory))
