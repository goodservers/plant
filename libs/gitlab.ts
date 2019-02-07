import { Remote, Repository } from 'nodegit'
import R from 'ramda'
import * as server from '../cmds/server'
import { pairVariables, VariablesContext } from '../prompts/variables';
import { GITLAB_DOMAIN, GitlabAPI, TMP_DIRECTORY } from '../util'
import * as git from './git'
import { CurrentUser, Project, SSHKey, Status, Variable } from './gitlab.types'
import * as template from './template'

export const createRepository = (name: string, others: any): Promise<Project> =>
  GitlabAPI.Projects.create({
    name,
    ...others,
  })

export const deleteRepository = (projectId: number): Promise<Project> =>
  GitlabAPI.Projects.remove(projectId)

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

export const getProjectVariables = async (projectId: number): Promise<server.TemplateVariables> =>
  (await GitlabAPI.ProjectVariables.all(projectId)).reduce(
    (acc: server.TemplateVariables, item: Variable) => ({ ...acc, [item.key]: item.value }),
    {},
  )

export const saveOrUpdateVariables = async (projectId: number, variables: server.TemplateVariables) => {
  const usedVariablesKeys = getVariablesKeys(await GitlabAPI.ProjectVariables.all(projectId))

  return R.pipe(
    Object.keys,
    R.applySpec({
      toCreate: R.pipe(
        R.filter((key: string) => !usedVariablesKeys.includes(key)) as any,
        R.map((key: string) =>
          GitlabAPI.ProjectVariables.create(projectId, {
            key,
            value: variables[key],
          }),
        ),
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
      console.log(count, status)
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


export const waitUntilFinishedPipeline = async (
  repository: Repository,
  projectId: number,
  firstStatus: (status: Status) => any,
): Promise<false | number> => {
  const branch = await repository.getCurrentBranch()
  const commitSha = (await repository.getReferenceCommit(branch)).sha()
  try {
    await waitUntilPipelineStatus(projectId, commitSha, firstStatus)
    return false
  } catch (pipelineID) {
    return pipelineID
  }
}

export const getVariablesForServer = async (groupId: number): Promise<server.TemplateVariables> =>
  (await GitlabAPI.GroupVariables.all(groupId))
    .map((variable: Variable) => ({ [variable.key]: variable.value }))
    .reduce(R.merge, {})


export const fillVariables = async (
  remoteUrl: string,
  projectId: number,
  serverId: number,
  selectedTemplate: template.Template,
  variablesContext: Partial<VariablesContext>,
): Promise<server.TemplateVariables> => {
  const serverVariables = await getVariablesForServer(serverId)

  const knownVariables = {
    ...serverVariables,
    REGISTRY_URL: `${getRegistryDomain()}/${getUserAndProjectName(remoteUrl)}`,
  }

  const templateVariables = await template.getTemplateVariables(`${TMP_DIRECTORY}/${selectedTemplate.path}`)
  const neededTemplateVariables = templateVariables.filter(
    (variable) => !Object.keys(knownVariables).includes(variable),
  )

  const userVariables = await pairVariables(R.uniq(neededTemplateVariables), {
    ...variablesContext,
    serverDomainOrIp: serverVariables.DEPLOYMENT_SERVER_IP,
  } as VariablesContext)

  const variables = {
    ...knownVariables,
    ...userVariables,
  }

  await template.writeTemplateVariables(`${TMP_DIRECTORY}/${selectedTemplate.path}`, variables)
  await saveOrUpdateVariables(projectId, serverVariables)

  return variables
}
