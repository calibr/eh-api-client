## Require

```js
var ClientFactory = require("eh-api-client");
var factory = new ClientFactory("http://someservice.com/v1"); // initialize new factory with root API url
```

## Getting client for user

```js
var client = factory.getClient(50, "web"); // get client for userId = 50 and app = "web"
```

## Getting client for guest user

```js
var client = factory.getClient(0, "web"); // you can pass 0/null/undefined/"" as first argument to initialize guest client
```

## Request options

You can pass request options in the first argument of request. Options are:
- qs - query string parameters
- url - request URL path
- formData - form data
- encoding
- filter - data filter rules
- range - data range rule
- order - order rule
- headers
- timeout - request timeout
- notFoundIsNull - if specified if request returns 404 status code then null will be returned instead of throwing error
- retryOnTransientError - if specified then request will be retried if it fails on transient errors. By default only read only requests can be retried. With this option you can retry any request.

## Events

### request-done

Emitted when request is done without any network error. Event data:

```
{
  method,
  url,
  options,
  statusCode
}
```

### network-error

Emitted when network error has occured. Event data:

```
{
  method,
  url,
  options,
  err
}
```