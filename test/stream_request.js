var
  Factory = require("../index"),
  should = require("should"),
  http = require("http"),
  util = require("util"),
  Readable = require('stream').Readable;

var TestReadStream = function(options, data) {
  this.data = data;
  Readable.call(this, options);
};

TestReadStream.prototype._read = function(size) {
  if(this.data.length === 0) {
    this.push(null);
  }
  else {
    var chunk = this.data.shift();
    this.push(chunk);
  }
};

util.inherits(TestReadStream, Readable); // inherit the prototype methods

var SERVER_PORT = 8591;
var url = "http://localhost:" + SERVER_PORT;

function createServer(cb) {
  var server = http.createServer();
  server.listen(SERVER_PORT, function() {
    cb(server);
  });
}

describe("Stream request", function() {
  describe("stream from custom readable stream", function() {
    var client = new Factory(url);
    var s;
    before(function(done) {
      createServer(function(_s) {
        s = _s;
        s.on("request", function(req, res) {
          var gotData = "";
          req.on("data", function(chunk) {
            gotData += chunk.toString();
          });
          req.on("end", function() {
            res.end(JSON.stringify({
              requested: gotData
            }));
          })
        });
        done();
      });
    });
    after(function(done) {
      s.close(done);
    });

    it("should stream request", function(done) {
      var stream = new TestReadStream({}, ["1", "2", "3"]);
      client.setAgentOptions({
        keepAlive: false
      });
      client.put("/", stream, function(err, data, res) {
        should.not.exists(err);
        data.requested.should.equal("123");
        done();
      });
    });
  });

  describe("retry request and stream", function() {
    var client = new Factory(url);
    var s;
    before(function(done) {
      createServer(function(_s) {
        s = _s;
        s.on("request", function(req, res) {
          req.socket.destroy();
        });
        done();
      });
    });
    after(function(done) {
      s.close(done);
    });

    it("shouldn't retry if body is a stream", function(done) {
      var stream = new TestReadStream({}, ["1", "2", "3"]);
      client.setAgentOptions({
        keepAlive: false
      });
      client.put("/", stream, function(err, data, res) {
        should.exists(err);
        err.retryInfo.try.should.equal(1);
        done();
      });
    });
  });
});