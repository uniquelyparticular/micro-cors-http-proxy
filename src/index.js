const { name, version } = require('../package.json')
const { text, json, send } = require('micro')
const { router, del, get, options, patch, post, put } = require('microrouter')
const { URL } = require('whatwg-url')
const UrlPattern = require('url-pattern')
const cors = require('micro-cors')()
const fetch = require('node-fetch')
const { filterByPrefix, mustachReplace } = require('./utils/tokenization')

const _toJSON = error => {
  return !error
    ? ''
    : Object.getOwnPropertyNames(error).reduce(
        (jsonError, key) => {
          return { ...jsonError, [key]: error[key] }
        },
        { type: 'error' }
      )
}

process.on('unhandledRejection', (reason, p) => {
  console.error(
    'Promise unhandledRejection: ',
    p,
    ', reason:',
    JSON.stringify(reason)
  )
})

const noProxy = async (req, res) =>
  send(res, 404, { error: 'Route is missing proxy' })
const noReferer = async (req, res) =>
  send(res, 401, { error: 'Referer is missing' })
const notAuthorized = async (req, res) =>
  send(res, 401, {
    error: 'Referer or Destination not whitelisted or insecure'
  })
const notSupported = async (req, res) =>
  send(res, 405, { error: 'Method not supported yet' })

