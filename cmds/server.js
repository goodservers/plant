const inquirer = require('inquirer');
const chalk = require('chalk');
const R = require('ramda');
const { GitlabAPI, spinner, callMatchingMethod } = require('../util');
const serverPrompt = require('../prompts/server');
const { convertToSlug, randomNine } = require('../libs/helpers.js');

const init = async () => {
  try {
    const answers = await serverPrompt.init();
    callMatchingMethod(module.exports, answers.server);
  } catch (error) {
    console.error(error);
  }
};

const SERVER_PREFIX = 'servers';
const SERVER_VARIABLES = ['DEPLOYMENT_SERVER_IP', 'DEPLOY_SERVER_PRIVATE_KEY'];

const create = async () => {
  try {
    const server = await serverPrompt.create();

    spinner.start(`Saving ${server.name}...`);

    const newGroup = await GitlabAPI.Groups.create({
      name: server.name,
      path: `${SERVER_PREFIX}-${convertToSlug(server.name)}-${randomNine()}`
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

    return {
      name: server.name,
      value: newGroup.id
    };
  } catch (error) {
    spinner.stop();
    console.error(error);
  }
};

const listOrCreate = async () => {
  try {
    spinner.start(`Listing servers...`);

    let list = await GitlabAPI.Groups.all({
      owned: true
    });

    const choices = list
      .filter(server => server.path.startsWith(SERVER_PREFIX))
      .map(server => ({
        name: server.name,
        value: server.id
      }));

    spinner.stop();
    switch (choices.length) {
      case 0:
        spinner.warn(`No server to deployment found, please create new.`);
        const newServer = await create();
        list.push(newServer);
        return new Promise(resolve => resolve({ name: newServer.value }));
      case 1:
        const choice = R.last(choices);
        spinner.succeed(`Setting deployment to ${choice.name} server`);
        return new Promise(resolve => resolve({ name: choice.value }));
      default:
        return inquirer.prompt([
          {
            type: 'list',
            name: 'name',
            message: 'Choose server to deploy',
            choices
          }
        ]);
    }
  } catch (error) {
    spinner.stop();
    console.error(error);
  }
};

const getVariablesForServer = async groupId =>
  GitlabAPI.GroupVariables.all(groupId);

module.exports = {
  SERVER_PREFIX,
  SERVER_VARIABLES,
  init,
  create,
  getVariablesForServer,
  listOrCreate
};
