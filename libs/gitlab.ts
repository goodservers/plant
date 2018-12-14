import R from 'ramda';
import * as Git from './git';
import { GitlabAPI, GITLAB_DOMAIN } from '../util';
import { Repository } from 'nodegit';

export const createRepository = (name: string, ...others: any) =>
  GitlabAPI.Projects.create({
    name,
    ...others
  });

export const getRegistryDomain = () => `registry.${GITLAB_DOMAIN}`;

export const hasGitlabRemote = async (repository: Repository) => {
  const remotes = await getRemotes(repository);
  // @ts-ignore FIXME:
  return remotes.some(R.identity());
};

export const getUserAndProjectName = (url: string) => {
  const found = url.match(/^.*\/(.*\/.*)\.git$/);
  return found && found[1];
};

export const getProjects = async (search: string, ...others: any) =>
  GitlabAPI.Projects.all({ owned: true, search, others });

export const getRemotes = async (repository: Repository) => {
  const remotes = await Git.getGitRemotes(repository);
  return remotes.filter(remoteName => remoteName.includes(GITLAB_DOMAIN));
};
export const objFromListWith = R.curry((fn: any, list: any[]) =>
  // @ts-ignore FIXME:
  R.chain(R.zipObj, R.map(fn))(list)
);

export const getVariablesKeys = (variables: Variable[]): string[] =>
  R.pipe(
    R.map(R.pick(['key'])),
    R.map(R.values),
    R.flatten
  )(variables) as any;

interface Variable { key: string, value: string }

export const saveOrUpdateVariables = async (projectId: number, variables: Variable[]) => {
  const keyVariables = objFromListWith(R.prop('key'), variables);

  const usedVariablesKeys = getVariablesKeys(
    await GitlabAPI.ProjectVariables.all(projectId)
  );

  return R.pipe(
    getVariablesKeys,
    R.applySpec({
      toCreate: R.pipe(
        R.filter((key: string) => !usedVariablesKeys.includes(key)) as any,
        R.map(key =>
          GitlabAPI.ProjectVariables.create(projectId, keyVariables[key])
        )
      ),
      toUpdate: R.pipe(
        R.filter((key: string) => usedVariablesKeys.includes(key)) as any,
        R.map(key =>
          GitlabAPI.ProjectVariables.edit(projectId, key, {
            value: keyVariables[key].value
          })
        )
      )
    }) as any,
    R.map(R.values),
    R.flatten,
    Promise.all.bind(Promise)
  )(variables);
};
