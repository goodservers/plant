import Conf from 'conf'
import path from 'path'

export const parentDir = path.dirname(process.cwd())

interface ConfOptions {
  projectName?: string
  version?: number
}

interface Options {
  ignoreMaxAge?: boolean
  maxAge?: number
}

export default class CacheConf extends Conf {
  version?: number

  constructor(options: ConfOptions) {
    options = Object.assign(
      {
        projectName: 'plant',
      },
      options,
    )

    super(options)

    this.version = options.version
  }

  get(key: string, options: Options = {}) {
    if (options.ignoreMaxAge !== true && this.isExpired(key)) {
      super.delete(key)
      return
    }

    const item = super.get(key)

    return item && item.data
  }

  setKey(key: string, val: any, opts: Options = {}) {
    if (typeof key === 'object') {
      opts = val || {}

      const timestamp = typeof opts.maxAge === 'number' ? Date.now() + opts.maxAge : undefined

      Object.keys(key).forEach((k) => {
        super.set(k, {
          timestamp,
          version: this.version,
          data: key[k],
        })
      })
    } else {
      super.set(key, {
        timestamp: typeof opts.maxAge === 'number' ? Date.now() + opts.maxAge : undefined,
        version: this.version,
        data: val,
      })
    }
  }

  has(key: string) {
    if (!super.has(key)) {
      return false
    }

    if (this.isExpired(key)) {
      super.delete(key)
      return false
    }

    return true
  }

  isExpired(key: string) {
    const item = super.get(key)

    if (!item) {
      return false
    }

    const invalidTimestamp = item.timestamp && item.timestamp < Date.now()
    const invalidVersion = item.version !== this.version

    return Boolean(invalidTimestamp || invalidVersion)
  }
}
