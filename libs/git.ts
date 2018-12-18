import { Cred, Oid, Reference, Remote, Repository, Signature, Commit } from 'nodegit'
import R from 'ramda'

export const isGitRepository = async (path: string): Promise<boolean> => {
  try {
    await Repository.open(path)
  } catch (error) {
    return false
  }
  return true
}

export const getGitRemotes = async (repository: Repository): Promise<Remote[]> => {
  const remotes = (await repository.getRemotes()) as any // FIXME: wrong typings in nodegit?, should be string[]
  return R.pipe(
    R.map((remote: string) => Remote.lookup(repository, remote)),
    Promise.all.bind(Promise),
    // @ts-ignore // FIXME:
    // R.then(R.map((remote: Remote) => remote.url())),
  )(remotes) as Promise<Remote[]>
}

export const getGitRemote = async (repository: Repository, remote: string): Promise<Remote> =>
  Remote.lookup(repository, remote)

export const getProjectSlug = (remoteUrl: string): string => {
  const found = remoteUrl.match(/^.*\/(.*)\.git$/)
  return (found && found[1]) || ''
}

export const push = async (remote: Remote, remoteName = 'master'): Promise<number> => {
  return remote.push([`refs/heads/${remoteName}:refs/heads/${remoteName}`], {
    callbacks: {
      credentials: (_, userName) => {
        return Cred.sshKeyFromAgent(userName)
      },
    },
  })
}

const getParent = async (repository: Repository): Promise<Commit[]> => {
  try {
    const head = await Reference.nameToId(repository, 'HEAD')
    const parent = await repository.getCommit(head)
    return [parent]
  } catch (error) {
    return []
  }
}

export const createCommit = async (
  repository: Repository,
  files: string[],
  message: string,
): Promise<Oid | undefined> => {
  try {
    const index = await repository.refreshIndex()
    await Promise.all(files.map((file) => index.addByPath(file)))
    await index.write()
    const oid = await index.writeTree()
    const author = Signature.default(repository)
    const committer = author
    const parent = await getParent(repository)
    return repository.createCommit('HEAD', author, committer, message, oid, parent)
  } catch (error) {
    console.log('errror', error)
  }
}
