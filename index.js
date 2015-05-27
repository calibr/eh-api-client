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

Client.prototype.request = function(method, options, body, cb) {
  if(typeof body === "function") {
    cb = body;
    body = undefined;
  }
  if(typeof options === "string") {
    options = {
      url: options
    };
  }
  var reqParams = {
    url: this.apiURL + options.url,
    method: method,
    json: true,
    qs: {}
  };
  if(body) {
    reqParams.body = body;
  }
  if(this.lockUUID) {
    reqParams.headers = {Authorization: "Lock " + this.lockUUID};
  }
  if(options.filter) {
    var filterFields = [];
    for(var i = 0; i != options.filter.length; i++) {
      var filter = options.filter[i];
      if(!filter.field) {
        var key = Object.keys(filter)[0];
        if(!key) {
          continue;
        }
        filter.field = key;
        filter.value = filter[key];
        filter.type = "eq";
      }
      filterFields.push(filter.field);
      reqParams.qs["filterValue_" + filter.field] = filter.value;
      reqParams.qs["filterType_" + filter.field] = filter.type;
    }
    reqParams.qs["filterFields"] = filterFields;
  }
  if(options.test) {
    return cb(null, reqParams);
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