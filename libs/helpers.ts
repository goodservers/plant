export const convertToSlug = (x: string): string =>
  x
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');

export const randomNine = (): string => Math.random().toString().slice(2,11);
