import updateNotifier from 'update-notifier'
import * as deploy from './cmds/deploy'
import * as server from './cmds/server'
import pkg from './package.json'
import { callMatchingMethod, config, initAccount } from './util'

const notifier = updateNotifier({ pkg })

notifier.notify({ isGlobal: true })
const main = async (argv_: string[]) => {
  const argv = argv_.slice(2)

  const help = `
  All operations can be performed interactively by just typing 'plant'
  but incase you need to skip through few prompts, you can use the below:

  $ plant

  examples:

  $ plant
  -> Perform operations interactively
  `

  if (config.has('gitlabToken')) {
    switch (argv[0]) {
      case 'deploy':
        callMatchingMethod(deploy, argv[1])
        break
      case 'server':
        callMatchingMethod(server, argv[1])
        break
      case '-v':
      case '--version':
        console.log(pkg.version)
        break
      case '-h':
      case '--help':
        console.log(help)
        break
      default:
        deploy.init()
        break
    }
  } else {
    initAccount()
  }
}

const handleUnexpected = async (err: any) => {
  // const { message } = err;

  console.error(`An unexpected error occurred!\n  ${err.stack} ${err.stack}`)

  process.exit(1)
}

main(process.argv)
  .then((exitCode) => {
    // process.emit('nowExit');
    // process.on('beforeExit', () => {
    //   process.exit(exitCode);
    // });
  })
  .catch(handleUnexpected)
