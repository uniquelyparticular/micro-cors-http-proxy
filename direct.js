const { filterByPrefix, mustachReplace } = require('./src/utils')

process.on('unhandledRejection', (reason, p) => {
  console.error(
    'Promise unhandledRejection: ',
    p,
    ', reason:',
    JSON.stringify(reason)
  )
})

process.env.PROXY_REPLACE_FOO = 'very-secret-23234-324234-234'

class Direct {
  static async run() {
    const secureHeader = 'asdas {{settings.foo}} sadsad'
    console.log('secureHeader', secureHeader)
    const replacements = filterByPrefix(process.env, 'PROXY_REPLACE_')
    console.log('replacements', replacements)
    const header = mustachReplace(secureHeader, replacements, 'setting')
    console.log('header', header)
  }
}

module.exports = Direct

if (require.main === module) {
  Direct.run()
}
