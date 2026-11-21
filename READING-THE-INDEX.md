# Reading the index: local now, GitHub later

The Plugins page's **Discover** tab reads a market index over HTTP. Until the
repository is pushed to GitHub, that URL has nothing behind it and the tab
says **无法读取此索引** (cannot read this index). There are two ways to get a
readable index.

## Option A — serve it locally (works now)

The bundle ships a server that publishes the index and the repository from
this machine:

```sh
cd ~/Downloads/DSH-plugin/dsh-theme-studio
./serve-local.sh
```

It writes its index to `../.local-market/market-index.json`, points that
index's Git source at itself, and serves:

| What | Where |
|---|---|
| The index | `http://127.0.0.1:8099/market-index.json` |
| The repository | `https://127.0.0.1:8443/Thomas1yang/DSH-plugin-theme.git` |

The repository is served over https with a self-signed certificate, because
the market format requires a Git source URL to use `https:` while the index
URL itself may use `http:`. The script points git at that certificate with
`http.sslCAInfo`, so the install works without changing git's global trust
store beyond that one setting.

Configure the index in the profile's `cordis.patch.yml`:

```yaml
- id: plugin-market
  name: "@deepseek-ai/dsh-plugin-market"
  config:
    indexes:
      - "http://127.0.0.1:8099/market-index.json"
```

The Discover tab then lists the plugin, and installing it pulls the code from
the local server. This is what to use while the GitHub push is pending, and it
is enough to try the plugin on other machines on the same network — point
their index URL at this host's address instead of `127.0.0.1`.

Stop the server with Ctrl-C. It leaves the profile's `http.sslCAInfo` setting
behind; remove it with:

```sh
git config --global --unset http.sslCAInfo
```

## Option B — publish it to GitHub (what you want eventually)

Once the repository is pushed, the index is served by GitHub's raw file host
and needs no local process:

```
https://raw.githubusercontent.com/Thomas1yang/DSH-plugin-theme/main/market-index.json
```

Switch the profile back to it:

```yaml
- id: plugin-market
  name: "@deepseek-ai/dsh-plugin-market"
  config:
    indexes:
      - "https://raw.githubusercontent.com/Thomas1yang/DSH-plugin-theme/main/market-index.json"
```

## Pushing to GitHub

The repository `Thomas1yang/DSH-plugin-theme` exists and is public. Sign in once,
either with the GitHub CLI:

```sh
gh auth login
```

or with a personal access token that has the `repo` scope:

```sh
git remote set-url origin https://<user>:<token>@github.com/Thomas1yang/DSH-plugin-theme.git
```

Then push:

```sh
cd ~/Downloads/DSH-plugin
git push -u origin main
```

The repository has five commits and the remote is empty, so this creates
`main` on GitHub with nothing to merge.

If you prefer SSH, add a key to your GitHub account and point the remote at
`ssh://git@github.com/Thomas1yang/DSH-plugin-theme.git`. Note that this machine's
global git config rewrites `ssh://git@github.com/` to HTTPS, so remove that
rule first, or the rewrite will force HTTPS and need a token instead:

```sh
git config --global --unset url.https://github.com/.insteadof
```

## Checking that the index is readable

```sh
curl -s https://raw.githubusercontent.com/Thomas1yang/DSH-plugin-theme/main/market-index.json | head -20
```

If that prints the index, the Discover tab can read it. GitHub's raw file host
can take a few seconds to serve a newly pushed file; if the tab still reports
an error, press **刷新** on it.

## Releasing a new version later

```sh
cd dsh-theme-studio
./publish.sh
```

It pushes the repository, regenerates the index so it names the pushed commit,
and pushes the index too. See `dsh-theme-studio/PUBLISHING.md` for details.
