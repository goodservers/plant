import chalk from 'chalk';
import inquirer from 'inquirer';
import { convertToSlug } from '../libs/helpers';

export const text = (options: any) =>
  Object.assign(
    {
      type: 'input'
    },
    options
  );

export const slug = (options: any) =>
  Object.assign(
    {
      type: 'input',
      name: 'name',
      filter: (input: string) => convertToSlug(input)
    },
    options
  );

export const domain = (options: any) =>
  Object.assign(
    {
      type: 'input',
      name: 'domain',
      message: "Enter server's domain name:",
      validate: (val: string) =>
        !!val.length ||
        /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(val) ||
        'Please enter a valid domain name',
      filter: (input: string) => input.toLowerCase()
    },
    options
  );

export const email = (options: any) =>
  Object.assign(
    {
      type: 'input',
      name: 'email',
      message: 'Enter your email:',
      validate: (input: string) => {
        let re = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
        return re.test(input) || 'Please enter a valid email address';
      },
      filter: (input: string) => input.toLowerCase()
    },
    options
  );

export const ip = (options: any) =>
  Object.assign(
    {
      type: 'input',
      name: 'ip',
      message: 'Enter your IP address:',
      validate: (IP: string) => {
        if (IP) {
          let EX = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/;
          let ret = EX.exec(IP);
          if (
            ret &&
            parseInt(ret[1]) <= 255 &&
            parseInt(ret[2]) <= 255 &&
            parseInt(ret[3]) <= 255 &&
            parseInt(ret[4]) <= 255
          ) {
            return true;
          }
            return chalk.yellow('IP is not valid :(');

        }
          return chalk.yellow('IP is required :(');

      },
      filter: (input: string) => input.toLowerCase()
    },
    options
  );
