# Theme studio

A DSH bundle that puts a **wallpaper** behind the Web GUI, a **title and icon of your own** above the conversation, and your own **colour on the sidebar logo**. It adds one palette entry to the left sidebar; its panel is the only place that edits all of them.

## What it adds

- **Sidebar entry** — a palette icon labelled *Theme studio* / *主题工坊*, placed after the shipped Schedules entry. It opens this bundle's panel in the main column, like the Plugins and Schedules pages.
- **Wallpaper** — a picture painted on the document, behind every column. Upload a file (downscaled to 1920 px) or paste an image address; the address is accepted only after the picture loads.
- **Wallpaper visibility** — the share of the picture that shows through the interface (10–45 %). The plugin tints the theme's base surface, the sidebar fill, and the sidebar glass with the complement, so text keeps its contrast in both light and dark themes. The slider is disabled without a picture.
- **Header title and icon** — a chip at the left of the header row above the conversation, before the Session title. The icon is an emoji, up to 8 characters, or an uploaded image; clicking the chip opens the panel. Both empty keeps the shipped header.
- **New-session home headline** — the large line on a blank new session ("探索未至之境"). Set a headline to replace it, together with the icon from the card above; the shipped headline, its mark, and its preview badge give way while a custom line is set. Empty keeps the shipped home untouched.
- **Sidebar logo and wordmark colour** — the DeepSeek Harness mark at the top left of the sidebar and the wordmark beside it. Pick one of eight colours, one of six gradients, any colour with the colour picker, or leave them on the default. The mark and the wordmark are drawn with the text colour, so this tints those two places and nothing else, in both the expanded row and the collapsed rail, in light and dark themes. A gradient sweeps across the mark and across the wordmark in one go. The letters cut out of the HARNESS badge take a colour that contrasts with the one you picked, so the badge stays readable whatever colour it is.

### The gradients

| Preset | Stops |
| --- | --- |
| `pink-blue` | `#ff6ec7` → `#a855f7` → `#3b82f6` |
| `sunset` | `#f97316` → `#ec4899` |
| `ocean` | `#06b6d4` → `#3b82f6` |
| `mint` | `#10b981` → `#0ea5e9` |
| `grape` | `#8b5cf6` → `#ec4899` |
| `ember` | `#f59e0b` → `#ef4444` |

The mark and the wordmark are two separate drawings in two separate coordinate systems, so a gradient needs two definitions: one spanning the mark's own width and one spanning the wordmark's. A single shared gradient would show the mark only the first fraction of the sweep.


## Usage

1. Open **Theme studio** in the left sidebar.
2. Upload a wallpaper or paste an image address; move **Wallpaper visibility** until the interface reads the way you want.
3. Type a title and an icon (or upload one). The header chip updates as you type.
4. Type a **Home headline** to replace the blank home's "探索未至之境"; the same icon marks it.
5. Pick a **colour** or a **gradient** to tint the sidebar mark and the wordmark beside it, or leave the default swatch alone.
6. **Reset** clears every field; a second click on **Clear all settings?** confirms.

## Storage and limits

- Settings live in this browser's local storage for the app origin (`dsh-theme-studio:v1` for the text settings, `dsh-theme-studio:v1:wallpaper` for the picture). They are not part of a profile, a Session, or another machine.
- Uploaded files are re-encoded down until they fit: at most 1920 px on the long edge and about 1.4 M characters of stored picture, with the icon at 96 px and 240 K characters. A picture that still does not fit is refused with a message instead of appearing and then disappearing on reload.
- Files over 30 MB (8 MB for an icon) are refused before decoding.
- A wallpaper only shows where the theme paints its base surface: the columns, page backgrounds, and the sidebar. Cards, menus, and dialogs keep their own opaque surfaces, which is what keeps controls readable over a picture.
- The logo colour accepts only a hex colour (`#rgb`, `#rgba`, `#rrggbb` or `#rrggbbaa`); anything else stored by an older version is ignored and the default applies. A gradient is stored as a list of at least two colour stops, each a hex colour, and the same rule applies to every stop.
- Removing or disabling the bundle restores the default look immediately: the tint layer, the wallpaper stylesheet, the logo colour, and the gradient definitions all belong to the plugin.

## Layout

- `index.js` — the Host half. It registers nothing; the bundle exists for its Client module.
- `client.js` — the Client module: dictionaries, the settings store, the wallpaper tint, the sidebar logo and wordmark colour, the sidebar entry, the header chip, and the panel.
- `cordis.patch.yml` — inserts this bundle's plugin row.
- `locale/*.json` — Plugin Manager title and description (English and Simplified Chinese).
- `icon.svg` — the bundle's Plugin Manager icon.
- `test-colors.mjs` — a standalone test of the colour helpers. It extracts the functions from `client.js` and exercises them:
  ```sh
  node test-colors.mjs
  ```
