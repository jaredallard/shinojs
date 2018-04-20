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
const natural   = require('natural')
const _         = require('lodash')
const randStr   = require('random-string')

const analysis  = require('./analysis.js')

// TODO: handle this with redis, basic conversational flow handling
const users = {}

// method container
const lookupTable = {
  created_at: Date.now(),
  methods: {},
  functions: {},
  text: {}
}

const events = {}

/**
 * NLP Classifier.
 * @type {natural}
 */
events.classifier = new analysis.Classifier()

/**
 * Set the context that a user is currently in.
 *
 * @param {Object} content     Twitter Object
 * @param {String} lastMethod  Method Name
 * @returns {String} context last method
 */
const setContext = (content, lastMethod) => {
  const username = content.from.username
  const oldContext = getContext(content);

  debug('context:set', username, oldContext, '->', lastMethod)

  if(!users[username]) {
    debug('warn', 'initializing user', username)
    users[username] = {}
  }

  users[username].context = lastMethod
  users[username].last = oldContext
}

/**
 * Get the user's method context.
 *
 * @param  {Object} content  Twitter Object
 * @return {String}          Method name
 */
const getContext = content => {
  return _.get(users, `${content.from.username}.context`);
}

const setData = (content, data) => {
  return _.set(users, `${content.from.username}.data`, data);
}

const getData = content => {
  return _.get(users, `${content.from.username}.data`);
}

/**
 * Add a validator to the object.
 *
 * @param {Object} validator Validator root object
 * @param {String} root      Root class.'
 * @returns {undefined} nothing
 */
const addValidator = (validator, root) => {
  root = root ? `${root}.` : '' // append dot notation

  // Generate a base address if not supplied
  let address          = validator.address || randStr({ length: 10 });
  const finalAddress   = `${root}${address}`

  // template the input
  const innerValidator = Object.assign({}, validator)

  // train classifiers if they exist
  if(validator.classifiers) {
    validator.classifiers.forEach(sample => {
      debug('classifier:add', sample, finalAddress)
      events.classifier.add(sample, finalAddress)
    })
  }

  innerValidator.address  = address
  innerValidator.children = [] // this gets populated later.
  innerValidator.action   = validator.action || address

  // set the method into this address
  debug('write to', finalAddress)

  if(lookupTable.methods[finalAddress]) throw new Error(`Refusing to overwrite method: ${finalAddress}`)
  lookupTable.methods[finalAddress] = innerValidator

  if(validator.text) {
    lookupTable.text[validator.text] = finalAddress
  }

  if(validator.children) {
    debug('validator:children', 'processing children', validator.children)

    validator.children.forEach(child => {
      return addValidator(child, `${root}${address}`)
    })
  }

  // don't do any logic for root methods, add child to non-root methods.
  if(root == '') return;

  root = root.replace(/\.$/, '')
  if(!lookupTable.methods[root]) throw new Error(`No parent for child method: ${root}`)
  lookupTable.methods[root].children.push(finalAddress)
}


/**
 * Run middleware on array.
 *
 * @param  {Object}    T         Twit Object
 * @param  {Object}    content   Content for testing on.
 * @return {undefined}           Not needed
 */
const runMiddleware = (T, content) => {
  let context = getContext(content)

  // FIXME: DRY
  const isText = lookupTable.text[content.text]
  if(isText) {
    debug('run->text', isText)
    const validator = lookupTable.methods[isText]
    const response = runMethod(validator, [T, content, {
      getContext: function() { return getContext(content) },
      stash: function(data) { return setData(content, data) },
      getStash: function() { return getData(content) },
      setContext: function(context) { return setContext(content, context) }
    }])

    return
  }


  debug('nlp:context', context)

  const analyzed = analysis.Analyze(events.classifier, content, context)
  content.analysis = analyzed

  const availableClassifiers = analyzed.nlp.classifications
  let highestClassifier = analyzed.nlp.classified

  debug('nlp:availableClassifiers', availableClassifiers)

  if(context) {
    const children = lookupTable.methods[context].children
    if(children) {
      if(children.length === 1 && !highestClassifier) {
        // TODO: check if address on init
        // HACK: breaks
        const address = children[0].address
        debug('run->default', context, address, children[0])

        // set us as the absolute classifier.
        highestClassifier = {
          value: 1,
          label: `${children[0]}`
        }

        setContext(content, '')
      }
    }
  }

  let address             = highestClassifier.label
  if(highestClassifier.value < 0.7) { // handle "not found" situations
    debug('nlp:score', `picked: ${address} to low`);

    if(context) { // respect the last context's wishes for "dropping"
      const parentAddress = lookupTable.methods[context]
      const defaultTo     = parentAddress.default || 'root'

      // handle defaults
      debug('nlp:fork-default', `is set to ${defaultTo}`)

      if (defaultTo !== 'retry') { // drop context
        setContext(content, null)
      }

      if(defaultTo === 'root') {
        return runMiddleware(T, content)
      }
    }

    address = 'unknown';
  }

  debug('nlp:label', `picked: ${address}`)

  const validator = lookupTable.methods[address]
  if(!validator) throw new Error(`Attempted to call '${address}' but it was '${validator}'`)

  const response = runMethod(validator, [T, content, {
    getContext: function() { return getContext(content) },
    stash: function(data) { return setData(content, data) },
    getStash: function() { return getData(content) },
    setContext: function(context) { return setContext(content, context) }
  }])

  if(validator.children[0]) {
    debug('set:context', '->', address)
    setContext(content, address, response)
  }
}

/**
 * Run a method.
 *
 * @param  {Object} validator Validator Object
 * @param  {Array}  fnParams  List of params to supply to the function.
 * @return {*}                Command response
 */
const runMethod = (validator, fnParams) => {
  if(validator.call) {
    const method = validator.call
    const methodObject = lookupTable.methods[method]

    debug('runmethod:fork', '->', method)

    if(!methodObject) throw new Error(`Attempted to reference undefined method ${method} in ${validator.address}`)

    return runMethod(methodObject, fnParams)
  }

  debug('nlp:action', validator.action)
  const fn = lookupTable.functions[validator.action];
  if(!fn) return debug('nlp:action:not-found', validator.action)

  // run the action method
  return fn(fnParams[0], fnParams[1], fnParams[2])
}

/**
 * Create a listener.
 *
 * @param   {String} type       Type of event
 * @param   {RegExp} validator  RegExp validator
 * @returns {Object}            listener object
 */
events.addListener = function(type, validator) {
  const isNLP = validator.version ? true : false

  if(isNLP && validator.version == 1) throw new Error('Invalid old NLP format supplied.')
  if(!isNLP) throw new Error('Invalid shinojs pre 3.0 format')

  addValidator(validator)

  debug('logic:add', validator)

  return {}
}

/**
 * Register a function
 * @param  {String}   name Name of function
 * @param  {Function} fn   Function to run
 * @return {Boolean}       Always true, this shit never fails
 */
events.register = (name, fn) => {

  // isolate this context into it's own
  lookupTable.functions[name] = function(T, content, details) {
    return fn(T, content, details)
  }

  return true
}

/**
 * Called when done.
 * @return {undefined} todo
 */
events.done = function() {
  debug('classifier', 'started training')

  this.classifier.events.on('trainedWithDocument', prog => {
    debug('classifier', 'training progress', `${prog.index+1}/${prog.total}`)
  });

  return this.classifier.train()
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
  try {
    return runMiddleware(T, dm)
  } catch(err) {
    debug('err', err)
  }
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
