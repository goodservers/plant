import R from 'ramda'

export const convertToSlug = (x: string): string =>
  x
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-')

export const randomNine = (): string =>
  Math.random()
    .toString()
    .slice(2, 11)

export const objFromListWith = R.curry((fn: any, list: any[]) =>
  // @ts-ignore FIXME:
  R.chain(R.zipObj, R.map(fn))(list),
)
