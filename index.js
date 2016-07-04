var
  request = require("request"),
  _ = require("lodash"),
  Agent = require("http").Agent,
  getClientClass = require("./lib/client");

var Factory = function(apiURL) {
  this.apiURL = apiURL;
  this.retryOptions = {
    maxAttempts: 5,
    retryDelay: 100,
    retryStrategy: function(err, params) {
      if(params && params.method && params.method.toLowerCase() !== "get") {
        return false;
      }
      // only retry if got an ECONNRESET error
      return err.code === "ECONNRESET";
    }
  };
  this.agent = new Agent({
    keepAlive: true,
    maxSockets: 1000
  });
  this.requestOptions = {
    timeout: 300000
  };
  this.Client = getClientClass();
};

Factory.prototype.setRetryOptions = function(options) {
  var self = this;
  var allowOpts = ["maxAttempts", "retryDelay", "retryStrategy"];
  allowOpts.forEach(function(k) {
    if(k in options) {
      self.retryOptions[k] = options[k];
    }
  });
};

Factory.prototype.setRequestOptions = function(options) {
  _.extend(this.requestOptions, options);
};

Factory.prototype.setAgentOptions = function(options) {
  _.defaults(options, {keepAlive: true});
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
    var c = new this.Client(this.apiURL);
    c._factory = this;
    return c.request.apply(c, args);
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
  client._factory = this;
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
  client.setRequestId(context.requestId);
  client.setSessionId(context.sessionId);
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

module.exports = Factory;