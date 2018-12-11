const inquirer = require('inquirer');
const chalk = require('chalk');
const R = require('ramda');
const { config, GitlabAPI, spinner, callMatchingMethod } = require('../util');
const serverPrompt = require('../prompts/server');
const { convertToSlug, hashCode } = require('../libs/helpers.js');

const init = async () => {
  try {
    const answers = await serverPrompt.init();
    callMatchingMethod(module.exports, answers.server);
  } catch (error) {
    console.error(error);
  }
};

const SERVER_PREFIX = 'servers';
const SERVER_VARIABLES = ['DEPLOYMENT_SERVER_IP', 'DEPLOY_SERVER_PRIVATE_KEY']

const create = async () => {
  try {
    const server = await serverPrompt.create();

    spinner.start(`Saving ${server.name}...`);

    const currentUser = await GitlabAPI.Users.current();
    const newGroup = await GitlabAPI.Groups.create({
      name: server.name,
      path: SERVER_PREFIX + '-' + convertToSlug(server.name) + '-' + randomNine()
    });

    await GitlabAPI.GroupVariables.create(newGroup.id, {
      key: 'DEPLOYMENT_SERVER_IP',
      value: server.DEPLOYMENT_SERVER_IP,
      protected: false
    });

    await GitlabAPI.GroupVariables.create(newGroup.id, {
      key: 'DEPLOY_SERVER_PRIVATE_KEY',
      value: server.DEPLOY_SERVER_PRIVATE_KEY,
      protected: false
    });

    spinner.succeed(`${chalk.bold(server.name)} is saved. 🎉`);
  } catch (error) {
    spinner.stop();
    console.error(error);
  }
};

const list = async () => {
  try {
    spinner.start(`Listing servers...`);

    const list = await GitlabAPI.Groups.all({
      owned: true
    });

    const choices = list
      .filter(server => server.path.startsWith(SERVER_PREFIX))
      .map(server => ({
        name: server.name,
        value: server.id
      }));

    const questions = [
      {
        type: 'list',
        name: 'name',
        message: 'Choose server to deploy',
        choices
      }
    ];
    spinner.stop();

    return inquirer.prompt(questions);
  } catch (error) {
    spinner.stop();
    console.error(error);
  }
};

const getVariablesForServer = async (groupId) => {
  return await GitlabAPI.GroupVariables.all(groupId)
}

module.exports = {
  SERVER_PREFIX,
  SERVER_VARIABLES,
  init,
  create,
  getVariablesForServer,
  list
};
