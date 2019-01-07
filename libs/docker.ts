import yaml from 'js-yaml'
import R from 'ramda'

interface Service {
  image: string
  restart: string
  ports?: string[]
  environment?: string[]
  env_file?: string[]
  volumes?: string[]
  networks?: string[]
  external_links?: string[]
}

interface DockerCompose {
  services: { [name: string]: Service }
  networks?: any[]
}

export const loadDockerCompose = (fileContent: string): DockerCompose => {
  return yaml.safeLoad(fileContent)
}

export const composeHasExternalSources = (fileContent: string) => {
  try {
    const compose = yaml.safeLoad(fileContent)
    return compose.services.some(R.propIs(Array, 'external_links'))
  } catch (e) {
    console.log(e)
  }
  return false
}

export const getExternalSources = (compose: DockerCompose): string[] => {
  return Object.values(compose.services).reduce(
    (acc: string[], item: Service) => [...acc, ...(item.external_links ? item.external_links : [])],
    [],
  )
}
