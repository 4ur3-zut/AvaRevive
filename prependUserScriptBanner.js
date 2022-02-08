const fs = require('fs')
const { userScriptName, version, description, descriptionFr } = require('./package.json')

const banner = `\
// ==UserScript==
// @name              ${userScriptName}
// @name:fr           ${userScriptName}
// @version           ${version}
// @description       ${description}
// @description:fr    ${descriptionFr}
// @copyright         Aure ${new Date().getFullYear()}
// @license           ISC
// @namespace         gagagougouimaginecoderenES6
// @match             https://twinoid.com/*
// ==/UserScript==
`

const data = fs.readFileSync('avaRevive.min.js').toString('utf8')
const withBanner = `${banner}${data}`
fs.writeFileSync('avaRevive.min.js', withBanner, 'utf8')
