// Route fixture hosts to the test server after the CLI checks the original URL.
import http from 'node:http'
import https from 'node:https'

const origin = process.env.MEMEBANK_TEST_ORIGIN
const get = http.get
http.get = function (url, options, callback) {
  if (url instanceof URL && url.origin === 'http://93.184.215.14') {
    url = new URL(url.pathname + url.search, origin)
  }
  return get.call(this, url, options, callback)
}

const httpsGet = https.get
https.get = function (url, options, callback) {
  if (
    url instanceof URL &&
    ['commons.wikimedia.org', 'upload.wikimedia.org'].includes(url.hostname)
  ) {
    return http.get(new URL(url.pathname + url.search, origin), options, callback)
  }
  return httpsGet.call(this, url, options, callback)
}

const fetch = globalThis.fetch
globalThis.fetch = (url, options) => {
  if (url instanceof URL && ['https://dev-memebank.marvinl.com', 'https://memebank-dev.marvinl.com'].includes(url.origin)) {
    url = new URL(url.pathname + url.search, origin)
  }
  return fetch(url, options)
}
