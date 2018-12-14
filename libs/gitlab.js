const R = require('ramda');
const Git = require('./git');
const { GitlabAPI, GITLAB_DOMAIN } = require('../util');

const createRepository = (name, ...others) =>
  GitlabAPI.Projects.create({
    name,
    ...others
  });

const getRegistryUrl = () => `registry.${GITLAB_DOMAIN}`;

const hasGitlabRemote = async repository => {
  const remotes = await getRemotes(repository);
  return remotes.some(R.identity());
};

const getUserAndProjectName = url => {
  const found = url.match(/^.*\/(.*\/.*)\.git$/);
  return found[1];
};

const getProjects = async (search, ...others) =>
  GitlabAPI.Projects.all({ owned: true, search, others });

const getRemotes = async repository => {
  const remotes = await Git.getGitRemotes(repository);
  return remotes.filter(remoteName => remoteName.includes(GITLAB_DOMAIN));
};

const objFromListWith = R.curry((fn, list) =>
  R.chain(R.zipObj, R.map(fn))(list)
);

const getVariablesKeys = variables =>
  R.pipe(
    R.map(R.pick(['key'])),
    R.map(R.values),
    R.flatten
  )(variables);

const saveOrUpdateVariables = async (projectId, variables) => {
  const keyVariables = objFromListWith(R.prop('key'), variables);

  const usedVariablesKeys = getVariablesKeys(
    await GitlabAPI.ProjectVariables.all(projectId)
  );

  return R.pipe(
    getVariablesKeys,
    R.applySpec({
      toCreate: R.pipe(
        R.filter(key => !usedVariablesKeys.includes(key)),
        R.map(key =>
          GitlabAPI.ProjectVariables.create(projectId, keyVariables[key])
        )
      ),
      toUpdate: R.pipe(
        R.filter(key => usedVariablesKeys.includes(key)),
        R.map(key =>
          GitlabAPI.ProjectVariables.edit(projectId, key, {
            value: keyVariables[key].value
          })
        )
      )
    }),
    R.map(R.values),
    R.flatten,
    Promise.all.bind(Promise)
  )(variables);
};

module.exports = {
  createRepository,
  hasGitlabRemote,
  getRemotes,
  getRegistryUrl,
  getUserAndProjectName,
  getProjects,
  saveOrUpdateVariables
};
