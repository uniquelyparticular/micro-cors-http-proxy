module.exports = {
  filterByPrefix(input, ...matchPrefixes) {
    return Object.keys(input)
      .filter(key => {
        // return only objects within input who's keys start with any envPrefix
        let matched = false
        matchPrefixes.forEach(prefix => {
          matched = matched || key.startsWith(prefix)
        })
        return matched
      })
      .reduce((obj, rawKey) => {
        // remove any envPrefix that object startswith
        let key = rawKey
        matchPrefixes.forEach(prefix => {
          key = key.startsWith(prefix) ? key.replace(prefix, '') : key
        })
        obj[key] = input[rawKey]
        return obj
      }, {})
  },

  mustachReplace(input, replacements, ...mustachPrefixes) {
    // will search for input containing {{mustachePrefix.XYZ}}
    return input.replace(/{{((.*?)\.(.*?))}}/g, (match, ...groups) => {
      if (mustachPrefixes.includes(groups[1])) {
        return groups[2] !== 'undefined'
          ? replacements[groups[2].toUpperCase()] || match
          : match
      } else {
        return match
      }
    })
  }
}
