'use strict';
const inquirer = require('inquirer');
const { loadAvailableTemplates } = require('../loaders');

const selectTemplate = async () => {
  const questions = [
    {
      type: 'list',
      name: 'name',
      message: 'Select init template',
      choices: await loadAvailableTemplates()
    }
  ];

  return inquirer.prompt(questions);
};

module.exports = {
  selectTemplate
}
