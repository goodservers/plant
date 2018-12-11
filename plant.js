const updateNotifier = require('update-notifier');
const Server = require('./cmds/server');
const { init } = require('./cmds/init');
const Deploy = require('./cmds/deploy');
const { initAccount, callMatchingMethod, config } = require('./util');
const pkg = require('./package.json');
const filesystem = require('./libs/filesystem');

const notifier = updateNotifier({ pkg });

notifier.notify({ isGlobal: true });
const main = async argv_ => {
  const argv = argv_.slice(2);

  const help = `
  All operations can be performed interactively by just typing 'plant'
  but incase you need to skip through few prompts, you can use the below:

  $ plant

  examples:

  $ plant
  -> Perform operations interactively
  `;

  if (config.has('gitlabToken')) {
    switch (argv[0]) {
      case 'deploy':
        callMatchingMethod(Deploy, argv[1]);
        break;
      case 'server':
        callMatchingMethod(Server, argv[1]);
        break;
      case '-v':
      case '--version':
        console.log(pkg.version);
        break;
      case '-h':
      case '--help':
        console.log(help);
        break;
      default:
        Deploy.init();
        break;
    }
  } else {
    initAccount();
  }
}

const handleUnexpected = async err => {
  const { message } = err;

  console.error(
    error(`An unexpected error occurred!\n  ${err.stack} ${err.stack}`)
  );

  process.exit(1);
};

main(process.argv)
  .then(exitCode => {
    process.emit('nowExit');
    process.on('beforeExit', () => {
      process.exit(exitCode);
    });
  })
  .catch(handleUnexpected);
