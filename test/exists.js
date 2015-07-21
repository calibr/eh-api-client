var
  Factory = require("../index"),
  should = require("should"),
  sinon = require("sinon");

describe("#exists", function() {
  var factory = new Factory("http://localhost");
  var client = factory.getClient(1, "test");
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
