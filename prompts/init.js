'use strict';
const inquirer = require('inquirer');

module.exports.init = () => {
  const questions = [
    {
      type: 'list',
      name: 'init',
      message: 'What do you want to do?',
      choices: [
        { name: 'Init project to deploy', value: 'deploy' },
        { name: 'Init server', value: 'server' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ];

  return inquirer.prompt(questions);
};
