# eh-api-client

<div align="center">
  <img src="./logo.png" alt="Logo eh-api-client" width="200" height="200" />
</div>

**Battle-proven HTTP client for communication between microservices.**

Built for production service-to-service traffic: contextual authentication, correlation ID propagation, connection pooling, and automatic recovery from transient network failures.

## Install

```sh
npm install eh-api-client
```

## Quick start

```js
const ClientFactory = require("eh-api-client");

const users = new ClientFactory("http://users-service/v1");
const client = users.getClient(42, "orders-service");

const user = await client.get(["/users/??", 42]);
await client.patch(["/users/??", 42], { active: true });
```

Every method supports both Promises and Node-style callbacks. Available methods are `get`, `post`, `put`, `patch`, `delete`, `head`, and `exists`.

## Correlation IDs

Propagate `x-request-id` automatically across asynchronous call chains with `AsyncLocalStorage`:

```js
const { AsyncLocalStorage } = require("async_hooks");
const ClientFactory = require("eh-api-client");

const requestContext = new AsyncLocalStorage();
ClientFactory.setAsyncLocalStorage(requestContext);

requestContext.run(new Map([["requestId", "req-123"]]), async () => {
  await client.get("/profile"); // sends x-request-id: req-123
});
```

Request, session, and device IDs can also be assigned directly with `setRequestId`, `setSessionId`, and `setDeviceId`.

## Resilient by default

Transient network failures are retried automatically for GET requests. Retries are bounded and configurable:

```js
users.setRetryOptions({
  maxAttempts: 5,
  retryDelay: 100
});
```

For safe-to-retry writes, set `retryOnTransientError: true`. Stream bodies are never retried.

## Production features

- Shared keep-alive connection pool
- Internal, bearer-token, and secret-based authentication
- `filter`, `range`, `order`, query string, headers, timeouts, and form data
- URL placeholders with safe value encoding
- Forked clients for nested API paths
- Request modifiers and configurable defaults
- Structured HTTP and network errors
- `request-done` and `network-error` lifecycle events
- TypeScript declarations included

See the [test suite](test) for focused examples of each feature.

## License

ISC