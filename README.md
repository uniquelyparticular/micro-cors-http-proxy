# @particular./micro-cors-http-proxy

[![npm version](https://img.shields.io/npm/v/@particular./micro-cors-http-proxy.svg)](https://www.npmjs.com/package/@particular./micro-cors-http-proxy) [![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg)](https://github.com/semantic-release/semantic-release) [![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg)](https://github.com/prettier/prettier) [![CircleCI](https://img.shields.io/circleci/project/github/uniquelyparticular/micro-cors-http-proxy.svg?label=circleci)](https://circleci.com/gh/uniquelyparticular/micro-cors-http-proxy)

> 🎮 Minimal HTTP Proxy implementation to support secure whitelisting and CORS

Built with [Micro](https://github.com/zeit/micro)! 🤩

## 🛠 Setup

Create a `.env` at the project root with the following credentials:

```dosini
PROXY_PREFIX=proxy
PROXY_REFERER_WHITELIST=localhost,*.zendesk.com,*.myshopify.com,*.now.sh
PROXY_DESTINATION_WHITELIST=api.stripe.com,api.goshippo.com,api.shipengine.com,api.moltin.com,*.myshopify.com,*.salesforce.com,*.demandware.net
```

`PROXY_PREFIX` is optional and will default to `'proxy'` but is used in the URI patterns to determine where to find the encoded uri to proxy request to (ie. `https://12345678.ngrok.io/<<<PROXY_PREFIX>>>/https%3A%2F%2Fapi.somethingsecure.com%2Fadmin%2Fcustomers.json`)

`PROXY_REFERER_WHITELIST` is a comma separated list of patterns to match against the incoming requests 'Referer' header (ex. `localhost,*.myawesomesite.com,*.now.sh`)
_(and yes, 'REFERER' is intentionally misspelled to match the http header! 😉)_

`PROXY_DESTINATION_WHITELIST` is a comma separated list of patterns to match against the URI you are proxying requests to. (ex. `api.somethingsecure.com,*.somotherapi.com`)

## 📦 Package

Run the following command to build the app

```bash
yarn install
```

Start the development server

```bash
yarn dev
```

The server will typically start on PORT `3000`. If not, you'll need to restart ngrok to point to whatever server port you've started here.

## ⛽️ Usage

To send requests to the proxy, the calling implementation should use `encodeURIComponent` to encode the portion of the URI after the `PROXY_PREFIX`.

Once your server is up and running, you can send `GET`, `DELETE`, `OPTIONS`, `PATCH`, `PUT` and `POST` requests to it, ensuring that you are URIencoding the value after your `PROXY_PREFIX`. (ex. `https://<<<NGROK_URL>>>/<<<PROXY_PREFIX>>>/https%3A%2F%2Fapi.somewheresecure.com%2Fsomemethod`)

Sample call using [jQuery.get()](https://api.jquery.com/jquery.get/) below:

```js
const sampleEndpoint = `https://12345678.ngrok.io//proxy/${encodeURIComponent(
  'https://23456789.myshopify.com/admin/customers.json'
)}`

$.ajax({
  url: sampleEndpoint,
  type: 'GET',
  corse: true,
  beforeSend: xhr => {
    xhr.setRequestHeader(
      'X-Shopify-Access-Token',
      '1XXXXXxxxxxXXXXXxxxxxXXXXXxxxxx1'
    )
  }
})
  .done(console.log)
  .fail(console.error)
```

## 🚀 Deploy

You can easily deploy this function to [now](https://now.sh).

_Contact [Adam Grohs](https://www.linkedin.com/in/adamgrohs/) @ [Particular.](https://uniquelyparticular.com) for any questions._
