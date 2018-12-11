const fs = require('fs-extra');
const R = require('ramda');
const path = require('path');
const { fetchJson, fetchText } = require('./fetch');
const { GITLAB_DOMAIN } = require('../util');

const REPO = 'goodservers/docker-apps';
const API_URL = `https://api.github.com/`;
const API_REPOSITORY = `${API_URL}repos/${REPO}/`;
const REPO_RAW = `https://raw.githubusercontent.com/${REPO}/master/`;

module.exports.getApiLimit = async () => {
  const limits = await R.pipe(
    fetchJson,
    R.then(R.identity)
  )(`${API_URL}/rate_limit`);

  return R.pipe(
    R.path(['resources', 'core', 'remaining']),
  )(limits);
};

module.exports.getListOfDirectories = async () => {
  const list = await R.pipe(
    fetchJson,
    R.then(R.identity)
  )(`${API_REPOSITORY}contents/`);

  return R.pipe(
    R.filter(object => object.type === 'dir'),
    R.map(R.pick(['path'])),
    R.map(R.values),
    R.flatten
  )(list);
};

const getRepositoryFiles = async () => {
  const contents = await fetchJson(
    `${API_REPOSITORY}git/trees/master?recursive=1`
  );

  return R.pipe(
    R.prop('tree'),
  )(contents);
};

module.exports.getTemplateFiles = async (path = '') => {
  const repoFiles = await getRepositoryFiles();

  return R.pipe(
    R.filter(item => item.path.startsWith(path)),
    R.filter(item => item.type === 'blob'),
    R.map(item =>
      R.merge(item, {
        download: `${REPO_RAW}${
          item.path
        }`
      })
    )
  )(repoFiles);
};

module.exports.downloadTemplateFiles = (directory) => async dirContent =>
  R.pipe(
    R.map(async item => {
      const content = await fetchText(item.download);
      const filePath = path.resolve(directory, item.path);
      console.log(filePath);
      return fs.outputFile(filePath, content);
    }),
    Promise.all.bind(Promise)
  )(dirContent);
