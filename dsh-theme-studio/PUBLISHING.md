# Publishing to the plugin market

The bundle is published through the DSH **plugin market**: a JSON index file
at the repository root that lists the bundle and the exact commit it installs
from. The Plugins page reads that index on its **Discover** tab.

## Layout

This bundle lives in the `dsh-theme-studio/` directory of the `DSH-plugin`
repository, which may hold several plugins.

| Path | Role |
|---|---|
| `../market-index.json` | The format-1 index document at the repository root. The Discover tab reads this over HTTP. |
| `build-market-index.mjs` | Regenerates the root index from the repository's own state and validates it. |

## The index

One plugin, one version, installed from a pinned Git commit:

```json
{
  "format": 1,
  "title": { "en": "…", "zh": "…" },
  "plugins": [{
    "name": "dsh-theme-studio",
    "repository": { "url": "https://github.com/Thomas1yang/DSH-plugin", "directory": "dsh-theme-studio" },
    "versions": [{
      "version": "1.0.0",
      "source": {
        "type": "git",
        "url": "https://github.com/Thomas1yang/DSH-plugin.git",
        "commit": "<sha>",
        "path": "dsh-theme-studio"
      }
    }]
  }]
}
```

The `commit` pins the exact tree that installs, so a published version never
changes under an installer. The `path` names this bundle's directory inside
the repository, which is what makes a multi-plugin repository work.

## Publishing a new version

1. Commit the change:

   ```sh
   git commit -am "…"
   ```

2. Run the publish script. It pushes the repository, regenerates the index so
   it names the pushed commit, and pushes the index:

   ```sh
   ./publish.sh
   ```

   The build script reads `git rev-parse HEAD`, the version from
   `package.json`, and the titles from `locale/*.json`, then validates its
   output with the installed `@deepseek-ai/dsh-plugin-market-index` validator
   before writing it. A malformed index is never published.

3. Bump `version` in `package.json` when the release is a new version. The
   index lists exactly the versions in `package.json`, so a new version needs a
   new entry in the index too.

## Where the index is served from

The index lives at the repository root and the Plugins page reads it from
GitHub's raw file host:

```
https://raw.githubusercontent.com/Thomas1yang/DSH-plugin/main/market-index.json
```

Configure it in **Plugins** > **Custom plugin indexes**, or in the profile's
`cordis.patch.yml`:

```yaml
- id: plugin-market
  name: "@deepseek-ai/dsh-plugin-market"
  config:
    indexes:
      - "https://raw.githubusercontent.com/Thomas1yang/DSH-plugin/main/market-index.json"
```

## Notes

- The index is unsigned: its contents are the index's own claim, and the
  installed manifest decides what is actually installed.
- The icon travels inside the index as a `data:` URL, so the Discover page
  shows it without a second request. The validator caps it at 32 KiB.
- A Git entry's long description is read from the pinned commit, so a README
  edited after a release does not change that release's page.
