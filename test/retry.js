var
  Factory = require("../index"),
  should = require("should"),
  sinon = require("sinon"),
  http = require("http"),
  async = require("async");

var SERVER_PORT = 8591;
var url = "http://localhost:" + SERVER_PORT;
var SERVER_TIMEOUT = 500;

function createServer(cb) {
  var server = http.createServer();
  server.listen(SERVER_PORT, function() {
    cb(server);
  });
}

describe('Requests retry', function () {
  this.timeout(2000)

  var client = new Factory(url);
  var s;
  var requestsProcessed = 0;
  before(function(done) {
    createServer(function(_s) {
      s = _s;
      s.on("request", function(req, res) {
        requestsProcessed++;
        req.socket.destroy()
      });
      s.timeout = SERVER_TIMEOUT;
      done();
    });
  });
  after(function(done) {
    s.close(done);
  });

  it("GET request should be retried by default", function(done) {
    client.get("/", function(err, data, res) {
      should.exists(err);
      err.retryInfo.strategySupported.should.equal(true)
      err.retryInfo.try.should.be.greaterThan(1)
      done()
    });
  });

  it("POST request should not be retried by default", function(done) {
    client.post("/", {hello: 'world'}, function(err, data, res) {
      should.exists(err);
      err.retryInfo.strategySupported.should.equal(false)
      err.retryInfo.try.should.equal(1)
      done()
    });
  });

  it("POST request should not be retried if allowed", function(done) {
    client.post({
      url: "/",
      retryOnTransientError: true
    }, {hello: 'world'}, function(err, data, res) {
      should.exists(err);
      err.retryInfo.strategySupported.should.equal(true)
      err.retryInfo.try.should.be.greaterThan(1)
      done()
    });
  });
})