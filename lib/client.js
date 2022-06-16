var
  request = require("request"),
  _ = require("lodash"),
  debuglog = require("util").debuglog("eh-api-client"),
  NetworkError = require("./networkerror"),
  PassThroughStream = require("stream").PassThrough,
  eventEmitter = require('./eventemitter'),
  nodeify = require('nodeify')

var methods = [
  "GET",
  "POST",
  "PUT",
  "DELETE",
  "PATCH",
  "HEAD"
];

function isReadStream(body) {
  return Boolean(body._read);
}

function buildError(res, data, callerStack) {
  var error = new Error();
  error.callerStack = callerStack
  Error.captureStackTrace(error, buildError)
  error.stack = '(' + res.request.method + ' ' + res.request.uri.href + ') ' + error.stack
  if(typeof data === "object") {
    for(var  k in data) {
      error[k] = data[k];
    }
  }
  error.httpStatus = res.statusCode;
  error.httpMethod = res.request.method
  error.httpUri = res.request.uri.href
  if(res.statusCode >= 500 && res.statusCode < 600 && !error.hasOwnProperty("name")) {
    error.name = "ServerError";
  } else {
    error.type = 'NimbusApiErrorRemote'
  }
  return error;
}

function buildNetworkError(origErr, callerStack) {
  var error = new NetworkError(origErr.code, origErr.requestParams);
  error.retryInfo = origErr.retryInfo;
  error.requestParams = origErr.requestParams;
  error.origErr = origErr
  error.callerStack = callerStack
  return error
}

