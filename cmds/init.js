'use strict';
const { init } = require('../prompts/init');
const deploy = require('./deploy');
const server = require('./server');

module.exports.init = async () => {
  try {
    const anwsers = await init();
    switch (anwsers.init) {
      case 'deploy':
        deploy.init();
      break;
      case 'server':
        server.init();
        break;
      case 'exit':
        process.exit();
      default:
        console.error(`Unkown command: ${anwsers.init}`);
        process.exit();
    }
  } catch (error) {
    console.error(error);
  }
};
