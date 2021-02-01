# gaia-engine

Javascript engine for Gaia Project.

## Demo

Check out [boardgamers.space](https://www.boardgamers.space)! Reach out to us if you want to contribute.

## Setup

### Requirements

Have node 6+, hopefully 8+. Have npm 5+, and tsc.

### Dependencies

In the project's folder:

```
yarn
```

### Build

To compile Typescript into javascript:

```
yarn build
```

### Test

```
yarn test
```

### Usage as a dependency from another module

If you want to use your local copy of this module instead of the npm version, as a dependency of
another module, do this:

```
## In this folder
yarn link

## In the other project's folder
yarn link @gaia-project/engine
```
