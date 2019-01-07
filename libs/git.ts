import { Commit, Cred, Oid, Reference, Remote, Repository, Signature, StatusFile } from 'nodegit'
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

const getParentCommit = async (repository: Repository): Promise<Commit | null> => {
  try {
    const head = await Reference.nameToId(repository, 'HEAD')
    return repository.getCommit(head)
  } catch (error) {
    return null
  }
}

export const isNewRepository = async (repository: Repository): Promise<boolean> => R.isNil(await getParentCommit(repository))

export const commit = async (repository: Repository, oid: Oid,  message: string): Promise<Oid | undefined> => {
  try {
    const author = Signature.default(repository)
    const committer = author
    const parent = await getParentCommit(repository)
    return repository.createCommit('HEAD', author, committer, message, oid, !R.isNil(parent) ? [parent] : [])
  } catch (error) {
    console.log('error', error)
  }
}

export const addFilesToCommit = async (repository: Repository, files: string[]): Promise<Oid> => {
    const index = await repository.refreshIndex()
    await Promise.all(files.map((file) => index.addByPath(file)))
    await index.write()
    return await index.writeTree()
}

export const addStatusFilesToCommit = async (repository: Repository) => {
  const repositoryStatus = await repository.getStatus()
  const unstagedFilesToCommit = repositoryStatus.map((file: StatusFile) => file.path())
  return addFilesToCommit(repository, unstagedFilesToCommit)
}
