import chalk from 'chalk'
import { convertToSlug } from '../libs/helpers'

export interface Choice {
  name: string
  value: string
}

const port = (x: string, message = 'Please enter valid port number') => {
  const input = parseInt(x, 10)
  return (Number.isInteger(input) && input > 0 && input < 65536) || message
}

const required = (x: string, message = 'Required input') => x.length > 0 || message

// TODO: add more validators, combine them
export const validator = {
  required,
  port,
}

export const text = (options: any) =>
  Object.assign(
    {
      type: 'input',
    },
    options,
  )

export const slug = (options: any) =>
  Object.assign(
    {
      type: 'input',
      name: 'name',
      filter: (input: string) => convertToSlug(input),
    },
    options,
  )

export const domain = (options: any) => ({
  type: 'input',
  name: 'domain',
  message: 'Enter server\'s domain name:',
  validate: (val: string) =>
    !!val.length || /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(val) || 'Please enter a valid domain name',
  filter: (input: string) => input.toLowerCase(),
  ...options,
})

const emailRegex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

export const email = (options: any) =>
  Object.assign(
    {
      type: 'input',
      name: 'email',
      message: 'Enter your email:',
      validate: (input: string) => {
        return emailRegex.test(input) || 'Please enter a valid email address'
      },
      filter: (input: string) => input.toLowerCase(),
    },
    options,
  )

export const ip = (options: any) =>
  Object.assign(
    {
      type: 'input',
      name: 'ip',
      message: 'Enter your IP address:',
      validate: (IP: string) => {
        if (IP) {
          const EX = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/
          const ret = EX.exec(IP)
          if (
            ret &&
            parseInt(ret[1], 10) <= 255 &&
            parseInt(ret[2], 10) <= 255 &&
            parseInt(ret[3], 10) <= 255 &&
            parseInt(ret[4], 10) <= 255
          ) {
            return true
          }
          return chalk.yellow('IP is not valid :(')
        }
        return chalk.yellow('IP is required :(')
      },
      filter: (input: string) => input.toLowerCase(),
    },
    options,
  )
