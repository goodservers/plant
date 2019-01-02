import fs from 'fs-extra'
import globby from 'globby'
import path from 'path'
import { FilePath } from '../types';

export const getAllFilesFromDirectory = async (directory: string) =>
  globby([`${directory}/**/.*`, `${directory}/**/*`, `${directory}/.deploy/**/*`], {
    expandDirectories: true,
  })

export const getEnvFiles = async (directory: string) =>
  globby([`${directory}/**/.env`, `${directory}/**/env.example`], {
    expandDirectories: false,
  })

export const getDirectoryPaths = (dir: string, fileList: string[] = []) => {
  const nDir = dir.endsWith('/') ? dir : `${dir}/`
  const files = fs.readdirSync(nDir)
  fileList = fileList || []
  files.forEach((file) => {
    if (fs.statSync(nDir + file).isDirectory()) {
      fileList = getDirectoryPaths(`${nDir}${file}/`, fileList)
    } else {
      fileList.push(`${nDir}${file}`)
    }
  })
  return fileList
}

export const pathToParent = (path: string) => path.replace(/(\.\/).*[^\/](.*)/, '')

export const copyFilesFromDirectoryToCurrent = async (directory: string): Promise<FilePath[]> => {
  const newPaths: FilePath[] = []
  if (!path.isAbsolute(directory)) {
    throw Error('copyFilesFromDirectoryToCurrent error')
  }
  const currentDir = path.resolve(process.cwd())
  const filePaths = getDirectoryPaths(directory)

  await Promise.all(
    filePaths.map(async (filePath) => {
      const newPath = filePath.replace(directory, currentDir)
      await fs.copy(
        filePath,
        newPath, // , {
        //   overwrite: trues
        // }
      )
      newPaths.push(newPath);
    }),
  )
  return newPaths;
}

export const removeFolder = async (directory: string) => await fs.remove(path.resolve(process.cwd(), directory))
