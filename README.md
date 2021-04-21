# Gaia Project

[![Open in Gitpod](https://gitpod.io/button/open-in-gitpod.svg)](https://gitpod.io/#https://github.com/boardgamers/gaia-project)

Mono repo containing the viewer & the engine for Gaia Project

Checkout their READMEs:

- [engine](./engine/README.md)
- [viewer](./viewer/README.md)

## Demo

Check out [boardgamers.space](https://www.boardgamers.space)! Reach out to us if you want to contribute.

## Install

Do `pnpm install` in the main folder

## Test locally

After the installation step, you can run the viewer with:

```
cd viewer
npm run serve
```

It will use the engine in its sibling folder

## Commit messages

We try to follow the [gitmoji](https://gitmoji.dev/) initiative. Extensions are available on VS Code & IntelliJ.

The format of a commit message is: `<gitmoji> (all|engine|viewer) Commit message`

## Merging PRs

If the PR's commit history is clean, and commit messages conform to the policy, prefer a rebase to a squash.

If you need to squash, take care to add the appropriate gitmoji & scope to the commit message.

If the PR has [fixup commmits](https://jordanelver.co.uk/blog/2020/06/04/fixing-commits-with-git-commit-fixup-and-git-rebase-autosquash/) starting with `fixup!`, approve the PR first, let the contributor adjust their PR to remove the fixup commits, and then rebase.
