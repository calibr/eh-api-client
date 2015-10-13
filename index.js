var
  request = require("requestretry"),
  _ = require("lodash"),
  Agent = require("http").Agent,
  getClientClass = require("./lib/client");

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

Factory.prototype.setAgentOptions = function(options) {
  _.defaults(options, {keepAlive: true});
  self.agent = new Agent(options);
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

module.exports = Factory;