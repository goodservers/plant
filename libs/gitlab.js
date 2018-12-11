const Git = require('../libs/git');
const R = require('ramda');
const {
  GitlabAPI,
  spinner,
  callMatchingMethod,
  GITLAB_DOMAIN
} = require('../util');

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
  await GitlabAPI.Projects.all({ owned: true, search, others });

const getRemotes = async repository => {
  const remotes = await Git.getGitRemotes(repository);
  return remotes.filter(remoteName => remoteName.includes(GITLAB_DOMAIN));
};

const saveVariables = async (projectId, variables) =>
  R.pipe(
    R.map(variable => GitlabAPI.ProjectVariables.create(projectId, variable)),
    Promise.all.bind(Promise)
  )(variables);

module.exports = {
  createRepository,
  hasGitlabRemote,
  getRemotes,
  getRegistryUrl,
  getUserAndProjectName,
  getProjects,
  saveVariables
};
