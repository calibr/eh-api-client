var
  request = require("requestretry"),
  Q = require("q"),
  _ = require("lodash"),
  Agent = require("http").Agent;

function buildError(res, data, url, method) {
  var error = new Error();
  if(typeof data === "object") {
    for(var  k in data) {
      error[k] = data[k];
    }
  }
  error.httpStatus = res.statusCode;
  if(url) {
    error.httpURL = url;
  }
  if(method) {
    error.httpMethod = method;
  }
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
  this._factory = null;
};

Client.prototype.fork = function(subUrl) {
  apiURL = this.apiURL + _url(subUrl);
  var newClient = new Client(apiURL, this._options);
  newClient._factory = this._factory;
  return newClient;
};

Client.prototype.request = function(method, options, body, cb) {
  var deferred = Q.defer();
  var self = this;
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
    body = null;
  }
  var reqParams = {
    url: this.apiURL + _url(options.url),
    method: method,
    json: true,
    qs: (options.qs ? _.clone(options.qs) : {}),
    headers: {}
  };
  if(body && !body._read) {
    reqParams.body = body;
  }
  if(this.lockUUID) {
    reqParams.headers.Authorization = "Lock " + this.lockUUID;
  }
  if(this.internalAuth) {
    reqParams.headers.Authorization = "Internal " + this.internalAuth;
  }
  if(options.filter) {
    reqParams.qs.filter = (JSON.stringify(options.filter));
  }
  if(options.range) {
    reqParams.qs.range = (JSON.stringify(options.range));
  }
  if(options.order) {
    reqParams.qs.order = (JSON.stringify(options.order));
  }
  if(options.headers) {
    _.assign(reqParams.headers, options.headers);
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
  var req = self._makeRequest(reqParams, function(err, res, data) {
    _res = res;
    if(err) {
      return deferred.reject(err);
    }
    if(res.statusCode < 200 || res.statusCode >= 300) {
      if(res.statusCode === 404 && options.notFoundIsNull) {
        // do not generate 404 error, return null as result
        data = null;
      }
      else {
        deferred.reject(buildError(res, data, reqParams.url, method), null, res);
      }
    }
    deferred.resolve(data);
  });
  if(body && body._read) {
    body.pipe(req);
  }
  return deferred.promise;
};

Client.prototype._makeRequest = function(params, cb) {
  params.agent = this._factory.agent;
  _.extend(params, this._factory.retryOptions);
  return request(params, cb);
};

Client.prototype.release = function(cb) {
  this.delete("/locks/" + this.lockUUID, function(err, data) {
    if(err) {
      return cb(err);
    }
    cb(null);
  });
};

Client.prototype.exists = function(url, options, cb) {
  if(typeof options === "function") {
    cb = options;
    options = null;
  }
  return this.request("head", url, options).then(function() {
    return true;
  }).catch(function(err) {
    if(err) {
      if(err.httpStatus === 404) {
        return false;
      }
      throw err;
    }
  }).nodeify(cb);
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
  this.retryOptions = {
    maxAttempts: 5,
    retryDelay: 100,
    retryStrategy: request.RetryStrategies.NetworkError
  };
  this.agent = new Agent({
    keepAlive: true,
    maxSockets: 1000
  });
};

Factory.Client = Client;

Factory.prototype.setRetryOptions = function(options) {
  var self = this;
  var allowOpts = ["maxAttempts", "retryDelay", "retryStrategy"];
  allowOpts.forEach(function(k) {
    if(k in options) {
      self.retryOptions[k] = options[k];
    }
  });
};

Factory.prototype.setAgentOptions = function(options) {
  _.defaults(options, {keepAlive: true});
  self.agent = new Agent(options);
};

Factory.prototype.exists = function() {
  var c = new Client(this.apiURL);
  c._factory = this;
  return c.exists.apply(c, arguments);
};

methods.forEach(function(method) {
  Factory.prototype[method.toLowerCase()] = function() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(method);
    var c = new Client(this.apiURL);
    c._factory = this;
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
    client._factory = self;
    cb(null, client);
  });
};

/**
 * @param  {Number} userId
 * @param  {String} app
 */
Factory.prototype.getClient = function(userId, app) {
  var client = new Client(this.apiURL, {
    internalAuth: userId + ":" + app
  });
  client._factory = this;
  return client;
};

module.exports = Factory;