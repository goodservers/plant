import R from 'ramda'
import { convertToSlug } from '../libs/helpers'

// TODO: add more validators, combine them
export const validator = {
  domain: (val: string, message = 'Please enter a valid domain name') =>
    /^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/.test(val) || message,
  email: (input: string, message = 'Please enter a valid email address') => emailRegex.test(input) || message,
  ipv4: (IP: string, message = 'Wrong format of ipv4 address') => {
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
    return false || message
  },
  port: (x: string, message = 'Please enter valid port number') => {
    const input = parseInt(x, 10)
    return (Number.isInteger(input) && input > 0 && input < 65536) || message
  },
  required: (x: string, message = 'Required input') => x.length > 0 || message,
}

export const filters = {
  lowerCase: (input: string) => input.toLowerCase(),
  slug: (input: string) => convertToSlug(input),
  trimOrNull: (input: string) => (!R.isEmpty(input) && !R.isNil(input) ? R.trim(input) : null),
}

export const text = (options?: any) => ({
  type: 'input',
  ...options,
})

export const slug = (options?: any) => ({
  type: 'input',
  name: 'slug',
  filter: filters.slug,
  ...options,
})

export const confirm = (options?: any) => ({
  type: 'confirm',
  name: 'confirm',
  ...options,
})

export const domain = (options?: any) => ({
  type: 'input',
  name: 'domain',
  message: 'Enter server\'s domain name:',
  validate: (value: string) => validator.domain(value),
  filter: filters.lowerCase,
  ...options,
})

const emailRegex = /^(([^<>()[\]\\.,;:\s@\"]+(\.[^<>()[\]\\.,;:\s@\"]+)*)|(\".+\"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/

export const email = (options?: any) => ({
  type: 'input',
  name: 'email',
  message: 'Enter your email:',
  validate: validator.email,
  filter: filters.lowerCase,
  ...options,
})

export const ip = (options?: any) => ({
  type: 'input',
  name: 'ip',
  message: 'Enter your IP address:',
  validate: validator.ipv4,
  ...options,
})
