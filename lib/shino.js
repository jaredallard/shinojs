/**
 * Shino.js - Open Source Chat Bot Framework
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 2.0.0
 */

'use strict';

const debug   = require('debug')('shinojs')
const events  = require('./events.js')
const path    = require('path')


/**
 * Shino.js
 * @class Shino
 */
class Shino {
  constructor(opts, adapterName = 'twitter') {
    const adapterPath = path.join(__dirname, '..', 'adapters', adapterName)

    debug('adapter', `name=${adapterName}`, `path=${adapterPath}`)

    const adapter = require(adapterPath)

    this.adapter = new adapter.Adapter(opts)
    this.events = events
  }

  /**
   * Init the bot framework
   *
   * @returns {undefined} nothing
   **/
  async init() {
    await this.adapter.connect()

    const username = this.adapter.identity()

    debug('identityProvider', username)

    this.adapter.on('message', message => {
      debug('message', message)

      if(message.from.username === username) return;

      events.direct_message(message)
    })

    this.adapter.on('public', message => {
      debug('public', message)

      if(message.creator.username === username) return;

      debug('public', 'TODO')
    })
  }

  /**
   * Setup an event handler.
   *
   * @param  {String}        [type='tweet']  Type of event
   * @param  {String|Object} validator       Validator, or NLP object.
   * @return {undefined}                     What did you expect?
   */
  on(type = 'tweet', validator) {
    debug('use', validator)
    debug('use:isNLP', validator.version ? true : false)

    this.events.addListener(type, validator)

    return;
  }

  /**
   * Register a function to be called by a classifier.
   *
   * @param  {String} name          Name of the method.
   * @param  {Function} [fn=()=>{}] Function to call.
   * @return {Boolean}              Success indicator
   */
  register(name, fn = () => {}) {
    return events.register(name, fn)
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
   * Our model
   * @return {natural} training model
   */
  get classifier() {
    return this.events.classifier
  }

}

module.exports = Shino
