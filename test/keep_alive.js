var
  Factory = require("../index"),
  should = require("should"),
  sinon = require("sinon"),
  http = require("http"),
  async = require("async"),
  request = require("requestretry");

var SERVER_PORT = 8591;
var url = "http://localhost:" + SERVER_PORT;
var SERVER_TIMEOUT = 500;

function createServer(cb) {
  var server = http.createServer();
  server.listen(SERVER_PORT, function() {
    cb(server);
  });
}

function simpleResponse(s) {
  s.on("request", function(req, res) {
    res.end("Done");
  });
}

describe("Keep Alive", function() {
  this.timeout(10000);
  describe("use without retry if network error", function() {
    var client = new Factory(url);
    // disable retry if network error
    client.setRetryOptions({
      retryStrategy: request.RetryStrategies.HTTPError
    });
    var s;
    before(function(done) {
      createServer(function(_s) {
        s = _s;
        simpleResponse(s);
        s.timeout = SERVER_TIMEOUT;
        done();
      });
    });
    after(function(done) {
      s.close(done);
    });

    it("should got an ECONNRESET", function(done) {
      async.timesSeries(100, function(n, next) {
        client.get("/", function(err, data, res) {
          if(!err) {
            return setTimeout(next, SERVER_TIMEOUT - 5);
          }
          err.name.should.equal("NetworkError");
          err.message.should.equal("ECONNRESET");
          done();
        });
      }, function() {
        throw new Error("Error not obtained");
      });
    });
  });

  describe("use with retry if network error(Default behavior)", function() {
    var client = new Factory(url);
    var s;
    var requestsProcessed = 0;
    before(function(done) {
      createServer(function(_s) {
        s = _s;
        s.on("request", function(req, res) {
          requestsProcessed++;
          res.end("done");
        });
        s.timeout = SERVER_TIMEOUT;
        done();
      });
    });
    after(function(done) {
      s.close(done);
    });

    it("ECONNRESET should be processed and request retried", function(done) {
      async.timesSeries(10, function(n, next) {
        client.get("/", function(err, data, res) {
          should.not.exists(err);
          data.should.equal("done");
          setTimeout(next, SERVER_TIMEOUT - 5);
        });
      }, done);
    });

    it("count processed requests by server should match count of requests by client", function() {
      requestsProcessed.should.equal(10);
    });
  });
});