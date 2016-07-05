var
  Factory = require("../index"),
  should = require("should"),
  sinon = require("sinon"),
  http = require("http"),
  async = require("async"),
  URL = require("url"),
  Promise = require("bluebird");

var SERVER_PORT = 8591;
var SERVER_TIMEOUT = 1000;
var url = "http://localhost:" + SERVER_PORT;

function createServer(cb) {
  var server = http.createServer();
  server.listen(SERVER_PORT, function() {
    cb(server);
  });
}

describe("Modify request", function() {
  this.timeout(10000);
  var f = new Factory(url);
  // disable retry if network error
  f.client.addRequestModificator(function(params) {
    params.url += "?added=1";
    params.headers.newheader = "test";
    return Promise.resolve();
  });
  var s;
  var request;
  before(function(done) {
    createServer(function(_s) {
      s = _s;
      s.on("request", function(req, res) {
        request = req;
        res.end("Done");
      });
      s.timeout = SERVER_TIMEOUT;
      done();
    });
  });
  after(function(done) {
    s.close(done);
  });

  it("should make a request", function(done) {
    f.get("/", function(err, data, res) {
      should.not.exists(err);
      request.headers.newheader.should.equal("test");
      request.url.should.equal("/?added=1");
      done();
    });
  });
});