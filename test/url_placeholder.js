var
  Factory = require("../index"),
  should = require("should"),
  ehGuid = require("eh-guid"),
  fs = require("fs");

var f = new Factory("http://localhost:3000");
var client = f.getClient(1, "web");
var enc = encodeURIComponent;

describe("Url placeholders", function() {
  it("should replace placeholder", function(done) {
    var order = ['date_updated', 'asc']
    client.setUrlPlaceholders({ws: 'gk25'})
    client.get(["/ws/?:ws/??", "id"], {
      order: order,
      test: true
    }, function(err, req) {
      should.not.exists(err);
      req.url.should.equal("http://localhost:3000/ws/gk25/id");
      req.qs.order.should.eql(JSON.stringify(order));
      done();
    });
  });
});
