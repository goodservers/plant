const { Repository, Remote } = require('nodegit');
const R = require('ramda');

const isGitRepository = async (path) => {
  try {
    await Repository.open(path);
  } catch (error) {
    return false;
  }
  return true;
}

const getGitRemotes = async repository => {
  const remotes = await repository.getRemotes();

  return R.pipe(
    R.map(remoteName => Remote.lookup(repository, remoteName)),
    Promise.all.bind(Promise),
    R.then(R.map(remote => remote.url()))
  )(remotes);
};

const getProjectName = url => {
  const found = url.match(/^.*\/(.*)\.git$/);
  return found[1];
};


module.exports = {
  getGitRemotes,
  getProjectName,
  isGitRepository,
}
