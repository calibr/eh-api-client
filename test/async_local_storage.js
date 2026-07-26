var
  AsyncLocalStorage = require("async_hooks").AsyncLocalStorage,
  Factory = require("../index"),
  should = require("should");

describe("Async local storage", function() {
  var asyncLocalStorage;

  beforeEach(function() {
    asyncLocalStorage = new AsyncLocalStorage();
    Factory.setAsyncLocalStorage(asyncLocalStorage);
  });

  afterEach(function() {
    Factory.setAsyncLocalStorage(null);
    asyncLocalStorage.disable();
  });

  it("should set x-request-id from the async local store", function(done) {
    var client = new Factory("http://localhost:3000").getClient();
    var requestId = "async-request-id";

    asyncLocalStorage.run(new Map([["requestId", requestId]]), function() {
      client.get({
        test: true,
        url: "/"
      }).then(function(params) {
        params.headers["x-request-id"].should.equal(requestId);
        done();
      }).catch(done);
    });
  });
});
