'use strict';
const inquirer = require('inquirer');
const chalk = require('chalk');
const {
  loadAvailableRegions,
  loadAvailableSizes,
  loadAvailableImages,
  loadAvailableSSHKEYS
} = require('../loaders');
const input = require('./inputs');


module.exports.repositoryName = () => {
  const questions = [
    {
      type: 'input',
      name: 'name',
      message: 'Give a repository name:'
    }
  ];

  return inquirer.prompt(questions);
};

module.exports.gitlabAccess = () =>
  inquirer.prompt([
    input.domain({
      name: 'gitlabDomain',
      message: 'Enter Gitlab domain',
      default: 'gitlab.com'
    }),
    input.text({
      name: 'gitlabToken',
      type: 'input',
      validate: val => !!val.length || 'We need gitlab acces token :(',
      message: chalk.yellow('Please provide your Gitlab access token:')
    })
  ]);
