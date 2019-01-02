var util = require("util");

function NetworkError(code, requestParams) {
  Error.call(this, code);
  this.name = "NetworkError";
  this.code = code;
  this.message = code;
  this.retryInfo = null;
  this.requestParams = null;

  Error.captureStackTrace(this, NetworkError)
  this.stack = '(' + requestParams.method + ' ' + requestParams.url + ') ' + this.stack
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