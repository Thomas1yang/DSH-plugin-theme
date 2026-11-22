/**
 * Theme studio — the Client half of the bundle.
 *
 * One sidebar entry opens a panel that sets three presentation choices:
 *   - a wallpaper painted on the document, with a tint over the interface so
 *     text keeps its contrast;
 *   - a title and an icon shown in the conversation header, before the Session
 *     title (the row above the conversation);
 *   - nothing else: the rest of the interface inherits the host theme.
 *
 * The wallpaper tint rides `ctx.theme.overrideTokens` (the sanctioned token
 * seam) and the picture rides one plugin-owned stylesheet, so both are removed
 * when the plugin unloads. The settings are presentation-only and live in this
 * browser's local storage; the Host half has no state.
 */

window.__ModuleLoader__.load({
  id: 'dsh-theme-studio',
  factory(require) {
    const React = require('react')
    const h = React.createElement
    const { useState, useEffect } = React

    /** Locale namespace of this plugin's own client dictionaries. */
    const NS = 'theme-studio'
    /** One id addresses both the sidebar entry and its main panel. */
    const PANEL_ID = 'theme-studio'
    /** Browser-local storage keys; the payload is presentation-only. */
    const STORAGE_KEY = 'dsh-theme-studio:v1'
    /** The picture rides its own key so typing a title never rewrites megabytes. */
    const STORAGE_WALLPAPER_KEY = 'dsh-theme-studio:v1:wallpaper'
    /** Sidebar position: after the shipped Schedules entry (order 10). */
    const SIDEBAR_ORDER = 20
    const MAX_TITLE = 48
    const MAX_ICON_TEXT = 8
    /**
     * Stored budgets in characters. Chromium measures the ~5 MB origin quota in
     * UTF-16, so the picture, the icon, and the small settings object together
     * stay well under it.
     */
    const MAX_WALLPAPER_CHARS = 1400000
    const MAX_ICON_CHARS = 240000
    /** Refuse enormous files before decode allocates their full bitmap. */
    const MAX_WALLPAPER_FILE_BYTES = 30 * 1024 * 1024
    const MAX_ICON_FILE_BYTES = 8 * 1024 * 1024
    /** Default and range of the wallpaper's see-through percentage. */
    const DEFAULT_VISIBILITY = 18
    const MIN_VISIBILITY = 10
    const MAX_VISIBILITY = 45
    /** Longest edge an uploaded wallpaper keeps; larger files are downscaled. */
    const WALLPAPER_EDGE = 1920
    /** Square canvas edge for an uploaded header icon. */
    const ICON_EDGE = 96
    /**
     * Colours offered for the sidebar mark. They are chosen to stay legible
     * against both the light and the dark sidebar, and the first of them is
     * the DeepSeek blue the shipped mark is drawn in.
     */
    const BRAND_COLOR_SWATCHES = [
      '#4d6bfe',
      '#0f6bff',
      '#7c3aed',
      '#0d9488',
      '#d97706',
      '#dc2626',
      '#db2777',
      '#64748b',
    ]

    /** English dictionary (the fallback locale of the client). */
    const EN = {
      'nav.label': 'Theme studio',
      'page.title': 'Theme studio',
      'page.desc': 'A wallpaper behind the interface, and a title and icon of your own above the conversation.',
      'page.note': 'Settings are stored in this browser and apply immediately. Removing the plugin restores the default look.',
      'wallpaper.title': 'Wallpaper',
      'wallpaper.desc': 'The picture sits behind every column. A tint of the active theme keeps the interface readable over it.',
      'wallpaper.empty': 'No wallpaper yet — upload a picture or paste an image address.',
      'wallpaper.url': 'Image address',
      'wallpaper.urlPlaceholder': 'https://example.com/wallpaper.jpg',
      'wallpaper.visibility': 'Wallpaper visibility',
      'wallpaper.visibilityValue': '{value}%',
      'wallpaper.visibilityHint': 'The share of the picture that shows through the interface. Higher values look richer but soften text contrast.',
      'brand.title': 'Header title and icon',
      'brand.desc': 'Shown at the left of the header row above the conversation. Leave both empty to keep the default header.',
      'brand.empty': 'Nothing shown yet',
      'brand.titleLabel': 'Title',
      'brand.titlePlaceholder': 'Harness Studio',
      'brand.iconLabel': 'Icon',
      'brand.iconHint': 'Type an emoji or up to {count} characters, or upload a small image.',
      'brand.iconUploaded': 'Uploaded image',
      'hero.title': 'New-session home',
      'hero.desc': 'The large line on a blank new session. Setting it replaces the default headline and the mark before it.',
      'hero.titleLabel': 'Home headline',
      'hero.placeholder': 'e.g. My workbench',
      'hero.hint': 'The mark before it reuses the icon from the previous card. Leave this empty to keep the default headline and logo.',
      'logo.title': 'Sidebar logo and wordmark colour',
      'logo.desc': 'The DeepSeek Harness mark and the wordmark beside it, at the top left of the sidebar. Pick a colour or leave them on the default.',
      'logo.label': 'Logo colour',
      'logo.default': 'Default',
      'logo.hint': 'The mark and the wordmark are drawn with the text colour, so this tints only them. The letters in the HARNESS badge keep their contrast on the colour you pick. It works in both light and dark themes.',
      'logo.custom': 'Custom colour',
      'logo.swatches': 'Colours',
      'action.upload': 'Upload image',
      'action.applyUrl': 'Use address',
      'action.clear': 'Remove',
      'action.reset': 'Reset',
      'action.resetConfirm': 'Clear all settings?',
      'status.saved': 'Saved',
      'error.storage': 'Could not save in this browser: its storage is full.',
      'error.image': 'That file is not an image the browser can read.',
      'error.tooLarge': 'That picture is too large for browser storage. Try a smaller one.',
      'error.url': 'That address did not load a picture. Use an http:// or https:// link to an image.',
      'error.heroSeat': 'Another plugin holds the new-session home, so the default headline stays.',
      'chip.tooltip': 'Open the theme studio',
    }

    /** Simplified Chinese dictionary. */
    const ZH = {
      'nav.label': '主题工坊',
      'page.title': '主题工坊',
      'page.desc': '给界面铺一张壁纸，并在对话区上方显示你自己的标题和图标。',
      'page.note': '设置保存在当前浏览器，修改即时生效。卸载插件后恢复默认外观。',
      'wallpaper.title': '壁纸',
      'wallpaper.desc': '图片铺在所有栏目的后面，界面会叠一层当前主题的底色，保证文字可读。',
      'wallpaper.empty': '还没有壁纸——上传一张图片，或填写图片地址。',
      'wallpaper.url': '图片地址',
      'wallpaper.urlPlaceholder': 'https://example.com/wallpaper.jpg',
      'wallpaper.visibility': '壁纸可见度',
      'wallpaper.visibilityValue': '{value}%',
      'wallpaper.visibilityHint': '壁纸透过界面的比例。数值越高壁纸越明显，但文字对比度会降低。',
      'brand.title': '对话区标题与图标',
      'brand.desc': '显示在对话区上方标题行的左侧。两项都留空即保持默认标题行。',
      'brand.empty': '暂时没有内容',
      'brand.titleLabel': '标题',
      'brand.titlePlaceholder': '我的工坊',
      'brand.iconLabel': '图标',
      'brand.iconHint': '输入一个 emoji 或最多 {count} 个字符，也可以上传一张小图。',
      'brand.iconUploaded': '已上传图片',
      'hero.title': '新会话首页',
      'hero.desc': '空白新会话首页上的大标题。设置后会替换默认文案和它前面的图标。',
      'hero.titleLabel': '首页标题',
      'hero.placeholder': '例如：我的工作台',
      'hero.hint': '前面的图标沿用上一张卡片里的「图标」。留空则保留默认的「探索未至之境」和鲸鱼图标。',
      'logo.title': '侧栏图标与文字颜色',
      'logo.desc': '左侧栏左上角的 DeepSeek Harness 图标，以及它右边的文字。可以选一个颜色，或者保持默认。',
      'logo.label': '图标颜色',
      'logo.default': '默认',
      'logo.hint': '图标和文字都用文字颜色绘制，所以这里只影响这两处。HARNESS 标签里的字母会按你选的颜色自动调整深浅以保证清晰。浅色和深色主题都生效。',
      'logo.custom': '自定义颜色',
      'logo.swatches': '颜色',
      'action.upload': '上传图片',
      'action.applyUrl': '使用地址',
      'action.clear': '移除',
      'action.reset': '恢复默认',
      'action.resetConfirm': '清空全部设置？',
      'status.saved': '已保存',
      'error.storage': '无法保存：浏览器存储空间不足。',
      'error.image': '这个文件不是浏览器能读取的图片。',
      'error.tooLarge': '图片太大，浏览器存不下。请换一张更小的图片。',
      'error.url': '这个地址没有取到图片，请换成以 http:// 或 https:// 开头的图片链接。',
      'error.heroSeat': '新会话首页已被其他插件占用，首页标题保持默认。',
      'chip.tooltip': '打开主题工坊',
    }

    /* ------------------------------------------------------------------ *
     * Plugin-owned stylesheet
     * ------------------------------------------------------------------ */

    /**
     * Every rule is scoped to the plugin's own `dts-` classes, except the one
     * wallpaper rule that must paint the document canvas.
     */
    const STYLES = [
      ".dts-page{display:flex;width:100%;height:100%;min-width:0;min-height:0;overflow:hidden;color:var(--dsw-alias-label-primary);background:var(--dsw-alias-bg-base);font-size:14px;line-height:1.6}",
      ".dts-scroll{flex:1;min-width:0;min-height:0;overflow:auto;scrollbar-gutter:stable;--dsh-scrollbar-width:9px;--dsh-scrollbar-thumb-border:2px}",
      ".dts-content{max-width:960px;margin:0 auto;padding:0 clamp(24px,4vw,48px) 48px}",
      "@media (max-width:767px){.dts-content{padding-inline:20px}}",
      ".dts-heading{display:flex;flex-wrap:wrap;align-items:flex-start;justify-content:space-between;gap:16px;padding-top:28px;margin-bottom:24px}",
      "html[data-platform='darwin'] .dts-heading{padding-top:calc(28px + var(--dsh-frame-top-clearance,0px))}",
      ".dts-heading-main{flex:1 1 320px;min-width:0}",
      ".dts-heading h1{margin:0;font-size:20px;line-height:28px;font-weight:500}",
      ".dts-lede{margin:6px 0 0;font-size:13px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
      ".dts-heading-actions{display:flex;flex:none;align-items:center;gap:12px;padding-top:2px}",
      ".dts-status{min-width:52px;text-align:right;font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
      ".dts-status[data-kind='error']{color:var(--dsw-alias-state-error-primary)}",
      ".dts-card{margin-bottom:16px;padding:16px 18px 18px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-lg);background:var(--dsw-alias-bg-layer-1)}",
      ".dts-card-head{display:flex;flex-direction:column;gap:2px}",
      ".dts-card-head h2{margin:0;font-size:15px;line-height:22px;font-weight:600}",
      ".dts-card-head p{margin:0;font-size:12.5px;line-height:19px;color:var(--dsw-alias-label-secondary)}",
      ".dts-row{display:flex;flex-direction:column;gap:6px;margin-top:16px}",
      ".dts-row-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px}",
      ".dts-label{font-size:13px;line-height:20px;font-weight:500}",
      ".dts-value{font-size:12px;line-height:20px;color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}",
      ".dts-hint{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
      ".dts-error{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}",
      ".dts-inline{display:flex;flex-wrap:wrap;align-items:center;gap:8px}",
      ".dts-input{flex:1 1 200px;min-width:0;height:32px;padding:0 10px;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px}",
      ".dts-input::placeholder{color:var(--dsw-alias-label-dimmed)}",
      ".dts-input:focus{border-color:var(--dsw-alias-state-business-primary)}",
      ".dts-input[data-width='icon']{flex:0 1 150px}",
      ".dts-input[aria-invalid='true']{border-color:var(--dsw-alias-state-error-primary)}",
      ".dts-btn{flex:none;height:28px;padding:0 10px;border:0;border-radius:var(--dsw-radius-sm);background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;line-height:18px;cursor:pointer}",
      ".dts-btn:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover)}",
      ".dts-btn:active:not(:disabled){background:var(--dsw-alias-interactive-bg-active)}",
      ".dts-btn:disabled{opacity:.4;cursor:not-allowed}",
      ".dts-btn[data-variant='primary']{background:var(--dsw-alias-button-primary-fill);color:var(--dsw-alias-label-primary-foreground)}",
      ".dts-btn[data-variant='primary']:hover:not(:disabled){background:var(--dsw-alias-button-primary-hover)}",
      ".dts-btn[data-variant='danger']{color:var(--dsw-alias-state-error-primary)}",
      ".dts-btn:focus-visible,.dts-input:focus-visible,.dts-chip:focus-visible,.dts-range:focus-visible,.dts-swatch:focus-visible,.dts-color:focus-visible{outline:2px solid var(--dsw-focus-ring-color,var(--dsw-alias-state-business-primary));outline-offset:2px}",
      ".dts-badge{flex:none;height:20px;padding:0 8px;border-radius:10px;background:var(--dsw-alias-interactive-bg-hover);font-size:11px;line-height:20px;color:var(--dsw-alias-label-secondary)}",
      ".dts-range{width:100%;height:20px;margin:0;accent-color:var(--dsw-alias-brand-primary)}",
      ".dts-range:disabled{opacity:.5}",
      ".dts-wallpaper{position:relative;display:flex;align-items:center;justify-content:center;margin-top:14px;aspect-ratio:16/9;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background-color:var(--dsw-alias-bg-layer-2);background-position:center;background-size:cover;background-repeat:no-repeat;overflow:hidden}",
      ".dts-wallpaper-empty{padding:0 16px;text-align:center;font-size:12.5px;color:var(--dsw-alias-label-secondary)}",
      ".dts-preview{display:flex;align-items:center;min-height:46px;margin-top:14px;padding:0 14px;border:0.5px solid var(--dsw-alias-border-l1);border-radius:var(--dsw-radius-md);background:var(--dsw-alias-bg-base);overflow:hidden}",
      ".dts-preview-empty{font-size:12.5px;color:var(--dsw-alias-label-secondary)}",
      ".dts-chip{display:inline-flex;align-items:center;gap:8px;max-width:100%;height:28px;margin:0;padding:0 8px;border:0;border-radius:14px;background:transparent;color:var(--dsw-alias-label-primary);font:inherit;font-size:14px;font-weight:500;line-height:20px;cursor:pointer;-webkit-app-region:no-drag}",
      ".dts-chip--header{margin-left:max(0px,calc(var(--dsh-frame-leading-clearance,0px) - 20px))}",
      ".dts-chip:hover{background:var(--dsw-alias-interactive-bg-hover)}",
      ".dts-chip[data-static='true']{cursor:default}",
      ".dts-chip[data-static='true']:hover{background:transparent}",
      ".dts-chip-title{max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
      ".dts-chip-glyph{display:inline-flex;flex:none;align-items:center;justify-content:center;width:20px;height:20px;border-radius:5px;overflow:hidden;font-size:16px;line-height:1}",
      ".dts-chip-glyph img{display:block;width:100%;height:100%;object-fit:contain}",
      ".dts-icon-slot{display:inline-flex;flex:none;align-items:center;justify-content:center;width:32px;height:32px;border:1px dashed var(--dsw-alias-border-l2);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-layer-2);overflow:hidden;font-size:18px;line-height:1}",
      ".dts-icon-slot img{display:block;width:100%;height:100%;object-fit:contain}",
      // The sidebar mark is the fish the shell draws with `currentColor`, so
      // recolouring it is a matter of setting the colour on that one path.
      // The path data is the shell's own artwork, which no other icon shares,
      // so the selector names exactly the mark in the expanded row and in the
      // collapsed rail alike.
      "[data-slot='sidebar'] svg path[d^='M22.9168']{fill:var(--dts-brand-color,currentColor)}",
      // The wordmark beside it is drawn with the same `currentColor`: the
      // "deepseek" lettering and the HARNESS badge pill. The badge letters are
      // cut out of the pill in the theme's inverted ink, so they follow a
      // separate variable that keeps them readable on the chosen colour.
      "[data-slot='sidebar.brand.name'] svg path[fill='currentColor']{fill:var(--dts-brand-color,currentColor)}",
      "[data-slot='sidebar.brand.name'] svg rect[fill='currentColor']{fill:var(--dts-brand-color,currentColor)}",
      "[data-slot='sidebar.brand.name'] svg path[fill*='label-primary-inverted']{fill:var(--dts-badge-ink,var(--dsw-alias-label-primary-inverted))}",
      ".dts-swatches{display:flex;flex-wrap:wrap;align-items:center;gap:6px}",
      ".dts-swatch{position:relative;width:24px;height:24px;padding:0;border:1px solid var(--dsw-alias-border-l2);border-radius:50%;cursor:pointer;background-clip:padding-box}",
      ".dts-swatch:hover{border-color:var(--dsw-alias-border-l4)}",
      ".dts-swatch[aria-pressed='true']{box-shadow:0 0 0 2px var(--dsw-alias-bg-layer-1),0 0 0 3.5px var(--dsw-alias-brand-primary)}",
      ".dts-swatch[data-default='true']{background:repeating-conic-gradient(var(--dsw-alias-label-secondary) 0 25%,var(--dsw-alias-bg-layer-2) 0 50%) 50%/10px 10px;border-color:var(--dsw-alias-border-l4)}",
      ".dts-color{flex:none;width:32px;height:28px;padding:2px;border:0.5px solid var(--dsw-alias-border-l4);border-radius:var(--dsw-radius-sm);background:var(--dsw-alias-bg-base);cursor:pointer}",
      ".dts-color::-webkit-color-swatch-wrapper{padding:0}",
      ".dts-color::-webkit-color-swatch{border:none;border-radius:3px}",
      ".dts-note{margin:0;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}",
      ".dts-hero{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-width:0;max-width:100%}",
      ".dts-hero-glyph{display:inline-flex;flex:none;align-items:center;justify-content:center;width:34px;height:34px;border-radius:8px;overflow:hidden;font-size:28px;line-height:1}",
      ".dts-hero-glyph img{display:block;width:100%;height:100%;object-fit:contain}",
      ".dts-hero-title{min-width:0;overflow-wrap:anywhere;text-wrap:balance}",
      // The hero headline text is the owner's own span, not a slot we can replace:
      // the shipped title cell beside the mark cell is hidden while our
      // replacement renders, so the copy is *replaced*, not appended.
      //
      // The title cell is a SPAN sibling of the mark cell's ancestors (the mark
      // cell wraps our entry in one or two wrappers whose depth differs between
      // outlet implementations), so this matches it at whatever level it sits:
      // every ancestor of our marker that has a span child which neither is nor
      // contains our marker hides that child. Only spans match, so the
      // conversation body, composer, and every column (divs) stay untouched.
      "*:has([data-dts-hero]) > span:not(:has([data-dts-hero])):not([data-dts-hero]){display:none!important}",
      // Let the mark cell shrink with a long headline instead of overflowing.
      "*:has(> [data-dts-hero]){flex:0 1 auto;min-width:0;justify-content:center}",
      "*:has(> [data-slot='conversation.hero.brand.mark'] [data-dts-hero]){flex:0 1 auto;min-width:0;justify-content:center}",
    ].join('\n')

    /**
     * The document wallpaper. Both quotes and backslashes are escaped by
     * `JSON.stringify`, which is also a valid CSS string literal, so a stored
     * address cannot close the `url()` early.
     * @param url - data URL or http(s) address of the picture.
     * @returns one rule that paints the canvas.
     */
    function wallpaperRule(url) {
      return [
        'html body{',
        `background-image:url(${JSON.stringify(url)})!important;`,
        'background-position:center center!important;',
        'background-size:cover!important;',
        'background-repeat:no-repeat!important;',
        'background-attachment:fixed!important}',
      ].join('')
    }

    /* ------------------------------------------------------------------ *
     * Tolerant settings model
     * ------------------------------------------------------------------ */

    /** @param value - candidate stored value. @returns whether it names a picture. */
    function isImageRef(value) {
      return typeof value === 'string' && (/^data:image\//i.test(value) || /^https?:\/\//i.test(value))
    }

    /**
     * Clamp one stored number into its range.
     * @param value - candidate value.
     * @param min - smallest accepted value.
     * @param max - largest accepted value.
     * @param fallback - value used when the candidate is not a finite number.
     * @returns the clamped integer.
     */
    function clampInt(value, min, max, fallback) {
      const number = typeof value === 'number' ? value : Number(value)
      if (!Number.isFinite(number)) return fallback
      return Math.min(max, Math.max(min, Math.round(number)))
    }

    /**
     * A colour the panel can offer and apply: a six-digit hex, with an
     * optional leading alpha, in the `#rgb`, `#rgba`, `#rrggbb` or
     * `#rrggbbaa` spelling. Only these spellings are accepted, so the value
     * that reaches the stylesheet is always a colour and never anything else.
     */
    const HEX_COLOR = /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i

    /**
     * Whether a stored value names a colour the panel can apply.
     * @param value - the candidate value.
     * @returns whether it is a usable hex colour.
     */
    function isHexColor(value) {
      return typeof value === 'string' && HEX_COLOR.test(value)
    }

    /**
     * The relative luminance of a hex colour, on the usual 0-to-1 scale.
     *
     * The three- and four-digit spellings are expanded first, and a colour
     * with an alpha channel is read as its own colour: the badge letters sit
     * on top of the pill, so the pill's own colour is what decides their
     * contrast.
     * @param value - a hex colour.
     * @returns the luminance, or null when the colour cannot be read.
     */
    function luminanceOf(value) {
      if (!isHexColor(value)) return null
      let hex = value.slice(1)
      if (hex.length === 3 || hex.length === 4) {
        // #rgb and #rgba each repeat their own digits.
        hex = hex.slice(0, 3).split('').map((digit) => digit + digit).join('')
      } else if (hex.length === 8) {
        // #rrggbbaa keeps only the colour part.
        hex = hex.slice(0, 6)
      }
      if (hex.length !== 6) return null
      const channels = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255)
      const linear = channels.map((channel) => (channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4))
      return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]
    }

    /**
     * The colour to knock the HARNESS badge letters out with.
     *
     * The badge is a filled pill with the letters cut out of it, so the
     * letters need the colour that contrasts with the pill. The pill follows
     * the chosen brand colour, so the letters follow that colour's
     * luminance: light on a dark brand colour, dark on a light one.
     * @param value - the chosen hex colour.
     * @returns the hex colour for the letters, or null when it cannot be read.
     */
    function badgeLetterColor(value) {
      const luminance = luminanceOf(value)
      if (luminance === null) return null
      // The midpoint of the scale is where a background stops being clearly
      // dark or clearly light; below it a dark letter reads better.
      return luminance > 0.45 ? '#15181d' : '#ffffff'
    }

    /**
     * Coerce whatever storage held into the current settings shape, dropping
     * fields a newer or older version wrote in a shape this version cannot use.
     * @param raw - parsed storage payload, possibly absent or foreign.
     * @param storedWallpaper - picture from its own storage key.
     * @returns complete, validated settings.
     */
    function normalizeSettings(raw, storedWallpaper) {
      const source = raw !== null && typeof raw === 'object' ? raw : {}
      const title = typeof source.title === 'string' ? source.title.slice(0, MAX_TITLE) : ''
      const rawIcon = typeof source.icon === 'string' ? source.icon : ''
      const icon = isImageRef(rawIcon) || rawIcon.length <= MAX_ICON_TEXT ? rawIcon : rawIcon.slice(0, MAX_ICON_TEXT)
      const wallpaper = isImageRef(storedWallpaper) && storedWallpaper.length <= MAX_WALLPAPER_CHARS
        ? storedWallpaper : ''
      const heroTitle = typeof source.heroTitle === 'string' ? source.heroTitle.slice(0, MAX_TITLE) : ''
      return {
        title,
        icon,
        heroTitle,
        wallpaper,
        brandColor: isHexColor(source.brandColor) ? source.brandColor : '',
        visibility: clampInt(source.visibility, MIN_VISIBILITY, MAX_VISIBILITY, DEFAULT_VISIBILITY),
      }
    }

    /** @returns settings read from this browser, or the defaults. */
    function loadSettings() {
      let stored = null
      let wallpaper = ''
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY)
        stored = raw === null ? null : JSON.parse(raw)
      } catch {
        stored = null
      }
      try {
        wallpaper = window.localStorage.getItem(STORAGE_WALLPAPER_KEY) ?? ''
      } catch {
        wallpaper = ''
      }
      return normalizeSettings(stored, wallpaper)
    }

    /* ------------------------------------------------------------------ *
     * Small React stores
     * ------------------------------------------------------------------ */

    /**
     * State with a stable snapshot reference, so subscribers read one value.
     * @param initial - first snapshot.
     * @returns read, write, and subscribe faces.
     */
    function createStore(initial) {
      let state = initial
      const listeners = new Set()
      return {
        get: () => state,
        set(patch) {
          const next = { ...state, ...patch }
          if (next.title === state.title && next.icon === state.icon && next.heroTitle === state.heroTitle
            && next.wallpaper === state.wallpaper && next.visibility === state.visibility
            && next.brandColor === state.brandColor) return
          state = next
          for (const listener of listeners) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      }
    }

    /**
     * Minimal signal for transient notices.
     * @param initial - first value.
     * @returns read, write, and subscribe faces.
     */
    function createSignal(initial) {
      let value = initial
      const listeners = new Set()
      return {
        get: () => value,
        set(next) {
          value = next
          for (const listener of listeners) listener()
        },
        subscribe(listener) {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
      }
    }

    /** @param store - a createStore/createSignal result. @returns its current value. */
    function useValue(store) {
      return React.useSyncExternalStore(store.subscribe, store.get, store.get)
    }

    /* ------------------------------------------------------------------ *
     * Image intake
     * ------------------------------------------------------------------ */

    /**
     * Ask the OS for one image file.
     * @returns the chosen file, or null when the picker was dismissed.
     */
    function pickImage() {
      return new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = 'image/*'
        input.addEventListener('change', () => {
          resolve(input.files && input.files[0] ? input.files[0] : null)
        }, { once: true })
        input.addEventListener('cancel', () => { resolve(null) }, { once: true })
        input.click()
      })
    }

    /**
     * Read one file as a data URL.
     * @param file - the chosen file.
     * @returns the encoded file.
     */
    function readAsDataUrl(file) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => { resolve(typeof reader.result === 'string' ? reader.result : '') }
        reader.onerror = () => { reject(new Error('read')) }
        reader.readAsDataURL(file)
      })
    }

    /**
     * Decode an image file off the main thread when the platform allows it.
     * @param file - the chosen file.
     * @returns the bitmap, or null when this browser cannot decode it.
     */
    async function decodeImage(file) {
      if (typeof createImageBitmap !== 'function') return null
      try {
        return await createImageBitmap(file)
      } catch {
        return null
      }
    }

    /**
     * Check that a remote picture really loads before it becomes the
     * wallpaper, with a bound on a host that never answers.
     * @param url - http(s) address of the picture.
     * @returns resolution once the browser decoded the address.
     */
    function preloadImage(url) {
      return new Promise((resolve, reject) => {
        const image = new Image()
        const timer = setTimeout(() => { image.src = ''; reject(new Error('timeout')) }, 10000)
        image.onload = () => { clearTimeout(timer); resolve() }
        image.onerror = () => { clearTimeout(timer); reject(new Error('load')) }
        image.src = url
      })
    }

    /**
     * Draw one bitmap into a JPEG data URL at a bounded edge.
     * @param bitmap - decoded picture.
     * @param edge - longest accepted edge in pixels.
     * @param quality - JPEG quality, 0–1.
     * @returns the encoded data URL.
     */
    function encodeWallpaper(bitmap, edge, quality) {
      const scale = Math.min(1, edge / Math.max(bitmap.width, bitmap.height))
      const width = Math.max(1, Math.round(bitmap.width * scale))
      const height = Math.max(1, Math.round(bitmap.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const context = canvas.getContext('2d')
      if (context === null) throw new Error('canvas')
      context.drawImage(bitmap, 0, 0, width, height)
      return canvas.toDataURL('image/jpeg', quality)
    }

    /**
     * Turn a chosen file into a stored wallpaper, downscaling it first so the
     * payload fits in browser storage. A picture that does not fit once is
     * re-encoded smaller instead of being refused.
     * @param file - the chosen file.
     * @returns a data URL within {@link MAX_WALLPAPER_CHARS}, or the raw file URL.
     */
    async function fileToWallpaper(file) {
      if (!file.type.startsWith('image/')) throw new Error('unsupported')
      if (file.size > MAX_WALLPAPER_FILE_BYTES) throw new Error('too-large')
      const bitmap = await decodeImage(file)
      if (bitmap === null) {
        const url = await readAsDataUrl(file)
        if (url.length > MAX_WALLPAPER_CHARS) throw new Error('too-large')
        return url
      }
      try {
        let edge = WALLPAPER_EDGE
        let quality = 0.84
        for (let attempt = 0; attempt < 4; attempt += 1) {
          const url = encodeWallpaper(bitmap, edge, quality)
          if (url.length <= MAX_WALLPAPER_CHARS) return url
          edge = Math.max(640, Math.round(edge * 0.72))
          quality = Math.max(0.55, quality - 0.08)
        }
        throw new Error('too-large')
      } finally {
        if (typeof bitmap.close === 'function') bitmap.close()
      }
    }

    /**
     * Turn a chosen file into a stored header icon: a small transparent square.
     * @param file - the chosen file.
     * @returns a PNG data URL within {@link MAX_ICON_CHARS}.
     */
    async function fileToIcon(file) {
      if (!file.type.startsWith('image/')) throw new Error('unsupported')
      if (file.size > MAX_ICON_FILE_BYTES) throw new Error('too-large')
      const bitmap = await decodeImage(file)
      if (bitmap === null) {
        const url = await readAsDataUrl(file)
        if (url.length > MAX_ICON_CHARS) throw new Error('too-large')
        return url
      }
      try {
        const scale = Math.min(1, ICON_EDGE / Math.max(bitmap.width, bitmap.height))
        const width = Math.max(1, Math.round(bitmap.width * scale))
        const height = Math.max(1, Math.round(bitmap.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = ICON_EDGE
        canvas.height = ICON_EDGE
        const context = canvas.getContext('2d')
        if (context === null) throw new Error('canvas')
        context.drawImage(bitmap, Math.round((ICON_EDGE - width) / 2), Math.round((ICON_EDGE - height) / 2), width, height)
        const url = canvas.toDataURL('image/png')
        if (url.length > MAX_ICON_CHARS) throw new Error('too-large')
        return url
      } finally {
        if (typeof bitmap.close === 'function') bitmap.close()
      }
    }

    /**
     * Map a conversion failure to the dictionary key the panel shows.
     * @param error - thrown value.
     * @returns the message key.
     */
    function errorKey(error) {
      const message = error instanceof Error ? error.message : ''
      return message === 'too-large' ? 'error.tooLarge' : 'error.image'
    }

    /* ------------------------------------------------------------------ *
     * Components
     * ------------------------------------------------------------------ */

    /**
     * The palette glyph: the sidebar entry and the plugin's own mark.
     * @param props.size - square edge in pixels.
     * @returns decorative palette.
     */
    function PaletteGlyph({ size }) {
      const edge = typeof size === 'number' && size > 0 ? size : 18
      return h('svg', {
        xmlns: 'http://www.w3.org/2000/svg',
        width: edge,
        height: edge,
        viewBox: '0 0 24 24',
        fill: 'none',
        'aria-hidden': true,
        focusable: 'false',
        style: { display: 'block' },
      },
      h('path', {
        d: 'M12 3a9 9 0 1 0 0 18h1.4a2.6 2.6 0 0 0 1.8-4.4 1.7 1.7 0 0 1 1.2-2.9h2.1a3.5 3.5 0 0 0 3.5-3.5A9 9 0 0 0 12 3Z',
        stroke: 'currentColor',
        strokeWidth: 1.6,
        strokeLinejoin: 'round',
        strokeLinecap: 'round',
      }),
      h('circle', { cx: 7.5, cy: 10.5, r: 1.1, fill: 'currentColor' }),
      h('circle', { cx: 11, cy: 7.5, r: 1.1, fill: 'currentColor' }),
      h('circle', { cx: 15.5, cy: 9, r: 1.1, fill: 'currentColor' }))
    }

    /**
     * Render a configured icon: an uploaded picture or the typed glyph.
     * @param props.value - stored icon value.
     * @param props.size - square edge for the picture.
     * @returns the icon content, or null when nothing is configured.
     */
    function IconContent({ value, size }) {
      if (value === '') return null
      if (isImageRef(value)) {
        return h('img', { src: value, alt: '', width: size, height: size, draggable: false })
      }
      return h('span', { 'aria-hidden': true }, value)
    }

    /**
     * The header chip: the custom title and icon, at the left of the row above
     * the conversation. Clicking it opens the panel.
     * @param props.t - localized text.
     * @param props.settings - the plugin settings store.
     * @param props.openPanel - selects this plugin's main panel.
     * @returns the chip, or null when nothing is configured.
     */
    function HeaderChip({ t, settings, openPanel }) {
      const state = useValue(settings)
      const title = state.title.trim()
      if (title === '' && state.icon === '') return null
      return h('button', {
        type: 'button',
        className: 'dts-chip dts-chip--header',
        title: t('chip.tooltip'),
        'aria-label': t('chip.tooltip'),
        onClick: openPanel,
      },
      state.icon === ''
        ? null
        : h('span', { className: 'dts-chip-glyph' }, h(IconContent, { value: state.icon, size: 18 })),
      title === '' ? null : h('span', { className: 'dts-chip-title' }, title))
    }

    /**
     * The blank-session home headline replacement: the custom line, with the
     * custom icon when one is configured, takes the place of the shipped
     * headline and its mark. Registered only while a headline is set, so the
     * shipped home is untouched without one.
     * @param props.settings - the plugin settings store.
     * @returns the branded home line, or null while no headline is set.
     */
    function HeroBrand({ settings }) {
      const state = useValue(settings)
      const headline = state.heroTitle.trim()
      if (headline === '') return null
      return h('span', { className: 'dts-hero', 'data-dts-hero': '' },
        state.icon === ''
          ? null
          : h('span', { className: 'dts-hero-glyph' }, h(IconContent, { value: state.icon, size: 34 })),
        h('span', { className: 'dts-hero-title' }, headline))
    }

    /**
     * The theme-studio panel: wallpaper intake, tint, and header branding.
     * @param props.t - localized text.
     * @param props.settings - the plugin settings store.
     * @param props.status - the transient save/error notice signal.
     * @returns the panel page.
     */
    function ThemeStudioPage({ t, settings, status }) {
      const state = useValue(settings)
      const notice = useValue(status)
      const [urlDraft, setUrlDraft] = useState('')
      const [confirmReset, setConfirmReset] = useState(false)
      const [busy, setBusy] = useState(false)

      useEffect(() => {
        if (!confirmReset) return undefined
        const timer = setTimeout(() => { setConfirmReset(false) }, 4000)
        return () => { clearTimeout(timer) }
      }, [confirmReset])

      const report = (message, field) => { status.set({ kind: 'error', message, field }) }
      const clearNotice = () => { status.set({ kind: 'idle', message: '', field: '' }) }

      const uploadWallpaper = async () => {
        const file = await pickImage()
        if (file === null) return
        setBusy(true)
        try {
          const url = await fileToWallpaper(file)
          settings.set({ wallpaper: url })
          clearNotice()
        } catch (error) {
          report(errorKey(error), 'wallpaper')
        } finally {
          setBusy(false)
        }
      }

      const applyUrl = async () => {
        const value = urlDraft.trim()
        if (!/^https?:\/\//i.test(value)) {
          report('error.url', 'wallpaper')
          return
        }
        setBusy(true)
        try {
          // The address is accepted only once the picture actually loads, so a
          // dead link reports here instead of leaving an empty wallpaper.
          await preloadImage(value)
          settings.set({ wallpaper: value })
          setUrlDraft('')
          clearNotice()
        } catch {
          report('error.url', 'wallpaper')
        } finally {
          setBusy(false)
        }
      }

      const uploadIcon = async () => {
        const file = await pickImage()
        if (file === null) return
        setBusy(true)
        try {
          const url = await fileToIcon(file)
          settings.set({ icon: url })
          clearNotice()
        } catch (error) {
          report(errorKey(error), 'brand')
        } finally {
          setBusy(false)
        }
      }

      const reset = () => {
        if (!confirmReset) {
          setConfirmReset(true)
          return
        }
        setConfirmReset(false)
        setUrlDraft('')
        settings.set({ title: '', icon: '', heroTitle: '', wallpaper: '', brandColor: '', visibility: DEFAULT_VISIBILITY })
        clearNotice()
      }

      const iconIsImage = isImageRef(state.icon)
      const statusText = notice.kind === 'saved'
        ? t('status.saved')
        : notice.kind === 'error' && notice.field === 'save' ? t(notice.message) : ''
      const wallpaperError = notice.kind === 'error' && notice.field === 'wallpaper' ? t(notice.message) : ''
      const brandError = notice.kind === 'error' && notice.field === 'brand' ? t(notice.message) : ''
      const heroError = notice.kind === 'error' && notice.field === 'hero' ? t(notice.message) : ''
      const nothingBranded = state.title.trim() === '' && state.icon === ''

      const wallpaperCard = h('section', { className: 'dts-card' },
        h('div', { className: 'dts-card-head' },
          h('h2', null, t('wallpaper.title')),
          h('p', null, t('wallpaper.desc'))),
        h('div', {
          className: 'dts-wallpaper',
          role: 'img',
          'aria-label': state.wallpaper === '' ? t('wallpaper.empty') : t('wallpaper.title'),
          style: state.wallpaper === '' ? undefined : { backgroundImage: `url("${state.wallpaper}")` },
        }, state.wallpaper === ''
          ? h('span', { className: 'dts-wallpaper-empty' }, t('wallpaper.empty'))
          : null),
        h('div', { className: 'dts-row' },
          h('label', { className: 'dts-label', htmlFor: 'dts-wallpaper-url' }, t('wallpaper.url')),
          h('div', { className: 'dts-inline' },
            h('input', {
              id: 'dts-wallpaper-url',
              className: 'dts-input',
              type: 'url',
              inputMode: 'url',
              placeholder: t('wallpaper.urlPlaceholder'),
              value: urlDraft,
              'aria-invalid': wallpaperError === '' ? undefined : 'true',
              'aria-describedby': wallpaperError === '' ? undefined : 'dts-wallpaper-error',
              onChange: (event) => { setUrlDraft(event.target.value) },
              onKeyDown: (event) => {
                if (event.key !== 'Enter' || urlDraft.trim() === '') return
                event.preventDefault()
                applyUrl()
              },
            }),
            h('button', {
              type: 'button',
              className: 'dts-btn',
              disabled: urlDraft.trim() === '' || busy,
              onClick: applyUrl,
            }, t('action.applyUrl')),
            h('button', {
              type: 'button',
              className: 'dts-btn',
              'data-variant': 'primary',
              disabled: busy,
              onClick: uploadWallpaper,
            }, t('action.upload')),
            h('button', {
              type: 'button',
              className: 'dts-btn',
              'data-variant': 'quiet',
              disabled: state.wallpaper === '',
              onClick: () => { settings.set({ wallpaper: '' }); clearNotice() },
            }, t('action.clear'))),
          wallpaperError === ''
            ? null
            : h('p', { id: 'dts-wallpaper-error', className: 'dts-error', role: 'alert' }, wallpaperError)),
        h('div', { className: 'dts-row' },
          h('div', { className: 'dts-row-head' },
            h('label', { className: 'dts-label', htmlFor: 'dts-visibility' }, t('wallpaper.visibility')),
            h('span', { className: 'dts-value' }, t('wallpaper.visibilityValue', { value: String(state.visibility) }))),
          h('input', {
            id: 'dts-visibility',
            className: 'dts-range',
            type: 'range',
            min: String(MIN_VISIBILITY),
            max: String(MAX_VISIBILITY),
            step: '1',
            value: String(state.visibility),
            disabled: state.wallpaper === '',
            'aria-valuetext': `${state.visibility}%`,
            onChange: (event) => {
              settings.set({ visibility: clampInt(event.target.value, MIN_VISIBILITY, MAX_VISIBILITY, DEFAULT_VISIBILITY) })
            },
          }),
          h('p', { className: 'dts-hint' }, t('wallpaper.visibilityHint'))))

      const brandCard = h('section', { className: 'dts-card' },
        h('div', { className: 'dts-card-head' },
          h('h2', null, t('brand.title')),
          h('p', null, t('brand.desc'))),
        h('div', { className: 'dts-preview', 'aria-hidden': true },
          nothingBranded
            ? h('span', { className: 'dts-preview-empty' }, t('brand.empty'))
            : h('span', { className: 'dts-chip', 'data-static': 'true' },
              state.icon === ''
                ? null
                : h('span', { className: 'dts-chip-glyph' }, h(IconContent, { value: state.icon, size: 18 })),
              state.title === '' ? null : h('span', { className: 'dts-chip-title' }, state.title))),
        h('div', { className: 'dts-row' },
          h('label', { className: 'dts-label', htmlFor: 'dts-title' }, t('brand.titleLabel')),
          h('input', {
            id: 'dts-title',
            className: 'dts-input',
            type: 'text',
            maxLength: MAX_TITLE,
            placeholder: t('brand.titlePlaceholder'),
            value: state.title,
            onChange: (event) => { settings.set({ title: event.target.value.slice(0, MAX_TITLE) }) },
          })),
        h('div', { className: 'dts-row' },
          h('label', { className: 'dts-label', htmlFor: 'dts-icon' }, t('brand.iconLabel')),
          h('div', { className: 'dts-inline' },
            h('span', { className: 'dts-icon-slot', 'aria-hidden': true },
              state.icon === '' ? null : h(IconContent, { value: state.icon, size: 20 })),
            h('input', {
              id: 'dts-icon',
              className: 'dts-input',
              'data-width': 'icon',
              type: 'text',
              maxLength: MAX_ICON_TEXT,
              value: iconIsImage ? '' : state.icon,
              'aria-invalid': brandError === '' ? undefined : 'true',
              'aria-describedby': brandError === '' ? undefined : 'dts-brand-error',
              placeholder: '✦',
              onChange: (event) => {
                settings.set({ icon: event.target.value.slice(0, MAX_ICON_TEXT) })
              },
            }),
            iconIsImage ? h('span', { className: 'dts-badge' }, t('brand.iconUploaded')) : null,
            h('button', {
              type: 'button',
              className: 'dts-btn',
              disabled: busy,
              onClick: uploadIcon,
            }, t('action.upload')),
            h('button', {
              type: 'button',
              className: 'dts-btn',
              'data-variant': 'quiet',
              disabled: state.icon === '',
              onClick: () => { settings.set({ icon: '' }); clearNotice() },
            }, t('action.clear'))),
          h('p', { className: 'dts-hint' }, t('brand.iconHint', { count: String(MAX_ICON_TEXT) })),
          brandError === ''
            ? null
            : h('p', { id: 'dts-brand-error', className: 'dts-error', role: 'alert' }, brandError)))

      const heroCard = h('section', { className: 'dts-card' },
        h('div', { className: 'dts-card-head' },
          h('h2', null, t('hero.title')),
          h('p', null, t('hero.desc'))),
        h('div', { className: 'dts-row' },
          h('label', { className: 'dts-label', htmlFor: 'dts-hero-title' }, t('hero.titleLabel')),
          h('input', {
            id: 'dts-hero-title',
            className: 'dts-input',
            type: 'text',
            maxLength: MAX_TITLE,
            placeholder: t('hero.placeholder'),
            'aria-invalid': heroError === '' ? undefined : 'true',
            'aria-describedby': heroError === '' ? undefined : 'dts-hero-error',
            value: state.heroTitle,
            onChange: (event) => { settings.set({ heroTitle: event.target.value.slice(0, MAX_TITLE) }) },
          }),
          h('p', { className: 'dts-hint' }, t('hero.hint')),
          heroError === ''
            ? null
            : h('p', { id: 'dts-hero-error', className: 'dts-error', role: 'alert' }, heroError)))

      // The logo card offers the theme's own mark in a set of colours, a
      // colour input for any other one, and a way back to the shipped colour.
      const logoCard = h('section', { className: 'dts-card' },
        h('div', { className: 'dts-card-head' },
          h('h2', null, t('logo.title')),
          h('p', null, t('logo.desc'))),
        h('div', { className: 'dts-row' },
          h('span', { className: 'dts-label' }, t('logo.swatches')),
          h('div', { className: 'dts-swatches', role: 'group', 'aria-label': t('logo.swatches') },
            h('button', {
              type: 'button',
              className: 'dts-swatch',
              'data-default': 'true',
              'aria-pressed': state.brandColor === '' ? 'true' : 'false',
              'aria-label': t('logo.default'),
              title: t('logo.default'),
              onClick: () => { settings.set({ brandColor: '' }) },
            }),
            BRAND_COLOR_SWATCHES.map((colour) => h('button', {
              key: colour,
              type: 'button',
              className: 'dts-swatch',
              style: { background: colour },
              'aria-pressed': state.brandColor === colour ? 'true' : 'false',
              'aria-label': colour,
              title: colour,
              onClick: () => { settings.set({ brandColor: colour }) },
            }))),
          h('div', { className: 'dts-inline' },
            h('label', { className: 'dts-label', htmlFor: 'dts-brand-color' }, t('logo.custom')),
            h('input', {
              id: 'dts-brand-color',
              className: 'dts-color',
              type: 'color',
              value: state.brandColor === '' ? '#4d6bfe' : state.brandColor,
              onChange: (event) => { settings.set({ brandColor: event.target.value }) },
            }),
            h('span', { className: 'dts-value' }, state.brandColor === '' ? t('logo.default') : state.brandColor),
            h('button', {
              type: 'button',
              className: 'dts-btn',
              'data-variant': 'quiet',
              disabled: state.brandColor === '',
              onClick: () => { settings.set({ brandColor: '' }) },
            }, t('action.clear'))),
          h('p', { className: 'dts-hint' }, t('logo.hint'))))

      return h('section', { className: 'dts-page', 'aria-label': t('page.title') },
        h('div', { className: 'dts-scroll' },
          h('div', { className: 'dts-content' },
            h('div', { className: 'dts-heading' },
              h('div', { className: 'dts-heading-main' },
                h('h1', null, t('page.title')),
                h('p', { className: 'dts-lede' }, t('page.desc'))),
              h('div', { className: 'dts-heading-actions' },
                h('span', {
                  className: 'dts-status',
                  'data-kind': notice.kind,
                  'aria-live': notice.kind === 'error' ? 'assertive' : 'polite',
                }, statusText),
                h('button', {
                  type: 'button',
                  className: 'dts-btn',
                  'data-variant': confirmReset ? 'danger' : 'quiet',
                  onClick: reset,
                }, confirmReset ? t('action.resetConfirm') : t('action.reset')))),
            wallpaperCard,
            brandCard,
            heroCard,
            logoCard,
            h('p', { className: 'dts-note' }, t('page.note')))))
    }

    /* ------------------------------------------------------------------ *
     * Plugin
     * ------------------------------------------------------------------ */

    return {
      inject: ['slots', 'theme', 'locale', 'layout'],

      /**
       * Install the dictionaries, the wallpaper tint, the sidebar entry, the
       * header chip, and the panel.
       * @param ctx - Client root context.
       */
      apply(ctx) {
        ctx.effect(() => ctx.locale.register(NS, 'en', EN), 'theme-studio: English dictionary')
        ctx.effect(() => ctx.locale.register(NS, 'zh', ZH), 'theme-studio: Chinese dictionary')
        const t = ctx.locale.bind(NS)
        const settings = createStore(loadSettings())
        const status = createSignal({ kind: 'idle', message: '', field: '' })
        let styleElement = null
        let disposeTokens = null

        // The plugin's own stylesheet: the panel, the header chip, and the hero
        // replacement are class-scoped here, so one element carries them all.
        ctx.effect(() => {
          const sheet = document.createElement('style')
          sheet.setAttribute('data-plugin', 'dsh-theme-studio')
          sheet.setAttribute('data-dsh-theme-studio', 'styles')
          sheet.textContent = STYLES
          document.head.append(sheet)
          return () => { sheet.remove() }
        }, 'theme-studio: stylesheet')

        let lastWallpaper = null
        let lastVisibility = null

        // The sidebar mark's colour rides a custom property the plugin's own
        // stylesheet reads. Setting the property on the document root tints
        // the mark wherever it is drawn, in the expanded row and in the
        // collapsed rail alike, without touching any other element.
        //
        // The wordmark beside the mark takes the same colour, and the letters
        // cut out of the HARNESS badge take a second property, so they keep
        // their contrast against the badge instead of the theme's.
        ctx.effect(() => {
          const apply = () => {
            const colour = settings.get().brandColor
            const root = document.documentElement
            const ink = badgeLetterColor(colour)
            if (colour === '') {
              root.style.removeProperty('--dts-brand-color')
              root.style.removeProperty('--dts-badge-ink')
            } else {
              root.style.setProperty('--dts-brand-color', colour)
              if (ink === null) root.style.removeProperty('--dts-badge-ink')
              else root.style.setProperty('--dts-badge-ink', ink)
            }
          }
          apply()
          const stop = settings.subscribe(apply)
          return () => {
            stop()
            document.documentElement.style.removeProperty('--dts-brand-color')
            document.documentElement.style.removeProperty('--dts-badge-ink')
          }
        }, 'theme-studio: sidebar mark colour')

        /** Paint the wallpaper and tint every base surface from the current settings. */
        const applyLook = () => {
          if (styleElement === null) return
          const state = settings.get()
          // Typing a title must not repaint the document or restack token layers.
          if (state.wallpaper === lastWallpaper && state.visibility === lastVisibility) return
          lastWallpaper = state.wallpaper
          lastVisibility = state.visibility
          if (disposeTokens !== null) {
            disposeTokens()
            disposeTokens = null
          }
          if (state.wallpaper === '') {
            styleElement.textContent = ''
            return
          }
          styleElement.textContent = wallpaperRule(state.wallpaper)
          // The slider states the share of the picture that shows through, so the
          // paint stays at 100 - that share: 10% is a whisper, 45% is the maximum
          // before text contrast suffers.
          const percent = Math.max(50, Math.round(100 - state.visibility))
          disposeTokens = ctx.theme.overrideTokens('dsh-theme-studio', {
            // The centre column, page backgrounds, and dialogs paint this one.
            '--dsw-alias-bg-base': {
              light: `color-mix(in srgb, var(--dsw-static-neutral-bluish-00, #ffffff) ${percent}%, transparent)`,
              dark: `color-mix(in srgb, var(--dsw-static-neutral-bluish-950, #151517) ${percent}%, transparent)`,
            },
            // The macOS sidebar is a glass tint over the window, and platforms
            // without vibrancy fill the column from the fill token; both get the
            // same share so the wallpaper never overpowers one column.
            '--dsw-specific-sidebar-tint': {
              light: `color-mix(in srgb, var(--dsw-static-neutral-bluish-50, #f7f8fa) ${percent}%, transparent)`,
              dark: `color-mix(in srgb, var(--dsw-static-neutral-bluish-900, #1c1c1f) ${percent}%, transparent)`,
            },
            '--dsw-specific-sidebar-fill': {
              light: `color-mix(in srgb, var(--dsw-static-neutral-bluish-50, #f7f8fa) ${percent}%, transparent)`,
              dark: `color-mix(in srgb, var(--dsw-static-neutral-bluish-900, #1c1c1f) ${percent}%, transparent)`,
            },
          })
        }

        ctx.effect(() => {
          const element = document.createElement('style')
          element.setAttribute('data-plugin', 'dsh-theme-studio')
          element.setAttribute('data-dsh-theme-studio', 'wallpaper')
          document.head.append(element)
          styleElement = element
          let saveTimer = null
          let noticeTimer = null

          let lastSavedWallpaper = settings.get().wallpaper

          const save = () => {
            try {
              const state = settings.get()
              window.localStorage.setItem(STORAGE_KEY, JSON.stringify({
                title: state.title,
                icon: state.icon,
                heroTitle: state.heroTitle,
                brandColor: state.brandColor,
                visibility: state.visibility,
              }))
              if (state.wallpaper === '') {
                if (lastSavedWallpaper !== '') window.localStorage.removeItem(STORAGE_WALLPAPER_KEY)
              } else if (state.wallpaper !== lastSavedWallpaper) {
                window.localStorage.setItem(STORAGE_WALLPAPER_KEY, state.wallpaper)
              }
              lastSavedWallpaper = state.wallpaper
              status.set({ kind: 'saved', message: '', field: '' })
              if (noticeTimer !== null) clearTimeout(noticeTimer)
              noticeTimer = setTimeout(() => {
                noticeTimer = null
                status.set({ kind: 'idle', message: '', field: '' })
              }, 2000)
            } catch {
              status.set({ kind: 'error', message: 'error.storage', field: 'save' })
            }
          }

          const scheduleSave = () => {
            if (saveTimer !== null) clearTimeout(saveTimer)
            saveTimer = setTimeout(() => {
              saveTimer = null
              save()
            }, 220)
          }

          const stop = settings.subscribe(() => {
            applyLook()
            scheduleSave()
          })
          applyLook()
          return () => {
            stop()
            if (saveTimer !== null) clearTimeout(saveTimer)
            if (noticeTimer !== null) clearTimeout(noticeTimer)
            if (disposeTokens !== null) {
              disposeTokens()
              disposeTokens = null
            }
            styleElement = null
            element.remove()
          }
        }, 'theme-studio: wallpaper, surface tint, and storage')

        ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
          name: 'sidebar.panellist',
          id: PANEL_ID,
          order: SIDEBAR_ORDER,
          locale: NS,
          label: () => t('nav.label'),
        }, PaletteGlyph))

        ctx.slots.inject('main', () => ctx.slots.register({
          name: 'main',
          key: PANEL_ID,
          locale: NS,
          inject: () => ({ settings, status }),
        }, ThemeStudioPage))

        ctx.slots.inject('conversation.header.leading', () => ctx.slots.register({
          name: 'conversation.header.leading',
          locale: NS,
          inject: () => ({ settings, openPanel: () => { ctx.layout.selectPanel(PANEL_ID) } }),
        }, HeaderChip))

        // The hero's mark is a single-slot fallback (the shipped fish): occupying
        // it replaces the fallback, so the entry exists only while a custom home
        // headline needs it and the shipped home stays untouched without one.
        ctx.slots.inject('conversation.hero.brand.mark', () => {
          let disposeHero = null
          const syncHero = () => {
            const wanted = settings.get().heroTitle.trim() !== ''
            if (wanted && disposeHero === null) {
              try {
                disposeHero = ctx.slots.register({
                  name: 'conversation.hero.brand.mark',
                  inject: () => ({ settings }),
                }, HeroBrand)
              } catch {
                // Another occupant holds this single seat: keep the shipped home
                // rather than failing the edit that reached here.
                disposeHero = null
                status.set({ kind: 'error', message: 'error.heroSeat', field: 'hero' })
              }
            } else if (!wanted && disposeHero !== null) {
              disposeHero()
              disposeHero = null
            }
          }
          const stop = settings.subscribe(syncHero)
          syncHero()
          return () => {
            stop()
            if (disposeHero !== null) {
              disposeHero()
              disposeHero = null
            }
          }
        })
      },
    }
  },
})
