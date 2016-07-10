var util = require("util");

function NetworkError(code) {
  Error.call(this, code);
  this.name = "NetworkError";
  this.code = code;
  this.message = code;
  this.retryInfo = null;
  this.requestParams = null;
}

util.inherits(NetworkError, Error);

NetworkError.prototype.toJSON = function() {
  return {
    name: "NetworkError",
    code: this.code,
    message: this.code,
  };
};

module.exports = NetworkError;