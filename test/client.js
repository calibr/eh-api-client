var
  Factory = require("../index"),
  should = require("should"),
  ehGuid = require("eh-guid");

var f = new Factory("http://localhost:3000");

describe("Client test", function() {
  var client;
  var noteGlobalId = ehGuid.gen();

  after(function(done) {
    client.release(function(err) {
      should.not.exists(err);
      done();
    });
  });

  it("should get locked client", function(done) {
    f.getLock({
      userId: 1,
      app: "web"
    }, function(err, c) {
      should.not.exists(err);
      should.exist(c);
      c.lockUUID.should.type("string");
      client = c;
      done();
    });
  });

  it("get notes", function(done) {
    client.get("/notes/", function(err, data) {
      should.not.exists(err);
      data.should.be.an.instanceOf(Array);
      done();
    });
  });

  it("create note", function(done) {
    client.patch("/notes/" + noteGlobalId, {
      title: "test note",
      parentId: "default"
    }, function(err) {
      should.not.exists(err);
      done();
    });
  });

  it("get note", function(done) {
    client.get("/notes/" + noteGlobalId, function(err, data) {
      should.not.exists(err);
      data.title.should.equal("test note");
      data.globalId.should.equal(noteGlobalId);
      done();
    });
  });
});


describe("Not locked request", function() {
  it("should return 404", function(done) {
    f.get("/locks/notfoundlock", function(err) {
      err.httpCode.should.equal(404);
      done();
    });
  });
});