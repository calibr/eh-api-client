var
  request = require("request");

function buildError(res, data) {
  var error = new Error();
  if(typeof data === "object") {
    for(var  k in data) {
      error[k] = data[k];
    }
  }
  error.httpCode = res.statusCode;
  return error;
}

var methods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH"
];

var Client = function(apiURL, lockUUID) {
  this.lockUUID = lockUUID;
  this.apiURL = apiURL;
};

Client.prototype.request = function(method, url, body, cb) {
  if(typeof body === "function") {
    cb = body;
    body = undefined;
  }
  var reqParams = {
    url: this.apiURL + url,
    method: method,
    json: true
  };
  if(body) {
    reqParams.body = body;
  }
  if(this.lockUUID) {
    reqParams.headers = {Authorization: "Lock " + this.lockUUID};
  }
  request(reqParams, function(err, res, data) {
    if(err) {
      return cb(err);
    }
    if(res.statusCode !== 200) {
      return cb(buildError(res, data));
    }
    cb(null, data);
  });
};

Client.prototype.release = function(cb) {
  this.delete("/locks/" + this.lockUUID, function(err, data) {
    if(err) {
      return cb(err);
    }
    cb(null);
  });
};

methods.forEach(function(method) {
  Client.prototype[method.toLowerCase()] = function() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(method);
    this.request.apply(this, args);
  };
});

var Factory = function(apiURL) {
  this.apiURL = apiURL;
};

methods.forEach(function(method) {
  Factory.prototype[method.toLowerCase()] = function() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(method);
    var c = new Client(this.apiURL);
    c.request.apply(c, args);
  };
});

/**
 * get locked client
 * @param  {Object} options
 * @param  {Number} options.userId
 * @param  {String} options.app
 * @return {Client}
 */
Factory.prototype.getLock = function(options, cb) {
  var self = this;
  request({
    url: this.apiURL + "/locks/",
    json: true,
    body: options,
    method: "POST"
  }, function(err, res, data) {
    if(err) {
      return cb(err);
    }
    if(res.statusCode !== 200) {
      return cb(buildError(res, data));
    }
    var client = new Client(self.apiURL, data.uuid);
    cb(null, client);
  });
};

module.exports = Factory;