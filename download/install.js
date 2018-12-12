/* eslint-disable no-var */

// Native
var path = require('path');
var fs = require('fs');

var dist = path.join(__dirname, 'dist');
var src = path.join(__dirname, 'src');

// Don't install when developing locally
if (fs.existsSync(src)) {
  // eslint-disable-next-line unicorn/no-process-exit
  process.exit(0);
}

fs.copyFileSync(
  './node_modules/nodegit/build/Release/nodegit.node',
  './download/dist/nodegit.node'
);

require(path.join(dist, 'index.js'));
