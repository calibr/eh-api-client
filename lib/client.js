var
  Q = require("q"),
  request = require("request"),
  _ = require("lodash"),
  debuglog = require("util").debuglog("eh-api-client");

var methods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD"
];

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
  if(error.httpStatus >= 500 && error.httpStatus < 600 && !error.hasOwnProperty("name")) {
    error.name = "ServerError";
  }
  return error;
}

function buildNetworkError(res, origErr, url, method) {
  var error = new Error();
  error.httpURL = url;
  error.name = "NetworkError";
  error.message = origErr.code;
  return error;
}

module.exports = function() {
  var Client = function(apiURL, options) {
    options = options || {};
    this._options = options;
    this.lockUUID = options.lockUUID;
    this.internalAuth = options.internalAuth;
    this.apiURL = apiURL;
    this.requestId = null;
    this.sessionId = null;
    this._factory = null;
  };

  Client.prototype.fork = function(subUrl) {
    apiURL = this.apiURL + _url(subUrl);
    var newClient = new Client(apiURL, this._options);
    newClient._factory = this._factory;
    return newClient;
  };

  Client.prototype.setRequestId = function(requestId) {
    this.requestId = requestId;
  };

  Client.prototype.setSessionId = function(sessionId) {
    this.sessionId = sessionId;
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
    debuglog("Client.request", method, options, body);
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
      headers: {},
      formData: (options.formData ? options.formData: null)
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
    if(this.requestId) {
      reqParams.headers["x-request-id"] = this.requestId;
    }
    if(this.sessionId) {
      reqParams.headers["x-session-id"] = this.sessionId;
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
      debuglog("Client.request complete", method, options);
      debuglog("Client.request response error", err);
      if(err) {
        return deferred.reject(buildNetworkError(res, err, reqParams.url, method));
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

  Client.prototype._tryRequest = function(params, numTry, cb) {
    var startTime = new Date().getTime();
    debuglog("Try(" + numTry + "): ", params);
    var retryOptions = this._factory.retryOptions;
    var self = this;
    return request(params, function(err, res) {
      var duration = (new Date().getTime() - startTime)/1000;
      debuglog("Try(" + numTry + ") duration ", duration, "error: ", err);
      var args = [].slice.call(arguments);
      if(err && retryOptions) {
        var strategySupported = retryOptions.retryStrategy(err);
        var maxAttemptsReached = numTry >= retryOptions.maxAttempts;
        if(!strategySupported) {
          debuglog("Retry strategy doesn't support error", err);
        }
        if(maxAttemptsReached) {
          debuglog("Too much attempts with", err);
        }
        if(maxAttemptsReached || !strategySupported) {
          err.retryInfo = {
            try: numTry,
            strategySupported: strategySupported
          };
          return cb(err);
        }
        numTry++;
        // retry
        return setTimeout(function() {
          self._tryRequest(params, numTry, cb);
        }, retryOptions.retryDelay);
      }
      res.retryInfo = {
        try: numTry
      };
      cb.apply(null, args);
    });
  };

  Client.prototype._makeRequest = function(params, cb) {
    params.agent = this._factory.agent;
    _.extend(params, this._factory.requestOptions);
    return this._tryRequest(params, 1, cb);
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
  return Client;
};

module.exports.methods = methods;