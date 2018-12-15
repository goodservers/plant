import { Remote, Repository } from 'nodegit'
import R from 'ramda'

export const isGitRepository = async (path: string) => {
  try {
    await Repository.open(path)
  } catch (error) {
    return false
  }
  return true
}

export const getGitRemotes = async (repository: Repository): Promise<string[]> => {
  const remotes = (await repository.getRemotes()) as any // FIXME: wrong typings in nodegit?, should be string[]
  return R.pipe(
    R.map((remote: string) => Remote.lookup(repository, remote)),
    Promise.all.bind(Promise),
    // @ts-ignore // FIXME:
    R.then(R.map((remote: Remote) => remote.url())),
  )(remotes) as Promise<string[]>
}

export const getProjectName = (url: string): string => {
  const found = url.match(/^.*\/(.*)\.git$/)
  return (found && found[1]) || ''
}
