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