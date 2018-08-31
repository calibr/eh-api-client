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

describe("Secret", function() {
  var client = new Factory(url)
  let secret = 'hello-world'
  client.setSecret(secret)
  var s
  let lastReq
  before(function(done) {
    createServer(function(_s) {
      s = _s;
      s.on("request", function(req, res) {
        lastReq = req
        res.end("ok");
      });
      done();
    });
  });
  after(function(done) {
    this.timeout(20000)
    s.close(done)
  });

  it("secret should be passed", async function() {
    await client.get("/")
    lastReq.headers['x-secret'].should.equal(secret)
  });

  it("inherited client should pick up the factory secret as well", async function() {
    let clientAuth = client.getClient(123, 'app')
    await clientAuth.get("/")
    lastReq.headers['x-secret'].should.equal(secret)
    lastReq.headers['authorization'].should.equal('Internal 123:app')
  });
});