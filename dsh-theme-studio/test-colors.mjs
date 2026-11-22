#!/usr/bin/env node
/**
 * Standalone test of the colour helpers in client.js.
 *
 * The functions are extracted from client.js at run time, so the test
 * exercises the same code the browser runs rather than a copy that can drift.
 */

import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('./client.js', import.meta.url), 'utf8')

/**
 * Pull one named function out of the plugin source.
 *
 * The scan skips string literals, template literals and comments, so a brace
 * inside a message does not end the function early.
 * @param name - the function name.
 * @returns the function declaration source.
 */
function extractSource(name) {
  const start = source.indexOf(`function ${name}(`)
  if (start === -1) throw new Error(`function ${name} not found`)
  const bodyStart = source.indexOf('{', start)
  let depth = 0
  let index = bodyStart
  let quote = null
  while (index < source.length) {
    const char = source[index]
    if (char === '/' && source[index + 1] === '/') {
      const newline = source.indexOf('\n', index)
      index = newline === -1 ? source.length : newline
      continue
    }
    if (char === '/' && source[index + 1] === '*') {
      const end = source.indexOf('*/', index)
      index = end === -1 ? source.length : end + 2
      continue
    }
    if (quote !== null) {
      if (char === '\\') {
        index += 2
        continue
      }
      if (char === quote) quote = null
      index += 1
      continue
    }
    if (char === '"' || char === "'" || char === '`') {
      quote = char
      index += 1
      continue
    }
    if (char === '{') depth += 1
    else if (char === '}') {
      depth -= 1
      if (depth === 0) return source.slice(start, index + 1)
    }
    index += 1
  }
  throw new Error(`function ${name} is not closed`)
}

// The colour pattern is a module-level constant; pull it the same way.
const patternMatch = source.match(/const HEX_COLOR = (\/.*\/[a-z]*)/)
if (patternMatch === null) throw new Error('HEX_COLOR not found')
const HEX_COLOR = new Function(`return ${patternMatch[1]}`)()

// The helpers call each other and close over HEX_COLOR and over the gradient
// presets, so they are created together inside one scope that holds those
// names under the names the extracted source uses.
const scope = {
  HEX_COLOR: null,
  isHexColor: null,
  luminanceOf: null,
  isGradientStops: null,
  BRAND_GRADIENTS: null,
  BRAND_GRADIENT_ID: null,
  BRAND_WORDMARK_GRADIENT_ID: null,
  GRADIENT_X1: null,
  GRADIENT_MARK_X2: null,
  GRADIENT_WORDMARK_X2: null,
}

/**
 * Build one helper inside a scope that holds the module's own names.
 *
 * The names are passed in as parameters, so the extracted source can close
 * over them without any of them being redeclared.
 * @param name - the function name.
 * @param extra - extra scope entries the function needs.
 * @returns the function.
 */
function makeHelper(name, extra = {}) {
  const all = { ...scope, ...extra }
  const keys = Object.keys(all)
  const values = keys.map((key) => all[key])
  return new Function(...keys, `return (${extractSource(name)})`)(...values)
}

// The gradient presets and the gradient's own constants are module-level
// values; pull them the same way.
const presetMatch = source.match(/const BRAND_GRADIENTS = (\[[\s\S]*?\n    \])/)
if (presetMatch === null) throw new Error('BRAND_GRADIENTS not found')
const gradientIdMatch = source.match(/const BRAND_GRADIENT_ID = '([^']+)'/)
const wordmarkIdMatch = source.match(/const BRAND_WORDMARK_GRADIENT_ID = '([^']+)'/)
const markX2Match = source.match(/const GRADIENT_MARK_X2 = ([\d.]+)/)
const wordmarkX2Match = source.match(/const GRADIENT_WORDMARK_X2 = ([\d.]+)/)
const x1Match = source.match(/const GRADIENT_X1 = ([\d.]+)/)

