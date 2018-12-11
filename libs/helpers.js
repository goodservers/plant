const convertToSlug = string =>
  string
    .toLowerCase()
    .replace(/[^\w ]+/g, '')
    .replace(/ +/g, '-');

const randomNine = () => Math.random().toString().slice(2,11);

module.exports = {
  convertToSlug,
  randomNine
}
