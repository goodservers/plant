import fs from 'fs-extra';
import path from 'path';

export const getDirectoryPaths = (dir, filelist: string[] = []) => {
  const nDir = dir.endsWith('/') ? dir : `${dir}/`;
  let files = fs.readdirSync(nDir);
  filelist = filelist || [];
  files.forEach(file => {
    if (fs.statSync(nDir + file).isDirectory()) {
      filelist = getDirectoryPaths(`${nDir}${file}/`, filelist);
    } else {
      filelist.push(`${nDir}${file}`);
    }
  });
  return filelist;
};

export const pathToParent = path => path.replace(/(\.\/).*[^\/](.*)/, '');

export const copyFilesFromDirectoryToCurrent = async directory => {
  if (!path.isAbsolute(directory)) throw 'err';

  const currentDir = path.resolve(process.cwd());
  const filePaths = getDirectoryPaths(directory);
  return Promise.all(
    filePaths.map(
      async filePath =>
        await fs.copy(
          filePath,
          filePath.replace(directory, currentDir) //, {
          //   overwrite: true
          // }
        )
    )
  );
};

export const removeFolder = async directory =>
  await fs.remove(path.resolve(process.cwd(), directory));
