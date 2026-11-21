#!/usr/bin/env node
/**
 * Build the plugin market index for the Theme studio bundle.
 *
 * The index is a format-1 plugin market document: one JSON file listing the
 * bundle and the exact commit it can be installed from. This script reads the
 * repository's own state (commit, version, description) so the index never
 * drifts from the code it points at, and validates its output with the
 * installed validator before writing it.
 *
 * The bundle lives in a subdirectory of a repository that may hold several
 * plugins, so the index names the bundle's directory in the version's `path`.
 * The index itself is written at the repository root, where the raw file host
 * serves it.
 *
 * Usage:
 *   node build-market-index.mjs [--repo <owner/name>] [--out <path>]
 *
 * The repository slug is the one the bundle is published under; the index
 * points at the raw file of the same repository.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)

const bundleDir = dirname(fileURLToPath(import.meta.url))

/** Parse the command line into a plain options record. */
function parseArgs(argv) {
  const options = { repo: 'Thomas1yang/DSH-plugin', out: null }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    if (flag === '--repo') options.repo = argv[index + 1]
    else if (flag === '--out') options.out = argv[index + 1]
  }
  return options
}

const options = parseArgs(process.argv.slice(2))

/**
 * Run one git command and return its trimmed output.
 * @param args - the git arguments.
 * @returns the command's standard output.
 */
function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', cwd: bundleDir }).trim()
}

/**
 * The repository root: the directory holding the `.git` directory.
 * @returns the absolute path of the repository root.
 */
function repositoryRoot() {
  return git('rev-parse', '--show-toplevel')
}

/**
 * The bundle's directory inside the repository, as a POSIX relative path.
 * The index's `path` names it, and it is empty when the bundle is the
 * repository root itself.
 * @returns the POSIX relative path, or an empty string.
 */
function bundlePath() {
  const root = repositoryRoot()
  if (root === bundleDir) return ''
  return relative(root, bundleDir).split(sep).join('/')
}

const manifest = JSON.parse(readFileSync(join(bundleDir, 'package.json'), 'utf8'))
const localeZh = JSON.parse(readFileSync(join(bundleDir, 'locale/zh.json'), 'utf8'))
const localeEn = JSON.parse(readFileSync(join(bundleDir, 'locale/en.json'), 'utf8'))

const commit = git('rev-parse', 'HEAD')
const commitDate = git('show', '-s', '--format=%cI', 'HEAD')
const publishTimestamp = Math.floor(Date.parse(commitDate) / 1000)
const repositoryUrl = `https://github.com/${options.repo}`
const indexPath = options.out ?? join(repositoryRoot(), 'market-index.json')
const indexUrl = `https://raw.githubusercontent.com/${options.repo}/main/${relative(repositoryRoot(), indexPath).split(sep).join('/')}`

/**
 * The icon travels inside the index as a data URL, so the Discover page shows
 * it without a second request. The validator caps the decoded payload at
 * 32 KiB; this icon is well under it.
 * @returns the data URL of the bundle icon.
 */
function iconDataUrl() {
  const svg = readFileSync(join(bundleDir, 'icon.svg'))
  return `data:image/svg+xml;base64,${svg.toString('base64')}`
}

const path = bundlePath()

const index = {
  format: 1,
  title: {
    en: 'DSH plugin index',
    zh: 'DSH 插件索引',
  },
  description: {
    en: 'Plugins for the DeepSeek Harness, published from the DSH-plugin repository.',
    zh: '为 DeepSeek Harness 提供的插件，发布自 DSH-plugin 仓库。',
  },
  metadata: {
    categories: {
      appearance: {
        title: { en: 'Appearance', zh: '外观' },
      },
      utilities: {
        title: { en: 'Utilities', zh: '实用工具' },
      },
    },
    labels: {
      ui: {
        title: { en: 'Interface', zh: '界面' },
      },
    },
    sortKeys: {
      popularity: {
        title: { en: 'Popularity', zh: '热度' },
        order: 'desc',
      },
    },
  },
  plugins: [
    {
      name: manifest.name,
      title: {
        en: localeEn.meta.title,
        zh: localeZh.meta.title,
      },
      description: {
        en: localeEn.meta.description,
        zh: localeZh.meta.description,
      },
      icon: iconDataUrl(),
      author: 'Thomas1yang',
      homepage: repositoryUrl,
      repository: {
        url: repositoryUrl,
        ...path === '' ? {} : { directory: path },
      },
      metadata: {
        category: 'appearance',
        keywords: manifest.keywords ?? [],
        labels: ['ui'],
        sortKeys: { popularity: 1 },
      },
      versions: [
        {
          version: manifest.version,
          publishTimestamp,
          source: {
            type: 'git',
            url: `${repositoryUrl}.git`,
            commit,
            ...path === '' ? {} : { path },
          },
          engines: {},
        },
      ],
    },
  ],
}

// Validate against the installed validator before writing, so a malformed
// index never reaches a reader.
//
// The validator ships inside the DSH installation, which is an asar archive
// that a plain Node runtime cannot read. The Electron runtime can, so the
// script re-executes itself under it when the plain resolution fails.
function loadValidator() {
  const anchor = '/Applications/DeepSeek Harness.app/Contents/Resources/app.asar/dsh/node_modules'
  try {
    return createRequire(import.meta.url)('@deepseek-ai/dsh-plugin-market-index')
  } catch {
    // Fall through to the Electron runtime below.
  }
  try {
    const executable = process.env.DSH_NODE_EXECUTABLE
    if (executable === undefined) throw new Error('DSH_NODE_EXECUTABLE is not set')
    const output = execFileSync(executable, ['-e', `
      const path = require.resolve('@deepseek-ai/dsh-plugin-market-index', { paths: [${JSON.stringify(anchor)}] });
      const { parseMarketIndex } = require(path);
      const fs = require('node:fs');
      const input = fs.readFileSync(0, 'utf8');
      try {
        const parsed = parseMarketIndex(JSON.parse(input), ${JSON.stringify(indexUrl)});
        process.stdout.write('OK ' + parsed.plugins.length + ' plugin(s), '
          + parsed.plugins[0].versions.length + ' version(s)');
      } catch (error) {
        process.stderr.write(error.message);
        process.exit(1);
      }
    `], {
      encoding: 'utf8',
      env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' },
      input: JSON.stringify(index),
    })
    return { parseMarketIndex: () => ({ plugins: [{ versions: [] }], summary: output }) }
  } catch (error) {
    console.error(`could not run the market index validator: ${error.message}`)
    process.exit(1)
  }
}

const validator = loadValidator()
try {
  const parsed = validator.parseMarketIndex(index, indexUrl)
  const summary = parsed.summary ?? `${parsed.plugins.length} plugin(s), ${parsed.plugins[0].versions.length} version(s)`
  console.log(`validated: ${summary}`)
} catch (error) {
  console.error(`index is invalid: ${error.message}`)
  process.exit(1)
}

writeFileSync(indexPath, `${JSON.stringify(index, null, 2)}\n`)
console.log(`wrote ${indexPath}`)
console.log(`  repository: ${repositoryUrl}`)
console.log(`  path:       ${path === '' ? '(repository root)' : path}`)
console.log(`  commit:     ${commit}`)
console.log(`  index url:  ${indexUrl}`)
