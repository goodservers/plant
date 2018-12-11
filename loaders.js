const { GitlabAPI, spinner, config } = require('./util');
const Github = require('./libs/github');

const deleteKey = key => {
  if (config.isExpired(key)) {
    config.delete(key);
  }
};

const checkGithubApiLimit = async spinner => {
  const limit = await Github.getApiLimit();
  if (limit === 0) {
    spinner.fail('Github API rate limit was exceeded, please wait until:');
  }
};

const mappingFunction = item => ({ name: item, value: item });

const cachedLoader = async (
  cacheKey,
  asyncLoadingFunction,
  mappingFunction,
  maxAge = 8640000
) => {
  let choices = [];

  deleteKey(cacheKey);
  try {
    spinner.start(`Loading available ${cacheKey}...`);

    if (config.has(cacheKey)) {
      choices = config.get(cacheKey);
      spinner.stop();
    } else {
      const items = await asyncLoadingFunction();
      spinner.stop();

      config.set(cacheKey, items.map(mappingFunction), {
        maxAge
      });
    }

    return choices;
  } catch (error) {
    spinner.stop();
    checkGithubApiLimit(spinner);
    spinner.fail(error);
  }
};

const loadAvailableTemplates = async () =>
  cachedLoader('templates', Github.getListOfDirectories, mappingFunction);

module.exports = {
  loadAvailableTemplates
};
