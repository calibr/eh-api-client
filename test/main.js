var
  Factory = require("../index"),
  should = require("should"),
  ehGuid = require("eh-guid"),
  fs = require("fs");

var f = new Factory("http://localhost:3000");
var client = f.getClient(1, "web");
var enc = encodeURIComponent;

describe("Common", function() {
  it("Different factories should have different Client classes", function() {
    var fact1 = new Factory("http://test.com");
    var fact2 = new Factory("http://test.com");
    fact1.Client.should.not.equal(fact2.Client);
  });
});

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

describe("Create client from context", function() {
  it("should create client from context", function() {
    var context = {
      userId: 1,
      remoteAppCode: "app",
      requestId: "request-id",
      sessionId: "session-id"
    };
    var client = f.getClientByContext(context);
    client.requestId.should.equal(context.requestId);
    client.sessionId.should.equal(context.sessionId);
    client.auth.should.eql({
      type: "Internal",
      credentials: context.userId + ":" + context.remoteAppCode
    });
  });
});

describe("Send requestId/sessionId", function() {
  it("should set requestId and sessionId in header", function(done) {
    var client = f.getClient();
    client.setRequestId("request-id");
    client.setSessionId("session-id");
    client.request("GET", {
      test: true,
      url: "/"
    }, function(err, params) {
      params.headers["x-request-id"].should.equal("request-id");
      params.headers["x-session-id"].should.equal("session-id");
      done();
    });
  });
});

describe("getRawClient", function() {
  it("should pass options to Client", function() {
    var client = f.getRawClient({
      auth: {
        type: "Session",
        credentials: "sss:app"
      }
    });
    client.auth.should.eql({
      type: "Session",
      credentials: "sss:app"
    });
  });
});

describe("Internal Auth Client test", function() {
  var noteGlobalId = ehGuid.gen();

  it("create client with userId = undefined should create guest client", function() {
    var c = f.getClient(undefined, "web");
    c.auth.should.eql({
      type: "Internal",
      credentials: "0:web"
    });
  });

  it("create client with userId = null should create guest client", function() {
    var c = f.getClient(null, "web");
    c.auth.should.eql({
      type: "Internal",
      credentials: "0:web"
    });
  });

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

  it("should make correct filter request", function(done) {
    var filter = {
      key: 1,
      "id": {
        "gt": 500
      }
    };
    client.get({
      test: true,
      url: "test",
      filter: filter
    }, function(err, req) {
      should.not.exists(err);
      req.qs.filter.should.eql(JSON.stringify(filter));
      done();
    });
  });

  it("should make a order request", function(done) {
    var order = ['date_updated', 'asc'];
    client.get("/test", {
      order: order,
      test: true
    }, function(err, req) {
      should.not.exists(err);
      req.url.should.equal("http://localhost:3000/test");
      req.qs.order.should.eql(JSON.stringify(order));
      done();
    });
  });

  it("should make a range request", function(done) {
    var range =  {
      limit: 10,
      offset: 0
    };
    client.get("/test", {
      range: range,
      test: true
    }, function(err, req) {
      should.not.exists(err);
      req.url.should.equal("http://localhost:3000/test");
      req.qs.range.should.eql(JSON.stringify(range));
      done();
    });
  });

  it("should make a range request(promise)", function(done) {
    var range =  {
      limit: 10,
      offset: 0
    };
    client.get("/test", {
      range: range,
      test: true
    }).then(function(req) {
      req.url.should.equal("http://localhost:3000/test");
      req.qs.range.should.eql(JSON.stringify(range));
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

  it("should request with encoding", function(done) {
    client.get({
      url: "/test",
      encoding: null
    }, {
      test: true
    }, function(err, req) {
      should.not.exists(err);
      should.ok(req.hasOwnProperty('encoding'));
      done();
    });
  });
});
