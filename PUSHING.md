# Pushing this repository

The repository is prepared with its history, the plugin sources, and the
market index. It needs GitHub credentials to push.

## One-time setup

The repository `Thomas1yang/DSH-plugin-theme` already exists and is public. Sign in
to GitHub once, either with the GitHub CLI:

```sh
gh auth login
```

or with a personal access token (the `repo` scope), which git can then use:

```sh
git remote set-url origin https://<user>:<token>@github.com/Thomas1yang/DSH-plugin-theme.git
```

If you prefer SSH, add a key to your GitHub account and point the remote at
`ssh://git@github.com/Thomas1yang/DSH-plugin-theme.git`. Note that this machine's
global git config rewrites `ssh://git@github.com/` to HTTPS, so remove that
rule with `git config --global --unset url.https://github.com/.insteadof`
first, or the rewrite will force HTTPS and need a token instead.

## Pushing

```sh
cd ~/Downloads/DSH-plugin
git push -u origin main
```

The repository has three commits and no remote content to merge, so this
creates `main` on GitHub.

## After the push

The index is served from the repository root, so the Discover tab can read it
as soon as the push lands:

```
https://raw.githubusercontent.com/Thomas1yang/DSH-plugin-theme/main/market-index.json
```

It is already configured in this profile's `cordis.patch.yml` under
`plugin-market`. If GitHub serves the raw file with a short delay, wait a
moment and press **刷新** on the Discover tab.

Check that the plugin appears there:

```sh
curl -s https://raw.githubusercontent.com/Thomas1yang/DSH-plugin-theme/main/market-index.json | head -20
```

## Releasing a new version later

```sh
cd dsh-theme-studio
./publish.sh
```

It pushes the repository, regenerates the index so it names the pushed commit,
and pushes the index too. See `dsh-theme-studio/PUBLISHING.md` for the details.
