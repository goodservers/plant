import node_ssh from 'node-ssh'

export const connect = async (host: string, privateKey: string, port = 22, username = 'user'): Promise<any> => {
  const ssh = new node_ssh()
  await ssh.connect({
    host,
    port,
    username,
    privateKey,
  })
  return ssh
}
