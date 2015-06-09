var
  Factory = require("../index"),
  should = require("should"),
  ehGuid = require("eh-guid");

var f = new Factory("http://localhost:3000");
var client = f.getClient(1, "web");

describe("Internal Auth Client test", function() {
  var noteGlobalId = ehGuid.gen();

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

  it("should make correct filter request", function(done) {
    client.get({
      test: true,
      url: "test",
      filter: [
        {key: 1},
        {
          field: "id",
          type: "gt",
          value: 500
        }
      ]
    }, function(err, req) {
      should.not.exists(err);
      req.qs.filterFields.should.eql(["key", "id"]);
      req.qs.filterType_key.should.equal("eq");
      req.qs.filterValue_key.should.equal(1);
      req.qs.filterType_id.should.equal("gt");
      req.qs.filterValue_id.should.equal(500);
      done();
    });
  });

  it("should make a range request", function(done) {
    client.get("/test", {
      range: "items 0-4",
      test: true
    }, function(err, req) {
      should.not.exists(err);
      req.url.should.equal("http://localhost:3000/test");
      req.headers.Range.should.equal("items 0-4");
      done();
    });
  });

  it("should fork client", function() {
    var fork = client.fork("/sub/url");
    fork.apiURL.should.equal(client.apiURL + "/sub/url");
  });
});