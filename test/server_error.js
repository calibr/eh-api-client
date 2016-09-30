var
  Factory = require("../index"),
  should = require("should"),
  sinon = require("sinon"),
  http = require("http"),
  async = require("async");

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
      client.get("/", function(err, data, res) {
        err.name.should.equal("ServerError");
        res.statusCode.should.equal(503);
        done();
      });
    });
  });

  describe("Network error", function() {
    this.timeout(10000);

    var client = new Factory(url);
    // disable keeping alive
    client.setAgentOptions({
      keepAlive: false
    });
    client.setRequestOptions({
      timeout: 1000
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
      client.get("/", function(err) {
        err.name.should.equal("NetworkError");
        err.message.should.equal("ETIMEDOUT");
        err.retryInfo.try.should.be.greaterThan(1);
        err.retryInfo.strategySupported.should.equal(true);
        done();
      });
    });

    it("shouldn't return network error when set longer timeout", function(done) {
      client.get({
        url: "/",
        timeout: 6000
      }, function(err) {
        should.not.exists(err);
        done();
      });
    });

    it("shouldn't return network error with default factory timeout", function(done) {
      client.requestOptions = {};
      client.get("/", function(err) {
        should.not.exists(err);
        done();
      });
    });
  });

  describe("ESOCKETTIMEDOUT error", function() {
    var s;
    var client = new Factory(url);
    before(function(done) {
      createServer(function(_s) {
        s = _s;
        s.on("request", function(req, res) {
          res.write("hello");
          setTimeout(function() {
            res.end("end");
          }, 3000);
        });
        done();
      });
    });
    after(function(done) {
      s.close(done);
    });

    it("should try to perform the request multiple times", function(done) {
      this.timeout(10000);
      client.get({
        url: "/",
        timeout: 1000
      }, function(err, res) {
        should.exists(err);
        err.code.should.equal("ESOCKETTIMEDOUT");
        err.retryInfo.try.should.be.greaterThan(1);
        err.retryInfo.strategySupported.should.equal(true);
        done();
      });
    });
  });
});