scope.HEX_COLOR = HEX_COLOR
scope.BRAND_GRADIENTS = new Function(`return ${presetMatch[1]}`)()
scope.BRAND_GRADIENT_ID = gradientIdMatch[1]
scope.BRAND_WORDMARK_GRADIENT_ID = wordmarkIdMatch[1]
scope.GRADIENT_X1 = Number(x1Match[1])
scope.GRADIENT_MARK_X2 = Number(markX2Match[1])
scope.GRADIENT_WORDMARK_X2 = Number(wordmarkX2Match[1])

scope.isHexColor = makeHelper('isHexColor')
scope.luminanceOf = makeHelper('luminanceOf')
scope.isGradientStops = makeHelper('isGradientStops')

const isHexColor = scope.isHexColor
const luminanceOf = scope.luminanceOf
const isGradientStops = scope.isGradientStops
const badgeLetterColor = makeHelper('badgeLetterColor')
const badgeLetterColorForGradient = makeHelper('badgeLetterColorForGradient')
const gradientById = makeHelper('gradientById')
const gradientMarkup = makeHelper('gradientMarkup')
const BRAND_GRADIENTS = scope.BRAND_GRADIENTS


let failures = 0
function check(name, actual, expected) {
  const pass = JSON.stringify(actual) === JSON.stringify(expected)
  if (!pass) {
    failures += 1
    console.log(`FAIL ${name}\n  actual:   ${JSON.stringify(actual)}\n  expected: ${JSON.stringify(expected)}`)
  } else {
    console.log(`ok   ${name}`)
  }
}

// --- isHexColor --------------------------------------------------------

check('hex: six digits', isHexColor('#4d6bfe'), true)
check('hex: three digits', isHexColor('#abc'), true)
check('hex: eight digits with alpha', isHexColor('#4d6bfe80'), true)
check('hex: four digits with alpha', isHexColor('#abcd'), true)
check('hex: uppercase', isHexColor('#4D6BFE'), true)
check('hex: missing hash', isHexColor('4d6bfe'), false)
check('hex: five digits', isHexColor('#4d6bf'), false)
check('hex: seven digits', isHexColor('#4d6bfe0'), false)
check('hex: not a string', isHexColor(123), false)
check('hex: null', isHexColor(null), false)
check('hex: a css keyword', isHexColor('red'), false)
check('hex: a variable reference', isHexColor('var(--x)'), false)
check('hex: empty', isHexColor(''), false)

// --- luminanceOf -------------------------------------------------------

check('luminance: white', Math.round(luminanceOf('#ffffff') * 1000) / 1000, 1)
check('luminance: black', luminanceOf('#000000'), 0)
check('luminance: mid grey', Math.round(luminanceOf('#808080') * 1000) / 1000, 0.216)
check('luminance: three digits expand', luminanceOf('#fff'), 1)
check('luminance: alpha spelling is read as its own colour', luminanceOf('#ffffffff'), 1)
check('luminance: rejects a keyword', luminanceOf('red'), null)
check('luminance: rejects null', luminanceOf(null), null)

// --- badgeLetterColor --------------------------------------------------

check('badge ink: dark colour gets white letters', badgeLetterColor('#7c3aed'), '#ffffff')
check('badge ink: deep blue gets white letters', badgeLetterColor('#0d9488'), '#ffffff')
check('badge ink: near-black gets white letters', badgeLetterColor('#0f1115'), '#ffffff')
check('badge ink: pale yellow gets dark letters', badgeLetterColor('#fde047'), '#15181d')
check('badge ink: white gets dark letters', badgeLetterColor('#ffffff'), '#15181d')
check('badge ink: light grey gets dark letters', badgeLetterColor('#e5e7eb'), '#15181d')
check('badge ink: rejects a keyword', badgeLetterColor('red'), null)
check('badge ink: rejects an empty value', badgeLetterColor(''), null)

