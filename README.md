[![Join the chat at https://gitter.im/gaia-engine](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/gaia-engine?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# gaia-viewer
A Vue.js / SVG UI for Gaia Project

## Requirements

Depending on your version of node and your OS, the binaries for node-sass might need to be built rather than downloaded.

This can generally be avoided if you have a LTS version of node installed: https://nodejs.org/en/.

If you have errors during `npm install` due to manually building modules, you can try this:

### Windows

```bash
# From an elevated powershell / admin console
npm install --global --production windows-build-tools
```

### Mac

- install python 2.7 + (not 3.x)
- run `xcode-select --install` in the terminal

See [here](https://github.com/nodejs/node-gyp) for why.

### Unix

```bash
sudo apt install build-essentials
```

## Build

```bash
yarn install
yarn serve
```

And open localhost:8080 in the browser.

You will also need to run gaia-engine on the same machine.

## Env

If you want to launch bg.io, create a .env file with:

```
VUE_APP_BGIO=1
#VUE_APP_SelfContained=1
```