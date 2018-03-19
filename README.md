# gaia-engine
Javascript engine for project gaia. Depends on [honeycomb](https://github.com/flauwekeul/honeycomb) for the hexagonal grid.

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
cp lib/honeycomb-grid/index.d.ts node_modules/honeycomb-grid # to be removed soon
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