// The ink must always contrast with the pill: a dark pill takes light
// letters and a light pill takes dark ones.
for (const colour of ['#4d6bfe', '#0f6bff', '#7c3aed', '#0d9488', '#d97706', '#dc2626', '#db2777', '#64748b', '#ffffff', '#000000']) {
  const luminance = luminanceOf(colour)
  const ink = badgeLetterColor(colour)
  const expected = luminance > 0.45 ? '#15181d' : '#ffffff'
  if (ink !== expected) {
    failures += 1
    console.log(`FAIL badge ink for ${colour}: got ${ink}, expected ${expected}`)
  } else {
    console.log(`ok   badge ink for ${colour} is ${ink}`)
  }
}

// --- isGradientStops ---------------------------------------------------

check('stops: two colours', isGradientStops(['#ff6ec7', '#3b82f6']), true)
check('stops: three colours', isGradientStops(['#ff6ec7', '#a855f7', '#3b82f6']), true)
check('stops: one colour is too few', isGradientStops(['#ff6ec7']), false)
check('stops: an empty list', isGradientStops([]), false)
check('stops: not an array', isGradientStops('#ff6ec7'), false)
check('stops: a null value', isGradientStops(null), false)
check('stops: one bad colour among good ones', isGradientStops(['#ff6ec7', 'red']), false)
check('stops: a colour with alpha is accepted', isGradientStops(['#ff6ec780', '#3b82f6']), true)

// --- gradientById ------------------------------------------------------

check('preset: pink-blue exists', gradientById('pink-blue') !== undefined, true)
check('preset: pink-blue stops', gradientById('pink-blue').stops, ['#ff6ec7', '#a855f7', '#3b82f6'])
check('preset: every preset has at least two valid stops', BRAND_GRADIENTS.every((g) => isGradientStops(g.stops)), true)
check('preset: every preset has a unique id', new Set(BRAND_GRADIENTS.map((g) => g.id)).size, BRAND_GRADIENTS.length)
check('preset: an unknown id', gradientById('nope'), undefined)

// --- badgeLetterColorForGradient --------------------------------------

check('gradient ink: a dark gradient gets white letters', badgeLetterColorForGradient(['#7c3aed', '#3b82f6']), '#ffffff')
check('gradient ink: a light gradient gets dark letters', badgeLetterColorForGradient(['#fde047', '#fef08a']), '#15181d')
check('gradient ink: the pink-blue preset gets white letters', badgeLetterColorForGradient(gradientById('pink-blue').stops), '#ffffff')
check('gradient ink: rejects a bad list', badgeLetterColorForGradient(['#fff']), null)
check('gradient ink: rejects a non-array', badgeLetterColorForGradient('red'), null)

// --- gradientMarkup ----------------------------------------------------

const markup = gradientMarkup(['#ff6ec7', '#a855f7', '#3b82f6'])
check('markup: two gradients are produced', (markup.match(/<linearGradient /g) || []).length, 2)
check('markup: the mark gradient has its own span', markup.includes(`x2="${Number(markX2Match[1])}"`), true)
check('markup: the wordmark gradient has its own span', markup.includes(`x2="${Number(wordmarkX2Match[1])}"`), true)
check('markup: the units are the user space', (markup.match(/gradientUnits="userSpaceOnUse"/g) || []).length, 2)
check('markup: every stop carries its colour', markup.includes('stop-color="#ff6ec7"') && markup.includes('stop-color="#3b82f6"'), true)
check('markup: the stops are spread evenly', markup.includes('offset="0.00%"') && markup.includes('offset="50.00%"') && markup.includes('offset="100.00%"'), true)
check('markup: the ids match the ones the stylesheet asks for', markup.includes(`id="${gradientIdMatch[1]}"`) && markup.includes(`id="${wordmarkIdMatch[1]}"`), true)
check('markup: two stops get the ends', gradientMarkup(['#000000', '#ffffff']).includes('offset="0.00%"')
  && gradientMarkup(['#000000', '#ffffff']).includes('offset="100.00%"'), true)
check('markup: two stops have no middle', gradientMarkup(['#000000', '#ffffff']).includes('offset="50.00%"'), false)

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)