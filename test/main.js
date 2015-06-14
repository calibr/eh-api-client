var
  Factory = require("../index"),
  should = require("should"),
  ehGuid = require("eh-guid"),
  fs = require("fs");

var f = new Factory("http://localhost:3000");
var client = f.getClient(1, "web");
var enc = encodeURIComponent;

describe("Test factory methods", function() {
  it("get", function(done) {
    f.get({
      test: true,
      url: "test"
    }).then(function(res) {
      res.should.type("object");
      done();
    }).done();
  });

  it("send readable stream", function(done) {
    var stream = fs.createReadStream(__filename);
    f.post({
      test: true,
      url: "test"
    }, stream, function(err, res) {
      should.not.exists(res.body);
      done();
    });
  });

  it("post with headers", function(done) {
    var headers = {
      "x-custom-header-1": "1",
      "x-custom-header-2": "2"
    };
    f.post({
      test: true,
      url: "temp",
      headers: headers
    }).then(function(res) {
      res.headers.should.eql(headers);
      done();
    }).done();
  });
});

describe("Internal Auth Client test", function() {
  var noteGlobalId = ehGuid.gen();

  it("post with headers", function(done) {
    var headers = {
      "x-custom-header-1": "1",
      "x-custom-header-2": "2"
    };
    client.post({
      test: true,
      url: "temp",
      headers: headers
    }, function(err, res) {
      res.headers.should.containDeep(headers);
      done();
    });
  });

  it("get notes list", function(done) {
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
    client.get("/notes/" + noteGlobalId, function(err, data, res) {
      should.not.exists(err);
      res.should.type("object");
      data.title.should.equal("test note");
      data.globalId.should.equal(noteGlobalId);
      done();
    });
  });

  it("get note(promise)", function(done) {
    client.get("/notes/" + noteGlobalId).then(function(data) {
      data.title.should.equal("test note");
      data.globalId.should.equal(noteGlobalId);
      done();
    }).done();
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

  it("should make a range request(promise)", function(done) {
    client.get("/test", {
      range: "items 0-4",
      test: true
    }).then(function(req) {
      req.url.should.equal("http://localhost:3000/test");
      req.headers.Range.should.equal("items 0-4");
      done();
    });
  });

  it("should fork client", function() {
    var fork = client.fork("/sub/url");
    fork.apiURL.should.equal(client.apiURL + "/sub/url");
  });

  it("should fork client with placeholders in URL", function() {
    var fork = client.fork(["/blabla/??/??", "///&%&*", "&&*^$$$!@$//?"]);
    fork.apiURL.should.equal(client.apiURL + "/blabla/" + enc("///&%&*") + "/" + enc("&&*^$$$!@$//?"));
  });

  it("should request url with placeholders", function(done) {
    client.get(["/test/??/??", "///&%&*", "&&*^$$$!@$//?"], {
      test: true
    }, function(err, req) {
      should.not.exists(err);
      req.url.should.equal("http://localhost:3000/test/" + enc("///&%&*") + "/" + enc("&&*^$$$!@$//?"));
      done();
    });
  });
});