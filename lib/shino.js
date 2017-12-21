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
const async   = require('async')


/**
 * Shino.js
 * @class Shino
 */
class Shino {
  constructor(opts, adapterName = 'twitter') {
    const adapterBase = path.join(__dirname, '..', 'adapters')

    const adapters = typeof adapterName === 'object' ? adapterName : [ adapterName ]
    this.adapters = adapters.map(adapter => {
      const adapterPath   = path.join(adapterBase, adapter)
      const adapterObject = require(adapterPath)

      debug('adapter', `name=${adapterName}`, `path=${adapterPath}`)
      if(!opts[adapter]) throw new Error(`Expected to find auth at opts[${adapter}]`)

      return {
        adapter: new adapterObject.Adapter(opts[adapter]),
        name: adapter
      }
    })
    this.events = events

    debug('adapters', this.adapters)
  }

  /**
   * Init the bot framework
   *
   * @returns {undefined} nothing
   **/
  async init() {
    async.forEach(this.adapters, async a => {
      const adapter  = a.adapter
      const name     = a.name

      debug('adapter', `starting '${name}'`)

      // connect to the service
      await adapter.connect()

      const username = adapter.identity()
      debug('identityProvider', username)

      adapter.on('message', message => {
        //debug('message', message)

        if(message.from.username === username) return;
        this.events.direct_message(message)
      })

      adapter.on('public', message => {
        //debug('public', message)

        if(message.creator.username === username) return;

        debug('public', 'TODO')
      })

      return null
    }, err => {
      if(err) throw new Error(err)

      debug('adapters', 'done')
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
    return this.events.register(name, fn)
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
