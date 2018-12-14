import fs from 'fs-extra';
import R from 'ramda';
import path from 'path';
import { fetchJson, fetchText } from './fetch';
import { GITLAB_DOMAIN } from '../util';

export const REPO = 'goodservers/docker-apps';
export const API_URL = `https://api.github.com/`;
export const API_REPOSITORY = `${API_URL}repos/${REPO}/`;
export const REPO_RAW = `https://raw.githubusercontent.com/${REPO}/master/`;

export const getApiLimit = async () => {
  const limits = await R.pipe(
    fetchJson,
    // @ts-ignore FIXME:
    R.then(R.identity)
  )(`${API_URL}/rate_limit`);

  return R.pipe(R.path(['resources', 'core', 'remaining']))(limits);
};

export const getListOfDirectories = async () => {
  const list = await R.pipe(
    fetchJson,
    // @ts-ignore FIXME:
    R.then(R.identity)
  )(`${API_REPOSITORY}contents/`);

  return R.pipe(
    // @ts-ignore FIXME:
    R.filter(object => object.type === 'dir'),
    R.map(R.pick(['path'])),
    R.map(R.values),
    R.flatten
  )(list);
};

type GithubFile = {
  path: string;
  mode: string;
  type: string;
  sha: string;
  size: number;
  url: string;
  download: string;
};

export const getRepositoryFiles = async (): Promise<GithubFile[]> => {
  const contents = await fetchJson(
    `${API_REPOSITORY}git/trees/master?recursive=1`
  );
  return contents.tree;
};

export const getTemplateFiles = async (path = '') => {
  const repoFiles = await getRepositoryFiles();

  return R.pipe(
    // @ts-ignore FIXME:
    R.filter((item: GithubFile) => item.path.startsWith(path) && item.type === 'blob'),
    R.map(item =>
      R.merge(item, {
        download: `${REPO_RAW}${item.path}`
      })
    )
  )(repoFiles);
};

export const downloadTemplateFiles = (directory: string) => async (dirContent: GithubFile[]) =>
  R.pipe(
    R.map(async (item: GithubFile) => {
      const content = await fetchText(item.download);
      const filePath = path.resolve(directory, item.path);
      console.log(filePath);
      return fs.outputFile(filePath, content);
    }),
    Promise.all.bind(Promise)
  )(dirContent);
