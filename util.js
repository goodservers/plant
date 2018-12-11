'use strict';
const Gitlab = require('gitlab').default;
const chalk = require('chalk');
const CacheConf = require('./libs/cache-conf');
const Ora = require('ora');

const config = new CacheConf();
const spinner = new Ora();
// config.delete('gitlabToken');
const CURRENT_USER = config.get('currentUser');
const GITLAB_DOMAIN = config.get('gitlabDomain');
const ACCESS_TOKEN = config.get('gitlabToken');
const GitlabAPI = new Gitlab({
  url: `https://${GITLAB_DOMAIN}`,
  token: ACCESS_TOKEN
});

// /Users/xxx/Library/Preferences/shark-nodejs/config.json

module.exports.config = config;

module.exports.spinner = spinner;

module.exports.CURRENT_USER = CURRENT_USER;
module.exports.GITLAB_DOMAIN = GITLAB_DOMAIN;

module.exports.GitlabAPI = GitlabAPI;

module.exports.initAccount = async () => {
  const verifyAccount = async ({ gitlabToken, gitlabDomain }) => {
    console.log('token,', gitlabToken, gitlabDomain)
    try {
      const api = new Gitlab({
        url: `https://${gitlabDomain}`,
        token: gitlabToken,
      });

      spinner.start('Verifying your account...');

      const currentUser = await api.Users.current();

      if (api) {
        spinner.succeed('Account verified!');
        console.log(`
          ${chalk.green(`Hi ${currentUser.name}! Your access token is valid.`)}
        `);

        config.set('gitlabToken', gitlabToken);
        config.set('gitlabDomain', gitlabDomain);
        config.set('currentUser', currentUser);
      }
    } catch (error) {
      spinner.fail('Verification failed!');
      console.error(`
          ${chalk.red('Please make sure you are using a valid access token')}
          `);
    }
  };
  const Create = require('./prompts/create');

  const answers = await Create.gitlabAccess();

  // If token is valid verifAccount sets the token
  await verifyAccount(answers);
};

module.exports.callMatchingMethod = (object, method) => {
  if (Object.prototype.hasOwnProperty.call(object, method)) {
    object[method]();
  } else if (Object.prototype.hasOwnProperty.call(object, 'init')) {
    object.init();
  } else {
    console.error(`Couldn't find the method/property ${method} in ${object} `);
  }
};

module.exports.calculateCostAndHours = (createdAt, hourlyPrice) => {
  const createdDate = new Date(createdAt);
  const totalHours = Math.ceil(Math.abs(Date.now() - createdDate) / 36e5);
  const totalCost = totalHours * hourlyPrice;
  return { totalCost, totalHours };
};
