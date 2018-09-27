[![Join the chat at https://gitter.im/gaia-engine](https://badges.gitter.im/Join%20Chat.svg)](https://gitter.im/gaia-engine?utm_source=badge&utm_medium=badge&utm_campaign=pr-badge&utm_content=badge)

# gaia-engine
Javascript engine for project gaia.

## Setup

### Requirements

Have node 6+, hopefully 8+. Have npm 5+, and tsc.

### Clone the repository

```
git clone git@github.com:donkeytech/gaia-engine
cd gaia-engine
```

### Dependencies

```
npm install
```

### Build

Each time the code is changed, you need to run `tsc` to compile Typescript into javascript:

```
tsc
```

To automatically compile Typescript at each code change: 

```
tsc --watch
```

### Run

```
npm start
```

### Test

```
npm test
```

### Usage as a dependency from another module

If you want to use your local copy of this module instead of the npm version, as a dependency of
another module, in the other module's directory:

```
npm link <path-to-this-module>
```
