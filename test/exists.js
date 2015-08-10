var
  Factory = require("../index"),
  should = require("should"),
  sinon = require("sinon"),
  http = require("http");

var SERVER_PORT = 8591;
var url = "http://localhost:" + SERVER_PORT;

function createServer(cb) {
  var server = http.createServer();
  server.listen(SERVER_PORT, function() {
    cb(server);
  });
}

describe("#exists", function() {
  var factory = new Factory(url);
  var client = factory.getClient(1, "test");

  describe("tests real server", function() {
    var s;
    var returnStatus = 200;
    var lastReq;
    before(function(done) {
      createServer(function(_s) {
        s = _s;
        s.on("request", function(req, res) {
          lastReq = req;
          res.statusCode = returnStatus;
          res.end("Done");
        });
        done();
      });
    });
    after(function(done) {
      s.close(done);
    });

    it("should exists", function(done) {
      factory.exists("/test", function(err, exists) {
        should.not.exists(err);
        should.ok(exists);
        done();
      });
    });

    it("should not exists", function(done) {
      returnStatus = 404;
      factory.exists("/test", function(err, exists) {
        should.not.exists(err);
        exists.should.equal(false);
        done();
      });
    });

    it("should be error", function(done) {
      returnStatus = 500;
      factory.exists("/test", function(err) {
        should.exist(err);
        err.httpStatus.should.equal(500);
        done();
      });
    });
  });

  describe("resource exists", function() {
    before(function() {
      sinon.stub(Factory.Client.prototype, "_makeRequest", function(params, cb) {
        cb(null, {statusCode: 200});
      });
    });
    after(function() {
      Factory.Client.prototype._makeRequest.restore();
    });
    it("should return true(factory)", function(done) {
      factory.exists("any url", function(err, exists) {
        should.not.exists(err);
        exists.should.equal(true);
        done();
      });
    });
    it("should return true(client)", function(done) {
      client.exists("any url", function(err, exists) {
        should.not.exists(err);
        exists.should.equal(true);
        done();
      });
    });
  });

  describe("resource not exists", function() {
    before(function() {
      sinon.stub(Factory.Client.prototype, "_makeRequest", function(params, cb) {
        cb(null, {statusCode: 404});
      });
    });
    after(function() {
      Factory.Client.prototype._makeRequest.restore();
    });
    it("should return true(factory)", function(done) {
      factory.exists("any url", function(err, exists) {
        should.not.exists(err);
        exists.should.equal(false);
        done();
      });
    });
    it("should return true(client)", function(done) {
      client.exists("any url", function(err, exists) {
        should.not.exists(err);
        exists.should.equal(false);
        done();
      });
    });
  });
});
