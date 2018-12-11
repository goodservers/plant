const fs = require('fs-extra');
const globby = require('globby');
const mustache = require('mustache');
const R = require('ramda');

const _getTemplateVariables = checkedToken => template => {
  const tokens = mustache.parse(template);

  return R.pipe(
    R.filter(token => token[0] === checkedToken),
    R.map(token => {
      let v = token[1].split('.');
      return v;
    }),
    R.flatten,
    R.uniq,
    R.values
  )(tokens);
};

const getRequiredVariables = _getTemplateVariables("name");
const getOptionalVariables = _getTemplateVariables("#");

const getFilesFromDirectory = async directory =>
  globby([`${directory}/**/.*`, `${directory}/**/*`, `${directory}/.deploy/**/*`], {
    expandDirectories: true,
  });

const getTemplateVariables = async directory => {
  const files = await getFilesFromDirectory(directory);
  const filesP = await R.pipe(
    R.map(async file => {
      const template = await fs.readFile(file, 'utf8');
      return [...getRequiredVariables(template), ...getOptionalVariables(template)];
    }),
    Promise.all.bind(Promise)
  )(files);

  return R.pipe(
    R.flatten,
    R.uniq
  )(filesP);
};

const _writeTemplateVariables = async (path, template, variables) => {
  const finalTemplate = mustache.render(template, variables);
  return fs.outputFile(path, finalTemplate);
};

const writeTemplateVariables = async (directory, variables) => {
  const filePaths = await getFilesFromDirectory(directory);
  const filesP = await R.pipe(
    R.map(async filePath => {
      const template = await fs.readFile(filePath, 'utf8');
      return _writeTemplateVariables(filePath, template, variables);
    }),
    Promise.all.bind(Promise)
  )(filePaths);
};

const renderTemplate = (template, variables) =>
  mustache.render(template, variables);

module.exports = {
  getRequiredVariables,
  getOptionalVariables,
  getTemplateVariables,
  renderTemplate,
  writeTemplateVariables
};
