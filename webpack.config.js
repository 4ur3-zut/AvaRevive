const path = require('path')
const ESLintPlugin = require('eslint-webpack-plugin')

const config = {
  mode: 'production',
  entry: './avaRevive.mjs',
  output: {
    path: path.resolve(__dirname),
    filename: 'avaRevive.min.js'
  },
  plugins: [
    new ESLintPlugin({ fix: true })
  ]
}

module.exports = config
