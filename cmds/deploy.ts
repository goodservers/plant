import chalk from 'chalk'
import { Remote, Repository } from 'nodegit'
import R from 'ramda'
import tmp from 'tmp'
import * as filesystem from '../libs/filesystem'
import * as git from '../libs/git'
import * as github from '../libs/github'
import * as gitlab from '../libs/gitlab'
import * as template from '../libs/template'
import { repositoryName } from '../prompts/create'
import * as gitlabPrompt from '../prompts/gitlab'
import { selectTemplate } from '../prompts/templates'
import { pairVariables } from '../prompts/variables'
import { spinner } from '../util'
import * as server from './server'
import { objFromListWith } from '../libs/helpers';

export const tmpDirectory = tmp.dirSync()

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
      await Remote.create(repository, 'deploy', newRepo.http_url_to_repo)

      if (newRepo.http_url_to_repo) {
        spinner.stop()
        spinner.succeed(`New repository ${chalk.bold(newRepo.name_with_namespace)} is created. 🎉`)
      }
    }

    // TODO: selecting template
    const selectedTemplate = await selectTemplate()
    await R.pipeP(
      github.getTemplateFiles,
      github.downloadTemplateFiles(tmpDirectory.name),
    )(selectedTemplate.name)

    const selectedServer = await server.listOrCreate()
    const serverVariables = await server.getVariablesForServer(selectedServer.name)
    // console.log('serverVariables', serverVariables);

    const gitlabRemotes = await gitlab.getRemotes(repository)

    const remoteUrl =
      gitlabRemotes.length > 1
        ? (await gitlabPrompt.selectRightGitlabRemote(gitlabRemotes.map((remote) => ({ name: remote, value: remote }))))
            .name
        : gitlabRemotes[0]

    // TODO: get variables from .env?
    const registryVariables = {
      REGISTRY_URL: `${gitlab.getRegistryDomain()}/${gitlab.getUserAndProjectName(remoteUrl)}`,
    }

    const templateVariables = await template.getTemplateVariables(`${tmpDirectory.name}/${selectedTemplate.name}`)
    const neededTemplateVariables = templateVariables.filter(
      (variable) => ![...server.SERVER_VARIABLES, 'REGISTRY_URL'].includes(variable),
    )
    const keyVariables: { [key: string]: server.GitlabVariable } = objFromListWith(R.prop('key'), serverVariables)
    const userVariables = await pairVariables(neededTemplateVariables, { serverDomainOrIp: keyVariables.DEPLOYMENT_SERVER_IP.value })

    await template.writeTemplateVariables(
      `${tmpDirectory.name}/${selectedTemplate.name}`,
      Object.assign(serverVariables, registryVariables, userVariables),
    )

    // copy and remove
    await filesystem.copyFilesFromDirectoryToCurrent(`${tmpDirectory.name}/${selectedTemplate.name}`)
    await filesystem.removeFolder(tmpDirectory.name)

    const projects = await gitlab.getProjects(git.getProjectName(remoteUrl))
    const projectId = projects[0].id
    await gitlab.saveOrUpdateVariables(projectId, serverVariables)

    // const newGroup = await gitlabAPI.Groups.create({
    //   name: name,
    //   path: name,
    // })

    // TODO: for dbs
    // if (!isGit) {
    //   const repository = await Repository.init(`./${selectedTemplate.name}`, 0);
    //   // const newRepo = await creategitlabRepo(selectedTemplate.name);
    //   // // create git remote
    //   // await Remote.create(repository, 'deploy', newRepo.http_url_to_repo);
    // }

    // await R.pipeP(
    //   Template.getTemplateVariablesFromDirectory,
    //   pairValues,
    //   Template.writeTemplateVariablesToDirectory(selectedTemplate.name),
    // )(selectedTemplate.name);

    // console.log('x', x, y);

    // const directories = await github.getListOfDirectories()
    // const dirContent = await github.getDirContent('mongo')
    // github.createDirStructure(dirContent)
    // console.log('dirContent', dirContent);

    // const projects = await gitlabAPI.Projects.all({ owned: true, search: 'test' })
    // console.log('found',  projects);

    // const newRepo = await creategitlabRepo('test2');
    // console.log('newRepo', newRepo.http_url_to_repo, newRepo.ssh_url_to_repo);
    // if (newRepo.http_url_to_repo) {
    //   spinner.succeed(`New repository ${chalk.bold(newRepo.name_with_namespace)} is created. 🎉`);
    //   // spinner.succeed(`New repository ${chalk.bold(newRepo.web_url)}. 🎉`);
    // }

    // remove temp dir
    // tmpDirectory.removeCallback();
    await filesystem.removeFolder(tmpDirectory.name)
  } catch (error) {
    await filesystem.removeFolder(tmpDirectory.name)
    // tmpDirectory.removeCallback();
    spinner.stop()
    spinner.fail(error)
  }
}
