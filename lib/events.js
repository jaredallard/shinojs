/**
 * Event handler for bots.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 2.0.0
 **/

'use strict';

// npm modules
const debug = require('debug')('shinojs:events')
const async = require('async')

const listeners = {
  tweet: [],
  dm: []
}

const events = {}

/**
 * Run middleware on array.
 *
 * @param  {Object}    T         Twit Object
 * @param  {Array}     array     Array to process
 * @param  {Object}    content   Content for testing on.
 * @return {undefined}           Not needed
 */
const runMiddleware = (T, array, content) => {
  async.eachSeries(array, async (listener, done) => {
    const validator = listener.validator;
    const functions = listener.functions

    if(!validator.test(content.text)) return debug('validtor', 'no match')

    // "middleware!"
    debug('listener:middleware', 'running middleware')
    async.eachSeries(functions, async (func, next) => {
      func(T, content, () => {
        return next()
      })
    }, err => {
      if(err) return debug('listener:middleware', err)

      debug('listener:middleware', 'all functions processed')

      return done()
    })
  }, err => {
    if(err) return debug('listeners:process', err)
  })
}

/**
 * Create a listener.
 *
 * @param   {String} type       Type of event
 * @param   {RegExp} validator  RegExp validator
 * @param   {Array}  functions  Array of functions to process
 * @returns {Object}            listener object
 */
events.addListener = (type, validator, functions) => {
  const listener = {
    validator: validator,
    functions: functions
  }

  debug('listener:create', `type=${type}`, 'added listener')
  listeners[type].push(listener)

  return listener
}

/**
 * On a new mention
 *
 * @param   {object} tweet - parsed json object of a tweet.
 * @param   {Twit} T - twit object
 * @returns {undefined} nothing
 **/
events.mention = function(tweet, T) {
  this.parseTweet(T, tweet)
};

/**
 * Handle direct messages
 *
 * @param   {Object} dm  Direct Message
 * @param   {Object} T   Twit Object
 * @returns {undefined}  returns nothing
 */
events.direct_message = (dm, T) => {
  return runMiddleware(T, listeners.dm, dm)
}

/**
 * Internal sorter / handler for tweets.
 *
 * @param {object} T       authenticated twit object
 * @param {object} tweet   twit.tweet object
 * @param {string} stream  where the tweet originated from.
 *
 * @returns {boolean} wether a command executed or not
 **/
events.parseTweet = (T, tweet) => {
  return runMiddleware(T, listeners.dm, tweet)
}

/**
 * Favorite event
 *
 * @param {object} favorite - favorite object
 * @returns {Undefined} not implemented
 **/
events.favorite = favorite => {
  // we ignore favorites.
}

/**
 * On Twitter connection event.
 *
 * @param {object} req - connect request without http request object
 * @returns {undefined} does nothing
 */
events.connect = req => {
  debug('event:connect', 'emitted')
}

/**
 * Connected event.
 *
 * @param {object} res - twitter response without http response object
 * @returns {undefined} nothing returned
 **/
events.connected = () => {
  debug('event:connected', 'emitted')
}

/**
 * Reconnect event.
 *
 * @param {object} request - http request object
 * @param {object} response - http response object
 * @param {number} connectInterval - interval between reconnect.
 * @see https://dev.twitter.com/docs/streaming-apis/connecting
 * @todo implement?
 * @returns {undefined} returns nothing
 **/
events.reconnect = function(request, response, connectInterval) {
  debug('reconnect', 'scheduled')
}


/**
 * On disconnect from the stream.
 *
 * @param {string} disconnectMessage - disconnect message/reason.
 * @returns {undefined} returns nothing
 */
events.disconnected = disconnectMessage => {
  debug('disconnected', disconnectMessage)
};

module.exports = events;