const prepareRegex = string => {
  return string
    .replace(/[-[\]{}()*+!<=:?.\/\\^$|#\s,]/g, '\\$&')
    .replace('\\*', '.+')
}

const isWhitelisted = (host, hostMap) => {
  return hostMap.some(entry => entry.test(host))
}

const parseURL = url => {
  const { hostname, protocol } = new URL(url)
  return { hostname, protocol }
}

const isAuthorized = (referer, whitelist = []) => {
  if (referer) {
    const { hostname } = parseURL(referer)
    return isWhitelisted(hostname, whitelist)
  } else {
    return false
  }
}

const toRegexArray = csv => {
  return (csv || '')
    .replace(/,\ /g, ',')
    .split(',')
    .map(value => new RegExp(`^${prepareRegex(value)}$`))
}

const originWhiteList = toRegexArray(process.env.PROXY_ORIGIN_WHITELIST)
const destinationWhiteList = toRegexArray(
  process.env.PROXY_DESTINATION_WHITELIST
)
const proxyPrefix = process.env.PROXY_PREFIX || 'proxy'
const proxyReplacePrefix = process.env.PROXY_REPLACE || 'PROXY_REPLACE_'
const proxyReplaceMatchPrefix = process.env.PROXY_REPLACE_MATCH || 'setting'
// console.log('process.env.PROXY_PREFIX', proxyPrefix)
// console.log('process.env.PROXY_REPLACE', proxyReplacePrefix)
// console.log('process.env.PROXY_REPLACE_MATCH', proxyReplaceMatchPrefix)
const envReplacements = filterByPrefix(process.env, proxyReplacePrefix)
// console.log('envReplacements', envReplacements)

const filterValue = input => {
  return mustachReplace(input, envReplacements, proxyReplaceMatchPrefix)
}

const getOrigin = (origin, referer) => {
  // console.log('getOrigin, origin', origin)
  // console.log('getOrigin, referer', referer)
  const subOrigin = referer ? referer.match(/\?origin=([^\?&]+)/) : null
  if (subOrigin) {
    origin = decodeURIComponent(subOrigin[1])
  }
  return origin || referer
}

const requestHeaders = headers => {
  const {
    host,
    referer,
    origin,
    'x-requested-with': requestedWith,
    ...filterableHeaderss
  } = headers

  const filteredHeaders = Object.keys(filterableHeaderss).reduce((obj, key) => {
    obj[key] = filterValue(filterableHeaderss[key])
    return obj
  }, {})

  const defaultHeaders = {
    origin: getOrigin(origin, referer),
    'x-forwarded-by': `${name}-${version}`,
    'x-forwarded-origin': origin,
    'x-forwarded-referer': referer
  }

  const modifiedHeaders = { ...filteredHeaders, ...defaultHeaders }
  // console.log('requestHeaders, modifiedHeaders', modifiedHeaders)
  return modifiedHeaders
}

const allowHeaders = headers => {
  // console.log('allowHeaders, headers', headers)
  const {
    'access-control-request-headers': requestedHeaders,
    ...filteredHeaders
  } = headers

  // console.log('allowHeaders, requestedHeaders', requestedHeaders)
  // console.log('allowHeaders, filteredHeaders', filteredHeaders)

  const defaultAllowedHeaders = [
    'accept',
    'access-control-allow-origin',
    'authorization',
    'content-type',
    'x-requested-with',
    'x-http-method-override'
  ]
  const allowedHeaders = [
    requestedHeaders,
    ...Object.keys(filteredHeaders),
    ...defaultAllowedHeaders
  ].join(',')
  // console.log('allowHeaders, allowedHeaders', allowedHeaders)
  return allowedHeaders
}

const handleResponse = response => {
  return response
    .text()
    .then(text => {
      // console.log('processRequest, text', text)
      return text
    })
    .then((response = {}) => {
      const jsonResponse = JSON.parse(response)
      // console.log('processRequest, jsonResponse', jsonResponse)
      return jsonResponse
    })
}

const processRequest = (res, origin, url, options) => {
  // console.log('url', url)
  // console.log('options', options)
  return fetch(url, options)
    .then(response => {
      // console.log('processRequest, response', response)
      if (response.status > 299) {
        // console.log('processRequest, response.statusText', response.statusText)
        const errorResponse = {
          status: response.status,
          statusText: response.statusText,
          ...response,
          request: {
            url,
            options: JSON.stringify(options)
          }
        }
        return send(res, response.status || 500, errorResponse)
      } else {
        return handleResponse(response)
          .then(data => {
            // console.log('processRequest, data', data)
            if (origin) {
              // console.log('processRequest, origin', origin)
              res.setHeader('access-control-allow-origin', origin)
            }
            return send(res, 200, data)
          })
          .catch(error => {
            const jsonError = _toJSON(error)
            return send(res, error.statusCode || 500, jsonError)
          })
      }
    })
    .catch(error => {
      const jsonError = _toJSON(error)
      return send(res, error.statusCode || 500, jsonError)
    })
}

const handleOptions = async (req, res) => {
  // console.log('handleOptions, req.headers', req.headers)
  // console.log('handleOptions, allowHeaders', allowHeaders(req.headers))
  res.setHeader('access-control-allow-headers', allowHeaders(req.headers))
  return send(res, 204)
}

const handleProxy = async (req, res) => {
  // console.log('called proxy')
  // console.log('req.method', req.method)
  if (req.method === 'OPTIONS') {
    return handleOptions(req, res)
  }

  try {
    const path = req.url
    // console.log('path', path)
    // console.log('req.rawHeaders',req.rawHeaders)
    // console.log('req.headers.referer', req.headers.referer)
    // console.log('req.headers.origin', req.headers.origin)
    // console.log('req.headers',req.headers)
    if (!req.headers.referer) {
      return noReferer(req, res)
    }

    if (
      !isAuthorized(
        getOrigin(req.headers.origin, req.headers.referer),
        originWhiteList
      )
    ) {
      return notAuthorized(req, res)
    }

    // console.log('proxyPrefix', proxyPrefix)
    const destinationURL = decodeURIComponent(
      decodeURIComponent(path.replace(`/${proxyPrefix}/`, ''))
    )

    if (!isAuthorized(destinationURL, destinationWhiteList)) {
      return notAuthorized(req, res)
    }

    let fetchOptions = {
      method: req.method,
      headers: requestHeaders(req.headers)
    }

    if (req.method !== 'GET') {
      const body =
        req.headers['content-type'] === 'application/json'
          ? JSON.stringify((await json(req)) || {})
          : await text(req)
      // console.log('txt', txt)

      if (body) {
        fetchOptions.body = body
      }
      // console.log('fetchOptions.body', fetchOptions.body)
    }
    // console.log('fetchOptions', fetchOptions)
    return processRequest(res, req.headers.origin, destinationURL, fetchOptions)
  } catch (error) {
    const jsonError = _toJSON(error)
    return send(res, error.statusCode || 500, jsonError)
  }
}

const positivePattern = new RegExp(`^\/${proxyPrefix}\/.+$`)
const negativePattern = new RegExp(`/^(?!\/${proxyPrefix}\/)\/.+$/`)

module.exports = cors(
  router(
    options('/*', handleOptions),
    del(new UrlPattern(positivePattern), handleProxy),
    del(new UrlPattern(negativePattern), noProxy),
    get(new UrlPattern(positivePattern), handleProxy),
    get(new UrlPattern(negativePattern), noProxy),
    patch(new UrlPattern(positivePattern), handleProxy),
    patch(new UrlPattern(negativePattern), noProxy),
    post(new UrlPattern(positivePattern), handleProxy),
    post(new UrlPattern(negativePattern), noProxy),
    put(new UrlPattern(positivePattern), handleProxy),
    put(new UrlPattern(negativePattern), noProxy)
  )
)
