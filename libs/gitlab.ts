import { Remote, Repository } from 'nodegit'
import R from 'ramda'
import { TemplateVariables } from '../cmds/server'
import { GITLAB_DOMAIN, GitlabAPI } from '../util'
import * as git from './git'
import { CurrentUser, Project, Repository as GitlabRepository, SSHKey, Status, Variable } from './gitlab.types'

export const createRepository = (name: string, others: any): Promise<GitlabRepository> =>
  GitlabAPI.Projects.create({
    name,
    ...others,
  })

export const getRegistryDomain = () => `registry.${GITLAB_DOMAIN}`

export const hasGitlabRemote = async (repository: Repository) => {
  const remotes = await getRemotes(repository)
  // @ts-ignore FIXME:
  return remotes.some(R.identity())
}

export const getUserAndProjectName = (url: string) => {
  const found = url.match(/^.*[\/|:](.*\/.*)\.git$/)
  return found && found[1]
}

export const getProjects = async (search: string, ...others: any): Promise<Project[]> =>
  GitlabAPI.Projects.all({ owned: true, search, others })

export const isGitlabRemote = (remote: Remote): boolean => remote.url().includes(GITLAB_DOMAIN)

export const getRemotes = async (repository: Repository): Promise<Remote[]> => {
  const remotes = await git.getGitRemotes(repository)
  return remotes.filter(isGitlabRemote)
}

export const getVariablesKeys = (variables: Variable[]): string[] =>
  R.pipe(
    R.map(R.pick(['key'])),
    R.map(R.values),
    R.flatten,
  )(variables) as any

export const getProjectVariables = async (projectId: number): Promise<Variable[]> => GitlabAPI.ProjectVariables.all(projectId)

export const saveOrUpdateVariables = async (projectId: number, variables: TemplateVariables) => {
  const usedVariablesKeys = getVariablesKeys(await GitlabAPI.ProjectVariables.all(projectId))

  return R.pipe(
    Object.keys,
    R.applySpec({
      toCreate: R.pipe(
        R.filter((key: string) => !usedVariablesKeys.includes(key)) as any,
        R.map((key: string) => GitlabAPI.ProjectVariables.create(projectId, {
          key,
          value: variables[key],
        })),
      ),
      toUpdate: R.pipe(
        R.filter((key: string) => usedVariablesKeys.includes(key)) as any,
        R.map((key: string) =>
          GitlabAPI.ProjectVariables.edit(projectId, key, {
            value: variables[key],
          }),
        ),
      ),
    }) as any,
    R.map(R.values),
    R.flatten,
    Promise.all.bind(Promise),
  )(variables)
}

export const waitUntilPipelineStatus = async (
  projectId: number,
  sha1: string,
  firstStatus: (status: Status) => void,
  maxRetry = 60,
  timeout = 25000,
): Promise<boolean> => {
  let count = 0

  return new Promise((resolve, reject) => {
    const retry = async (maxRetry: number, timeout: number) => {
      const status: Status[] = await GitlabAPI.Commits.status(projectId, sha1)
      if (count === 0) {
        firstStatus(status[0])
      }

      const allFinished = status.every((item: Status) => item.status === 'success')
      const someError = status.find((item: Status) => item.status === 'failed')
      if (someError) {
        reject(someError.id)
        return
      }

      if (allFinished) {
        resolve(true)
      } else if (count++ < maxRetry) {
        return setTimeout(() => {
          retry(maxRetry, timeout)
        }, timeout)
      }
    }
    retry(maxRetry, timeout)
  })
}

export const getUserSSHKeys = async (currentUser: CurrentUser): Promise<SSHKey[]> => GitlabAPI.UserKeys.all(currentUser)

export const hasUserSomeSSHKeys = async (currentUser: CurrentUser): Promise<boolean> =>
  (await GitlabAPI.UserKeys.all(currentUser)).some(R.identity)
