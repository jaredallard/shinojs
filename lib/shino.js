/**
 * Shino.js - Open Source Twitter Bot Framework
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 2.0.0
 */

'use strict';

const debug   = require('debug')('shinojs')
const events  = require('./events.js')
const Twit    = require('twit')
const natural = require('natural')

// types
const Tweet         = require('./tweet.js')
const DirectMessage = require('./directmessage.js')

/**
 * Shino.js
 * @class Shino
 */
class Shino {
  constructor(opts) {

    // create Twit instance.
    this.T = new Twit({
      consumer_key: opts.consumer_key,
      consumer_secret: opts.consumer_secret,
      access_token: opts.access_token,
      access_token_secret: opts.access_token_secret
    });

    this.events = events
  }

  /**
   * Init the bot framework
   *
   * @returns {undefined} nothing
   **/
  async init() {
    const res  = await this.T.get('account/verify_credentials')
    const data = res.data;

    // check if valid.
    if(!data.screen_name) throw 'data.screen_name undefined, bad credentials?';

    debug('auth', data.screen_name)

    return this.main(this.T, data.screen_name);
  }

  /**
   * Setup an event handler.
   *
   * @param  {String}        [type='tweet']  Type of event
   * @param  {String|Object} validator       Validator, or NLP object.
   * @param  {Array}         functions       Rest of input, must be functions
   * @return {undefined}                     What did you expect?
   */
  on(type = 'tweet', validator, ...functions) {
    debug('use', validator)
    debug('use:isNLP', validator.version ? true : false)
    debug('use', functions)

    this.events.addListener(type, validator, functions)

    return;
  }

  /**
   * Done function, equiv to app.listen().
   * @return {Function} ...
   */
  done() {
    debug('done')
    return this.events.done()
  }

  /**
   * Construct a stream object for events.js
   *
   * @param   {Object} stream    twit.stream object
   * @param   {String} user      accounts "atname" aka @<whatever>
   * @param   {Object} T         authenticated twit object
   * @returns {Object}           constructed stream object.
   **/
  constructStream(stream, user, T) {
    const events = this.events;
    const streamUrl = stream.reqOpts.url.match(/([a-z]+\/?[a-z]+)\.json/i)[0]


    debug('stream', 'connected to', streamUrl)

    // on connect event
    stream.on('connect', req => {
      debug('connect', 'emitted')
      events.connect(req, T);
    });

    // on connected event
    stream.on('connected', res => {
      debug('connected', 'emitted')
      events.connected(res, T);
    });

    stream.on('tweet', tweet => {
      debug('tweet', 'emitted')

      let screen_name = tweet.user.screen_name;
      let at_name     = `@${user}`;
      tweet           = new Tweet(T, tweet) // construct the tweet addons

      // don't include tweets by us
      if(screen_name === user) return

      // check if it's @ us, if it is, that it's not a RT.
      if(tweet.text.match(at_name) && !tweet.retweeted_status) return events.mention(tweet, T);
    });

    stream.on('direct_message', dm => {
      debug('direct_message', 'emitted')

      // addon to it.
      dm = new DirectMessage(T, dm.direct_message)

      // ignore stuff from us, obviously
      if(dm.sender.screen_name === user) return

      events.direct_message(dm, T)
    })

    stream.on('disconnect', events.disconnected);

    return stream; // return the stream object if needed.
  }

  /**
   * Main function
   *
   * @param {object} T - authenticated twit object
   * @param {string} user - screen_name
   *
   * @returns {Twit.stream} twit stream object
   **/
  main(T, user) {
    debug('main', 'create user stream')
    const shim = {
      reqOpts: {
        url: 'user.json'
      },
      on: () => {
        debug('stream', 'shim mode')
      }
    }

    const stream = T.stream('user');

    // construct the stream
    return this.constructStream(stream, user, T);
  }

  // functions

  /**
   * Send a tweet.
   *
   * @param  {[type]} params [description]
   * @return {[type]}        [description]
   */
  tweet(params) {
    return new Tweet(this.T).tweet(params)
  }

  /**
   * Send a DM.
   *
   * @param  {[type]} params [description]
   * @return {[type]}        [description]
   */
  dm(params) {
    return new DirectMessage(this.T).sendDM(params)
  }

}

module.exports = Shino
