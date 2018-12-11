'use strict';
const chalk = require('chalk');
const inquirer = require('inquirer');
const input = require('./inputs');

const selectRightGitlabRemote = async (choices) =>
  inquirer.prompt([
    input.text({
      type: 'list',
      name: 'name',
      message: 'Please select your git remote:',
      choices
    })
  ]);

module.exports = {
  selectRightGitlabRemote,
};
