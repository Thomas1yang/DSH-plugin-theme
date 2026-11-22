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

// The helpers call each other and close over HEX_COLOR, so they are created
// together inside one scope that holds those names. The pattern is passed
// under a different name so it does not collide with the declaration.
const isHexColor = new Function(
  'hexPattern',
  `const HEX_COLOR = hexPattern; return (${extractSource('isHexColor')})`,
)(HEX_COLOR)
const luminanceOf = new Function(
  'hexPattern',
  'isHexColorHelper',
  `const HEX_COLOR = hexPattern; const isHexColor = isHexColorHelper; return (${extractSource('luminanceOf')})`,
)(HEX_COLOR, isHexColor)
const badgeLetterColor = new Function(
  'hexPattern',
  'isHexColorHelper',
  'luminanceHelper',
  `const HEX_COLOR = hexPattern; const isHexColor = isHexColorHelper; const luminanceOf = luminanceHelper; return (${extractSource('badgeLetterColor')})`,
)(HEX_COLOR, isHexColor, luminanceOf)

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

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURES`)
process.exit(failures === 0 ? 0 : 1)
