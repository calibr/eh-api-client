var
  Factory = require("../index"),
  should = require("should"),
  sinon = require("sinon"),
  http = require("http"),
  async = require("async");
  //request = require("requestretry");

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
  describe.skip("use without retry if network error", function() {
    var client = new Factory(url);
    // disable retry if network error
    client.setRetryOptions({
      retryStrategy: function() {
        return false;
      }
    });
    var s;
    before(function(done) {
      createServer(function(_s) {
        s = _s;
        simpleResponse(s);
        s.setTimeout(SERVER_TIMEOUT)
        done();
      });
    });
    after(function(done) {
      s.close(done);
    });

    it("should get an ECONNRESET", function(done) {
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

  describe("clients should share the factory's connection pool", function() {
    var factory = new Factory(url);
    var s;
    var requestsProcessed = 0;
    var connectionsMade = 0;
    before(function(done) {
      createServer(function(_s) {
        s = _s;
        s.on("request", function(req, res) {
          requestsProcessed++;
          res.end("done");
        });
        s.on("connection", function(req, res) {
          connectionsMade++;
        });
        s.timeout = 1000;
        done();
      });
    });
    after(function(done) {
      s.close(done);
    });

    it("made 30 requests from different clients", function(done) {
      async.timesSeries(30, function(time, next) {
        var client = factory.getClient(time, "app");
        client.get("/", function(err) {
          should.not.exists(err);
          next();
        });
      }, done);
    });

    it("should be 30 requests with only one connection", function() {
      connectionsMade.should.equal(1);
      requestsProcessed.should.equal(30);
      factory.getPoolStats().should.equal("localhost:" + SERVER_PORT + ":: 1");
    });
  });
});