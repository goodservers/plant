# 🌱 plant-cli

Heroku like deployment tool for setup automatic deployment. It use you git repository together with Docker and Gitlab. For usage you need setuped server with this script [goodservers/docker-server](https://github.com/goodservers/docker-server). How it works in detail? Check ([deploy.guide](https://deploy.guide))

## Installation
Install [Node.js](https://nodejs.org/) and then install plant-cli globally with this command
```sh
npm install -g @goodservers/plant
```
## Usage
To get started
```sh
plant
```
It will ask for Gitlab Personal Access Token for the first time and then you can perform tasks interactively.

## Todo
- [x] Typescript
- [ ] Deploy db instances, create users
- [ ] Tests

## License
MIT
