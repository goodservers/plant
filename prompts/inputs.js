const chalk = require('chalk');
const { convertToSlug } = require('../libs/helpers.js');

const text = options =>
  Object.assign(
    {
      type: 'input'
    },
    options
  );

const slug = options =>
  Object.assign(
    {
      type: 'input',
      name: 'name',
      filter: input => convertToSlug(input)
    },
    options
  );

const domain = options =>
  Object.assign(
    {
      type: 'input',
      name: 'domain',
      message: "Enter server's domain name:",
      validate: val =>
        !!val.length ||
        /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(val) ||
        'Please enter a valid domain name',
      filter: input => input.toLowerCase()
    },
    options
  );

const email = options =>
  Object.assign(
    {
      type: 'input',
      name: 'email',
      message: 'Enter your email:',
      validate: input => {
        var re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(input) || 'Please enter a valid email address';
      },
      filter: input => input.toLowerCase()
    },
    options
  );

const ip = options =>
  Object.assign(
    {
      type: 'input',
      name: 'ip',
      message: 'Enter your IP address:',
      validate: IP => {
        if (IP) {
          var EX = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
          var ret = EX.exec(IP);
          if (
            ret &&
            ret[1] <= 255 &&
            ret[2] <= 255 &&
            ret[3] <= 255 &&
            ret[4] <= 255
          ) {
            return true;
          } else {
            return chalk.yellow('IP is not valid :(');
          }
        } else {
          return chalk.yellow('IP is required :(');
        }
      },
      filter: input => input.toLowerCase()
    },
    options
  );

module.exports = {
  domain,
  email,
  ip,
  slug,
  text
};
