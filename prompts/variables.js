'use strict';
const inquirer = require('inquirer');

const pairVariables = async variables =>
  inquirer.prompt(
    variables.map(variable => ({
      type: 'input',
      name: variable,
      message: `Set variable ${variable}`
    }))
  );

module.exports = {
  pairVariables
};
