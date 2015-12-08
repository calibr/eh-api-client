var
  Factory = require("../index"),
  should = require("should"),
  sinon = require("sinon"),
  http = require("http"),
  async = require("async"),
  request = require("requestretry");

var SERVER_PORT = 8591;
var url = "http://localhost:" + SERVER_PORT;

function createServer(cb) {
  var server = http.createServer();
  server.listen(SERVER_PORT, function() {
    cb(server);
  });
}

describe("Server Error", function() {
  describe("5xx response", function() {
    var client = new Factory(url);
    /*
    client.setRequestOptions({
      timeout: 1000
    });
    */
    // disable keeping alive
    client.setAgentOptions({
      keepAlive: false
    });
    // retry only on network error
    client.setRetryOptions({
      retryStrategy: request.RetryStrategies.NetworkError
    });
    var s;
    before(function(done) {
      createServer(function(_s) {
        s = _s;
        s.on("request", function(req, res) {
          res.statusCode = 503;
          res.end("Gateway Timeout!");
        });
        done();
      });
    });
    after(function(done) {
      s.close(done);
    });

    it("should return server error on 5xx http status", function(done) {
      client.get("/", function(err, data) {
        err.name.should.equal("ServerError");
        err.httpStatus.should.equal(503);
        done();
      });
    });
  });

  describe("Network error", function() {
    this.timeout(10000);

    var client = new Factory(url);
    client.setRequestOptions({
      timeout: 1000
    });
    // disable keeping alive
    client.setAgentOptions({
      keepAlive: false
    });
    // retry only on network error
    client.setRetryOptions({
      retryStrategy: request.RetryStrategies.HttpError
    });
    var s;
    before(function(done) {
      createServer(function(_s) {
        s = _s;
        s.on("request", function(req, res) {
          setTimeout(function() {
            res.statusCode = 200;
            res.end("Too late...");
          }, 5000);
        });
        done();
      });
    });
    after(function(done) {
      s.close(done);
    });

    it("should return network error when timeout out", function(done) {
      client.get("/", function(err, data) {
        err.name.should.equal("NetworkError");
        err.message.should.equal("ETIMEDOUT");
        done();
      });
    });
  });
});