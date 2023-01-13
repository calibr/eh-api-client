var
  request = require("request"),
  _ = require("lodash"),
  Agent = require('agentkeepalive'),
  HttpsAgent = require('agentkeepalive').HttpsAgent,
  getClientClass = require("./lib/client"),
  eventEmitter = require('./lib/eventemitter')
  Client = require("./lib/client")

var defaultAgentOptions = {
  keepAlive: true,
  maxSockets: 124,
  maxFreeSockets: 10,
  freeSocketTimeout: 30000,
  timeout: 60000,
  // because node http server default timeout is 120 seconds, close socket before its timeout
};

var Factory = function(apiURL) {
  this.apiURL = apiURL;
  this.secret = null;
  this.retryOptions = {
    maxAttempts: 5,
    retryDelay: 100,
    retryStrategy: function(err, params) {
      const method = params && params.method && params.method.toLowerCase() || ''
      if (err.code === 'EAI_AGAIN' || err.code === 'EHOSTUNREACH') {
        // for this kind of errors the request definitely has not reached the destionation
        return true
      }
      if(method === "get") {
        // https://man7.org/linux/man-pages/man3/errno.3.html
        return err.code === "ECONNRESET" || err.code === "ETIMEDOUT" || err.code === "ESOCKETTIMEDOUT" || err.code === 'ECONNREFUSED';
      }
      return false
    }
  };
  if(/^https:\/\//.test(apiURL)) {
    this.agent = new HttpsAgent(defaultAgentOptions);
  }
  else {
    this.agent = new Agent(defaultAgentOptions);
  }
  this.requestOptions = {
    timeout: 300000
  };
  this.Client = getClientClass();
  this._client;

  this.__defineGetter__("client", function() {
    if(!this._client) {
      this._client = new this.Client(this.apiURL);
      this._client._factory = this;
      Factory.setClientProperties(this._client)
    }
    return this._client;
  });
};

Factory.asyncLocalStorage = null

Factory.setAsyncLocalStorage = function(asyncLocalStorage) {
  Factory.asyncLocalStorage = asyncLocalStorage
}

Factory.getFromStore = function(property) {
  if (null !== Factory.asyncLocalStorage) {
    const store = Factory.asyncLocalStorage.getStore()
    if (undefined !== store) {
      const value = store.get(property)
      if (value) {
        return value
      }
    }
  }
  return null
}

Factory.setClientProperties = function(client, context) {
  const requestId = Factory.getFromStore('requestId') || (context && context.requestId)
  if (null !== requestId) {
    client.setRequestId(requestId)
  }
  const deviceId = Factory.getFromStore('deviceId') || (context && context.deviceId)
  if (null !== deviceId) {
    client.setDeviceId(deviceId)
  }
  const sessionId = Factory.getFromStore('sessionId') || (context && context.sessionId)
  if (null !== sessionId) {
    client.setSessionId(sessionId)
  }
}

Factory.prototype.setRetryOptions = function(options) {
  var self = this;
  var allowOpts = ["maxAttempts", "retryDelay", "retryStrategy"];
  allowOpts.forEach(function(k) {
    if(k in options) {
      self.retryOptions[k] = options[k];
    }
  });
};

Factory.prototype.setSecret = function(secret) {
  this.secret = secret
};

Factory.prototype.setRequestOptions = function(options) {
  _.extend(this.requestOptions, options);
};

Factory.prototype.setAgentOptions = function(options) {
  _.defaults(options, defaultAgentOptions);
  this.agent = new Agent(options);
};

Factory.prototype.exists = function() {
  var c = new this.Client(this.apiURL);
  c._factory = this;
  return c.exists.apply(c, arguments);
};

getClientClass.methods.forEach(function(method) {
  Factory.prototype[method.toLowerCase()] = function() {
    var args = Array.prototype.slice.call(arguments);
    args.unshift(method);
    return this.client.request.apply(this.client, args);
  };
});


/**
 * @param  {Number} userId
 * @param  {String} app
 */
Factory.prototype.getClient = function(userId, app) {
  if(!userId) {
    userId = 0;
  }
  var client = new this.Client(this.apiURL, {
    internalAuth: userId + ":" + app
  });
  Factory.setClientProperties(client)
  client._factory = this;
  return client;
};

/**
 */
Factory.prototype.getRawClient = function(options) {
  var client = new this.Client(this.apiURL, options);
  client._factory = this;
  Factory.setClientProperties(client)
  return client;
};

/**
 * @param  {Number} userId
 * @param  {String} app
 */

Factory.prototype.getClientByContext = function(context) {
  var client = new this.Client(this.apiURL, {
    internalAuth: context.userId + ":" + context.remoteAppCode
  });
  Factory.setClientProperties(client, context)
  client._factory = this;
  return client;
};

Factory.prototype.getPoolStats = function() {
  var hostsSocketsCount = {};
  var host;
  if(typeof this.agent.freeSockets === "object") {
    for(host in this.agent.freeSockets) {
      if(!hostsSocketsCount[host]) {
        hostsSocketsCount[host] = 0;
      }
      hostsSocketsCount[host] += this.agent.freeSockets[host].length;
    }
  }
  if(typeof this.agent.sockets === "object") {
    for(host in this.agent.sockets) {
      if(!hostsSocketsCount[host]) {
        hostsSocketsCount[host] = 0;
      }
      hostsSocketsCount[host] += this.agent.sockets[host].length;
    }
  }

  var lines = [];
  for(host in hostsSocketsCount) {
    lines.push(host + ": " + hostsSocketsCount[host]);
  }
  return lines.join("\n");
};

Factory.on = function(...args) {
  eventEmitter.on(...args)
}

Factory.default = Factory

module.exports = Factory;
