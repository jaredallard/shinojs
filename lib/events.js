/**
 * Event handler for bots.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 2.0.0
 **/

'use strict';

// npm modules
const debug     = require('debug')('shinojs:events')
const async     = require('async')
const natural   = require('natural')
const sentiment = require('sentiment')

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
    const validator  = listener.validator
    const functions  = listener.functions
    const classifier = listener.classifier

    // machine learning stuff
    content.analysis = {
      version: 1
    }

    // validator type
    const validatorType = typeof validator;

    // regex is object
    if(validatorType !== 'object'
    && validatorType !== 'function'
    && !classifier) {
      throw new Error(`Expected type 'object|function' for 'validator'. Got: '${typeof validator}'`)
    }

    // natural language processing
    if(classifier) {
      const classifierResult = classifier.getClassifications(content.text)
      const classified       = classifier.classify(content.text)

      content.analysis.classifier = {
        classifications: classifierResult,
        classified: classified
      }

      debug('nlp:classifications', classifierResult)
    }

    // no validator, matches all.
    if(validatorType === 'function') {
      functions.unshift(validator)
    } else if(!classifier) {
      // test the validator
      if(!validator.test(content.text)) return debug('validator', 'no match')
    }

    const sentimentResult = sentiment(content.text)
    content.analysis.entimentRating = sentimentResult

    // "middleware!"
    debug('listener:middleware', 'running middleware')
    async.eachSeries(functions, async (func, next) => {
      func(content, () => {
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
  const isNLP = validator.version ? true : false

  // natural language processing
  let classifier = false;

  if(isNLP) {
    classifier = new natural.LogisticRegressionClassifier();

    validator.classifiers.forEach(sampleText => {
      let label  = sampleText
      let sample = sampleText

      // for custom methods, i.e multiple options.
      if(typeof sample === 'object' && sample.isArray()) {
        sample   = sample[0]
        label    = sample[1];
      }

      classifier.addDocument(sample, label)
    })

    classifier.train()

    // invalidate the validator
    validator = false;
  }

  // create the listener object
  const listener = {
    validator:  validator,
    functions:  functions,
    isNLP:      isNLP,
    classifier: classifier
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
