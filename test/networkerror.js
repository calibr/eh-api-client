var NetworkError = require("../lib/networkerror");
var should = require("should");

describe("NetworkError", function() {
  it("toJSON", function() {
    var error = new NetworkError("test", {url: 'http://google.com'});
    var str = JSON.stringify(error);
    str.should.equal(JSON.stringify({
      name: "NetworkError",
      code: "test",
      message: "test"
    }));
  });
});