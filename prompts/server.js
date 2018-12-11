'use strict';
const chalk = require('chalk');
const inquirer = require('inquirer');
const input = require('./inputs');

const create = async () =>
  inquirer.prompt([
    input.text({
      name: 'name',
      message: 'Server name:',
      validate: val => !!val.length || 'Please fill the name'
    }),
    input.domain({
      name: 'DEPLOYMENT_SERVER_IP'
    }),
    input.text({
      type: 'editor',
      name: 'DEPLOY_SERVER_PRIVATE_KEY',
      message: 'Private Key',
      validate: val => !!val.length || 'Please fill the private key'
    })
  ]);

const init = () =>
  inquirer.prompt([
    {
      type: 'list',
      name: 'server',
      message: 'What do you want to do?',
      choices: [
        { name: 'Create server', value: 'create' },
        { name: 'List servers', value: 'list' },
        { name: 'Edit server', value: 'edit' },
        { name: 'Add ssh key', value: 'ssh_keys' },
        { name: '<- Back', value: 'back' },
        { name: 'Exit', value: 'exit' }
      ]
    }
  ]);

module.exports = {
  create,
  init
};
