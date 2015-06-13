var
  request = require("request"),
  Q = require("q");

function buildError(res, data) {
  var error = new Error();
  if(typeof data === "object") {
    for(var  k in data) {
      error[k] = data[k];
    }
  }
  error.httpStatus = res.statusCode;
  return error;
}

function _url(data) {
  if(typeof data === "string") {
    return data;
  }
  if(data instanceof Array) {
    var url = data.shift();
    url = url.replace(/\?\?/g, function() {
      return encodeURIComponent(data.shift());
    });
    return url;
  }
  throw new Error("url should be a string or an array");
}

var methods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD"
];

var Client = function(apiURL, options) {
  options = options || {};
  this._options = options;
  this.lockUUID = options.lockUUID;
  this.internalAuth = options.internalAuth;
  this.apiURL = apiURL;
};

Client.prototype.fork = function(subUrl) {
  apiURL = this.apiURL + _url(subUrl);
  var newClient = new Client(apiURL, this._options);
  return newClient;
};

Client.prototype.request = function(method, options, body, cb) {
  var deferred = Q.defer();
  if(typeof body === "function") {
    cb = body;
    body = undefined;
  }
  if(typeof options === "string" || (options instanceof Array)) {
    options = {
      url: options
    };
  }
  if(method === "GET" && typeof body === "object") {
    // body is options for GET request
    for(var k in body) {
      options[k] = body[k];
    }
  }
  var reqParams = {
    url: this.apiURL + _url(options.url),
    method: method,
    json: true,
    qs: {},
    headers: {}
  };
  if(body) {
    reqParams.body = body;
  }
  if(this.lockUUID) {
    reqParams.headers.Authorization = "Lock " + this.lockUUID;
  }
  if(this.internalAuth) {
    reqParams.headers.Authorization = "Internal " + this.internalAuth;
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
  if(options.range) {
    reqParams.headers.Range = options.range;
  }
  // _res will store result of http request, for return in callback
  var _res;
  deferred.promise.nodeify(function(err, data) {
    if(!cb) {
      return;
    }
    cb(err, data, _res);
  });
  if(options.test) {
    process.nextTick(function() {
      deferred.resolve(reqParams);
    });
    return deferred.promise;
  }
  request(reqParams, function(err, res, data) {
    _res = res;
    if(err) {
      return deferred.reject(err);
    }
    if(res.statusCode < 200 || res.statusCode >= 300) {
      deferred.reject(buildError(res, data), null, res);
    }
    deferred.resolve(data);
  });
  return deferred.promise;
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
    return this.request.apply(this, args);
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
    return c.request.apply(c, args);
  };
});

/**
 * get locked client
 * @param  {Object} options
 * @param  {Number} options.userId
 * @param  {String} options.app
 * @param  {String} [options.lockType]
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
    var client = new Client(self.apiURL, {
      lockUUID: data.uuid
    });
    cb(null, client);
  });
};

/**
 * @param  {Number} userId
 * @param  {String} app
 */
Factory.prototype.getClient = function(userId, app) {
  return new Client(this.apiURL, {
    internalAuth: userId + ":" + app
  });
};

module.exports = Factory;