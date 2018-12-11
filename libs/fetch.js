const fetch = require('isomorphic-fetch');

const fetchText = url =>
  fetch(url).then(function(response) {
    if (response.status >= 400) {
      throw new Error('Bad response from server');
    }
    return response.text();
  });

const fetchJson = url =>
  fetch(url).then(function(response) {
    if (response.status >= 400) {
      throw new Error('Bad response from server');
    }
    return response.json();
  });

module.exports = {
  fetchText,
  fetchJson
};
