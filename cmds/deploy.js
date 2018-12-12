const chalk = require('chalk');
const { Remote, Repository } = require('nodegit');
const R = require('ramda');
const { GitlabAPI, spinner, callMatchingMethod } = require('../util');
const { repositoryName } = require('../prompts/create');
const gitlabPrompt = require('../prompts/gitlab');
const server = require('./server');
const { pairVariables } = require('../prompts/variables');
const { selectTemplate } = require('../prompts/templates');
const Git = require('../libs/git');
const filesystem = require('../libs/filesystem');
const Github = require('../libs/github');
const Gitlab = require('../libs/gitlab');
const Template = require('../libs/template');
const tmp = require('tmp');

var tmpDirectory = tmp.dirSync();

const getFolderName = filename => {
  return path
    .dirname(filename)
    .split(path.sep)
    .pop();
};

module.exports.init = async () => {
  try {
    const isGit = await Git.isGitRepository('.');

    const repository = isGit
      ? await Repository.open('.')
      : await Repository.init(`.`, 0);

    spinner.start('Checking repository...');

    if (!(await Gitlab.hasGitlabRemote(repository))) {
      // const remotes = await getGitRemotes(repository);

      // @TODO agree with project name
      // const projectName = getProjectName(R.last(remotes));
      // const projectName = 'plant-cli'

      const project = await repositoryName();
      const newRepo = await Gitlab.createRepository(project.name, {
        container_registry_enabled: true
      });

      spinner.start('Creating gitlab repository...');

      // create git remote
      await Remote.create(repository, 'deploy', newRepo.http_url_to_repo);

      if (newRepo.http_url_to_repo) {
        spinner.stop();
        spinner.succeed(
          `New repository ${chalk.bold(
            newRepo.name_with_namespace
          )} is created. 🎉`
        );
      }
    }
    spinner.stop();

    // TODO: selecting template
    const selectedTemplate = await selectTemplate();
    await R.pipeP(
      Github.getTemplateFiles,
      Github.downloadTemplateFiles(tmpDirectory.name)
    )(selectedTemplate.name);

    // TODO: if server list is empty, create new
    const selectedServer = await server.list();
    const serverVariables = await server.getVariablesForServer(
      selectedServer.name
    );
    // console.log('serverVariables', serverVariables);

    const gitlabRemotes = await Gitlab.getRemotes(repository);

    const remoteUrl =
      gitlabRemotes.length > 1
        ? (await gitlabPrompt.selectRightGitlabRemote(
            gitlabRemotes.map(remote => ({ name: remote, value: remote }))
          )).name
        : R.last(gitlabRemotes);

    // FIXME: get variables
    const registryVariables = {
      REGISTRY_URL:
        Gitlab.getRegistryUrl() + '/' + Gitlab.getUserAndProjectName(remoteUrl)
    };

    const templateVariables = await Template.getTemplateVariables(
      tmpDirectory.name + "/" + selectedTemplate.name
    );
    const neededTemplateVariables = templateVariables.filter(
      variable =>
        ![...server.SERVER_VARIABLES, 'REGISTRY_URL'].includes(variable)
    );
    // console.log('neededTemplateVariables', neededTemplateVariables);
    const userVariables = await pairVariables(neededTemplateVariables);

    const z = await Template.writeTemplateVariables(
      tmpDirectory.name + "/" + selectedTemplate.name,
      Object.assign(serverVariables, registryVariables, userVariables)
    );

    // copy and remove
    await filesystem.copyFilesFromDirectoryToCurrent(`${tmpDirectory.name}/${selectedTemplate.name}`)
    await filesystem.removeFolder(tmpDirectory.name)

    const projects = await Gitlab.getProjects(Git.getProjectName(remoteUrl));
    const projectId = R.last(projects).id;
    console.log('projectId', projectId);
    await Gitlab.saveVariables(projectId, serverVariables);


    // const newGroup = await GitlabAPI.Groups.create({
    //   name: name,
    //   path: name,
    // })

    // TODO: for dbs
    // if (!isGit) {
    //   const repository = await Repository.init(`./${selectedTemplate.name}`, 0);
    //   // const newRepo = await createGitlabRepo(selectedTemplate.name);
    //   // // create git remote
    //   // await Remote.create(repository, 'deploy', newRepo.http_url_to_repo);
    // }

    // await R.pipeP(
    //   Template.getTemplateVariablesFromDirectory,
    //   pairValues,
    //   Template.writeTemplateVariablesToDirectory(selectedTemplate.name),
    // )(selectedTemplate.name);

    // console.log('x', x, y);

    // const directories = await Github.getListOfDirectories()
    // const dirContent = await Github.getDirContent('mongo')
    // Github.createDirStructure(dirContent)
    // console.log('dirContent', dirContent);

    // const projects = await GitlabAPI.Projects.all({ owned: true, search: 'test' })
    // console.log('found',  projects);

    // const newRepo = await createGitlabRepo('test2');
    // console.log('newRepo', newRepo.http_url_to_repo, newRepo.ssh_url_to_repo);
    // if (newRepo.http_url_to_repo) {
    //   spinner.succeed(`New repository ${chalk.bold(newRepo.name_with_namespace)} is created. 🎉`);
    //   // spinner.succeed(`New repository ${chalk.bold(newRepo.web_url)}. 🎉`);
    // }

    // remove temp dir
    tmpDirectory.removeCallback();

  } catch (error) {
    console.log('clean', tmpDirectory.name);
    await filesystem.removeFolder(tmpDirectory.name)
    // tmpDirectory.removeCallback();
    spinner.stop();
    spinner.fail(error);
  }

};
