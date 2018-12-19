import chalk from 'chalk'
import { Remote, Repository, StatusFile } from 'nodegit'
import R from 'ramda'
import tmp from 'tmp'
import * as filesystem from '../libs/filesystem'
import * as git from '../libs/git'
import * as github from '../libs/github'
import * as gitlab from '../libs/gitlab'
import { Status } from '../libs/gitlab.types'
import * as template from '../libs/template'
import { confirm, repositoryName, selectGitlabProject } from '../prompts/create'
import * as gitlabPrompt from '../prompts/gitlab'
import { selectTemplate } from '../prompts/templates'
import { pairVariables } from '../prompts/variables'
import { CURRENT_USER, GITLAB_DOMAIN, spinner } from '../util'
import * as server from './server'

export const tmpDirectory = tmp.dirSync()
const tempDirectory = tmpDirectory.name

export const init = async () => {
  try {
    const isGit = await git.isGitRepository('.')

    const repository = isGit ? await Repository.open('.') : await Repository.init(`.`, 0)
    if (!(await gitlab.hasGitlabRemote(repository))) {
      const project = await repositoryName()
      const newRepo = await gitlab.createRepository(project.name, {
        container_registry_enabled: true,
      })

      spinner.start('Creating gitlab repository...')

      // create git remote
      await Remote.create(repository, 'deploy', newRepo.ssh_url_to_repo)

      if (newRepo.http_url_to_repo) {
        spinner.stop()
        spinner.succeed(`New repository ${chalk.bold(newRepo.name_with_namespace)} is created. 🎉`)
      }
    }
    const repositoryStatus = await repository.getStatus();
    const unstagedFilesToCommit = repositoryStatus.map((file: StatusFile) => file.path())
    const oid = await git.addFilesToCommit(repository, unstagedFilesToCommit)
    if (await git.isNewRepository(repository)) {
      git.commit(repository, oid, 'Init 🌱')
    }
    // else {
    //   const commitChanges = await confirm('Do you want to commit your unstaged changes? (required)')
    //   if (commitChanges.confirm) {
    //     git.commit(repository, oid, )
    //   }
    // }

    const { name: templateName } = await selectTemplate()
    await R.pipeP(
      github.getTemplateFiles,
      github.downloadTemplateFiles(tempDirectory),
    )(templateName)

    const { name: serverName } = await server.listOrCreate()
    const serverVariables = await server.getVariablesForServer(serverName)
    const gitlabRemotes = await gitlab.getRemotes(repository)

    // @TODO filter remotes with my username only
    const remoteName =
      gitlabRemotes.length > 1
        ? (await gitlabPrompt.selectRightGitlabRemote(
            gitlabRemotes.map((remote: Remote) => ({ name: remote.name() + ' ' + remote.url(), value: remote.name() })),
          )).name
        : gitlabRemotes[0].name()

    const remote = await git.getGitRemote(repository, remoteName)
    const projectSlug = git.getProjectSlug(remote.url())
    const projects = await gitlab.getProjects(projectSlug)

    const gitlabProject = projects.length > 1 ? (await selectGitlabProject(projects)).project : projects[0]
    const projectId = gitlabProject.id

    // TODO: Initiate dbs
    // TODO: Get variables from .env?
    const registryVariables = {
      REGISTRY_URL: `${gitlab.getRegistryDomain()}/${gitlab.getUserAndProjectName(remote.url())}`,
    } as server.TemplateVariables

    const TemplateVariabless = await template.getTemplateVariabless(`${tempDirectory}/${templateName}`)
    const neededTemplateVariabless = TemplateVariabless.filter(
      (variable) => ![...server.SERVER_VARIABLES, ...Object.keys(registryVariables)].includes(variable),
    )
    const userVariables = await pairVariables(neededTemplateVariabless, {
      currentUser: CURRENT_USER,
      projectName: projectSlug,
      serverDomainOrIp: serverVariables.DEPLOYMENT_SERVER_IP,
    })

    await template.writeTemplateVariables(`${tempDirectory}/${templateName}`, {
      ...serverVariables,
      ...registryVariables,
      ...userVariables,
    })

    // Copy and remove
    const filesToCommit = await filesystem.copyFilesFromDirectoryToCurrent(`${tempDirectory}/${templateName}`)
    await filesystem.removeFolder(tempDirectory)

    await gitlab.saveOrUpdateVariables(projectId, serverVariables)

    // Commit and wait for pipeline
    const commitChanges = await confirm('Do you want to commit and push your changes to deploy?')
    if (commitChanges.confirm) {
      const relativeFilesToCommit = filesToCommit.map((filePath) => filePath.replace(process.cwd() + '/', ''))

      const hasSSHKey = await gitlab.hasUserSomeSSHKeys(CURRENT_USER)
      if (!hasSSHKey) {
        spinner.warn(
          `Plase upload your public ssh key into you Gitlab repository. Visit https://${GITLAB_DOMAIN}/profile/keys.`,
        )
      }

      const oid = await git.addFilesToCommit(repository, relativeFilesToCommit)
      await git.commit(repository, oid, 'Deploy with 🌱 plant 🎉')
      await git.push(remote)

      spinner.start(`Waiting until pipeline will be finished (takes around 2-5 minutes)`)

      const branch = await repository.getCurrentBranch()
      const commitSha = (await repository.getReferenceCommit(branch)).sha()
      try {
        await gitlab.waitUntilPipelineStatus(projectId, commitSha, (status: Status) => {
          spinner.start(
            `Pipeline for deploy started, you can check pipeline status on web: ${
              CURRENT_USER.web_url
            }/${projectSlug}/-/jobs/${status.id}`,
          )
        })
        spinner.stop()
        spinner.succeed(`Your project is deployed 🎉 visit: http://${userVariables.VIRTUAL_HOST}`)
      } catch (pipelineID) {
        spinner.stop()
        spinner.fail(`Something wrong happened, see ${CURRENT_USER.web_url}/${projectSlug}/-/jobs/${pipelineID}`)
      }
    }

    // remove temp dir
    // tmpDirectory.removeCallback();
    await filesystem.removeFolder(tempDirectory)
  } catch (error) {
    await filesystem.removeFolder(tempDirectory)
    // tmpDirectory.removeCallback();
    spinner.stop()
    spinner.fail(error)
  }
}