module.exports = function() {
  var Client = function(apiURL, options) {
    options = options || {};
    if(options.internalAuth) {
      options.auth = {
        type: "Internal",
        credentials: options.internalAuth
      };
      delete options.internalAuth;
    }
    this._options = options;
    this._defaultOptions = {}
    this.auth = options.auth;
    this.apiURL = apiURL;
    this.requestId = null;
    this.sessionId = null;
    this.deviceId = null;
    this._factory = null;
    this._requestModificators = [];
    this.requestOptions = {};
    this.urlPlaceholders = {}
    this.headers = {}
  };

  Client.prototype.setUrlPlaceholders = function(data) {
    for(let k in data) {
      this.urlPlaceholders[k] = data[k]
    }
  }

  Client.prototype._url = function(data) {
    let url
    if(typeof data === "string") {
      url = data
    }
    else if(data instanceof Array) {
      // no modification to the input URL should be made, so we clone the variable
      data = data.slice()
      url = data.shift()
      url = url.replace(/\?\?/g, function() {
        return encodeURIComponent(data.shift())
      });
    }
    else {
      throw new Error("url should be a string or an array");
    }
    for(let k in this.urlPlaceholders) {
      url = url.replace(new RegExp("\\?:" + k, "g"), this.urlPlaceholders[k])
    }
    return url
  }

  Client.prototype.addRequestModificator = function(func) {
    if(this._requestModificators.indexOf(func) === -1) {
      this._requestModificators.push(func);
    }
  };

  Client.prototype.removeRequestModificator = function(func) {
    var index = this._requestModificators.indexOf(func);
    if(index >= 0) {
      this._requestModificators.splice(index, 1);
    }
  };

  Client.prototype.fork = function(subUrl) {
    var apiURL = this.apiURL + this._url(subUrl);
    var newClient = new Client(apiURL, this._options);
    newClient._factory = this._factory;
    newClient.requestOptions = this.requestOptions;
    return newClient;
  };

  Client.prototype.setRequestOptions = function(options) {
    _.extend(this.requestOptions, options);
  };

  Client.prototype.setOptions = function(options) {
    _.extend(this._defaultOptions, options);
  };

  Client.prototype.setRequestId = function(requestId) {
    this.requestId = requestId;
  };

  Client.prototype.setDeviceId = function(deviceId) {
    this.deviceId = deviceId;
  };

  Client.prototype.setSessionId = function(sessionId) {
    this.sessionId = sessionId;
  };

  Client.prototype.setHeaders = function(headers) {
    this.headers = headers;
  };

  Client.prototype.request = function(method, options, body, cb) {
    const callerStack = new Error().stack

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
      url: this.apiURL + this._url(options.url),
      method: method,
      json: true,
      qs: (options.qs ? _.clone(options.qs) : {}),
      headers: {},
      formData: (options.formData ? options.formData: null)
    };

    _.defaults(options, this._defaultOptions)

    if (options.hasOwnProperty('encoding')) {
      reqParams.encoding = options.encoding;
    }
    if(body) {
      reqParams.body = body;
    }
    if(this.auth) {
      reqParams.headers.Authorization = this.auth.type + " " + this.auth.credentials;
    }
    if(this.requestId) {
      reqParams.headers["x-request-id"] = this.requestId;
    }
    if(this.sessionId) {
      reqParams.headers["x-session-id"] = this.sessionId;
    }
    if(this.deviceId) {
      reqParams.headers["x-device-id"] = this.deviceId;
    }
    if(this._factory.secret) {
      reqParams.headers["x-secret"] = this._factory.secret;
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
    if(this.headers) {
      _.assign(reqParams.headers, this.headers);
    }
    if(options.headers) {
      _.assign(reqParams.headers, options.headers);
    }
    if(options.timeout) {
      reqParams.timeout = options.timeout;
    }
    // _res will store result of http request, for return in callback
    var _res, _req;

    if(reqParams.body && isReadStream(reqParams.body)) {
      var passThroughStream = new PassThroughStream();
      passThroughStream._originalSource = reqParams.body;
      reqParams.body.pipe(passThroughStream);
      reqParams.body = passThroughStream;
    }

    var self = this;
    var promise = new Promise(function(resolve, reject) {
      if(options.test) {
        return resolve(reqParams);
      }

      function emitRequestDone (res) {
        eventEmitter.emit('request-done', {
          method,
          url: reqParams.url,
          reqParams,
          statusCode: res.statusCode
        })
      }

      var req = self._makeRequest(reqParams, function(err, res, data) {
        _req = req;
        _res = res;
        debuglog("Client.request complete", method, options);
        debuglog("Client.request response error", err);
        if(err) {
          eventEmitter.emit('network-error', {
            method,
            url: reqParams.url,
            reqParams,
            err
          })
          return reject(buildNetworkError(err, callerStack));
        }
        emitRequestDone(res)
        if(res.statusCode < 200 || res.statusCode >= 300) {
          if(res.statusCode === 404 && options.notFoundIsNull) {
            // do not generate 404 error, return null as result
            data = null;
          }
          else {
            return reject(buildError(res, data, callerStack));
          }
        }
        let dataToResolve = data
        if(options.details) {
          dataToResolve = {data, req: _req, res: _res}
        }
        resolve(dataToResolve);
      });
    });

    let cbCalled = false
    let nodeifyFn = function(err, data) {
      if(!cb) {
        return;
      }
      if(cbCalled) {
        console.error('eh-api-client request callback called twice', method, options, new Error().stack, 'request error:', err)
        return
      }
      cbCalled = true
      cb(err, data, _res, _req);
    }
    if (cb) {
      nodeify(promise, nodeifyFn)
    }
    return promise
  };

  Client.prototype._tryRequest = function(params, tryErrorHistory, cb) {
    var startTime = new Date().getTime();
    var numTry = tryErrorHistory.length + 1;
    debuglog("Try(" + numTry + "): ", params);
    var retryOptions = this._factory.retryOptions;
    var self = this;
    var bodyStream = null;
    var sendParams = _.clone(params);
    if(sendParams.body && isReadStream(params.body)) {
      bodyStream = params.body;
      delete sendParams.body;
    }
    var req = request(sendParams, function(err, res) {
      var duration = (new Date().getTime() - startTime)/1000;
      debuglog("Try(" + numTry + ") duration ", duration, "error: ", err);
      var args = [].slice.call(arguments);
      if(err) {
        err.retryInfo = {
          try: numTry
        };
        // if request has failed and body is stream, do not retry request
        if(retryOptions && !bodyStream) {
          var strategySupported = retryOptions.retryStrategy(err, params);
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
              strategySupported: strategySupported,
              tryErrorHistory: tryErrorHistory
            };
            var debugParams = _.clone(params);
            delete debugParams.agent;
            err.requestParams = debugParams;
            return cb(err);
          }
          tryErrorHistory.push(err);
          // retry
          return setTimeout(function() {
            self._tryRequest(params, tryErrorHistory, cb);
          }, retryOptions.retryDelay);
        }
        else {
          // no retry options passed or body is stream, still need to fill requestParams for the error
          // because NetworkError build will need that
          var debugParams = _.clone(params)
          delete debugParams.agent
          err.requestParams = debugParams
        }
      }
      else if(res) {
        res.retryInfo = {
          try: numTry,
          tryErrorHistory: tryErrorHistory
        };
      }
      cb.apply(null, args);
    });
    if(bodyStream) {
      bodyStream.pipe(req);
    }
  };

  Client.prototype._makeRequest = async function(params, cb) {
    params.agent = this._factory.agent;
    _.defaults(params, this.requestOptions);
    _.defaults(params, this._factory.requestOptions);
    for (const modificator of this._requestModificators) {
      await modificator(params)
    }
    return this._tryRequest(params, [], cb);
  };

  Client.prototype.exists = function(url, options, cb) {
    if(typeof options === "function") {
      cb = options;
      options = null;
    }
    var self = this, _res, _req;

    nodeify

    const promise = new Promise(function (resolve, reject) {
      self.request("head", url, options, function(err, data, res, req) {
        _res = res;
        _req = req;
        if (!err) return resolve(true);
        if (res && res.statusCode == 404) return resolve(false);
        reject(err);
      })
    })
    if (cb) {
      nodeify(promise, function(err, data) {
        cb(err, data, _res, _req);
      })
    }
    return promise
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

