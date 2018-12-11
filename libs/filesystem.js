const fs = require('fs-extra');
const path = require('path');

const getDirectoryPaths = (dir, filelist) => {
  const nDir = dir.endsWith('/') ? dir : dir + '/';
  var files = fs.readdirSync(nDir);
  filelist = filelist || [];
  files.forEach(function(file) {
    if (fs.statSync(nDir + file).isDirectory()) {
      filelist = getDirectoryPaths(nDir + file + '/', filelist);
    } else {
      filelist.push(nDir + file);
    }
  });
  return filelist;
};

const pathToParent = path => path.replace(/(\.\/).*[^\/](.*)/, '');

const copyFilesFromDirectoryToCurrent = async directory => {
  if (!path.isAbsolute(directory)) throw 'err';

  const currentDir = path.resolve(process.cwd());
  const filePaths = getDirectoryPaths(directory);
  return Promise.all(
    filePaths.map(async filePath => {
      return await fs.copy(
        filePath,
        filePath.replace(directory, currentDir, {
          overwrite: true
        })
      );
    })
  );
};

const removeFolder = async directory =>
  await fs.remove(path.resolve(process.cwd(), directory));

module.exports = {
  copyFilesFromDirectoryToCurrent,
  removeFolder
};
