/**
 * Event handler for bots.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1.0.0
 **/

'use strict';

// npm modules
const path  = require('path')
const hb    = require('handlebars')
const debug = require('debug')('shinojs')

let cf,
    commands;

try {
  let cfl = path.join(process.cwd(), 'lib/command_functions.js');
  let col = path.join(process.cwd(), 'commands.json');

  cf  = require(cfl);
  commands = require(col);
} catch(e) {
  console.error(e);
  process.exit(1);
}

// events specific stuff
const events = {}
const cr     = commands.commands
const er     = commands.events
const et     = []; // events array

// commands object
const cmd    = {
  patterns: [], // commands that use patterns, table
  streams: commands.streams // streams table
}

/**
 * Executed on init of the client.
 *
 * @param {object} T - authenticated twit object
 * @param {string} user - same as tweet.user_name
 * @param {function} cb - callback
 *
 * @returns {undefined} nothing
 **/
events.init = function(T, user, cb) {
  process.stdout.write('pre-compiling templates ... ');
  cr.filter(event => {
    // If order not specified, set default of 0
    if(!event.order) event.order = 0

    if(event.response) event.template = hb.compile(event.response)

    if(event.pattern) return cmd.patterns.push(event);
  });

  // sort by order
  const sorter = (a, b) => {
    if(a.order < b.order) return -1
    if (a.order > b.order) return 1
    return 0;
  }
  cmd.patterns.sort(sorter);

  console.log('done.');

  console.log(`registering events (${er.length})... `);
  er.forEach(event => {
    if(event.type !== 'timer' && event.type !== 'one-shot') return

    debug('event:create', event.type, `func='${event.function}' ${event.type === 'timer' ? `every ${event.interval}ms` : ''}`)

    // push the event onto the "event" array.
    et.push({
      interval: event.interval,
      function: event.function || function() { return debug('placholder:function', 'no function set!!! Fix me.') },
      target:   event.target,
      type:     event.type,
      start: function() {
        debug('event:start', this.function, 'started')

        // timer events.
        if(this.type === 'timer') {
          // create an interval
          debug('event:start', this.function, 'created a timer')
          this.ic = setInterval(() => {
            cf[this.function](T);
          }, this.interval);
        }

        // one shot events.
        if(this.type === 'one-shot') { // we run this once
          debug('event:start', this.function, 'one-shot called')
          cf[this.function](T);

          // destroy the event
          this.stop()
        }
      },
      stop: function() {
        debug('event:stop', this.function, 'stopped (destroyed)')
        // clear timer events.
        if(this.type === 'timer') {
          clearInterval(this.ic);
        }

        // clear one-shot events.
        if(this.type === 'one-shot') {
          this.start = () => {};
        }
      }
    });
  });
  console.log('done.');

  // search for init events
  console.log('starting one-shot=init events ... ');
  et.forEach(event => {
    // only start one-shot init events now.
    if(event.type === 'one-shot' && event.target === 'init') {
      debug('event->init', `running '${event.function}'`)
      event.start();
    }
  });
  console.log('done.');

  if(cb) return cb();
};

/**
 * On a new tweet, could be home or public stream
 *
 * @param {object} tweet - parsed json object of a tweet.
 * @param {Twit} T - twit object
 * @param {Twit.Stream} stream - Twit stream object
 *
 * @returns {undefined} nothing
 **/
events.tweet = function(tweet, T, stream) {
  if(cmd.streams.indexOf(stream)!==-1) {
    this.parseTweet(tweet, T, stream);
  }
};

/**
 * On a new mention
 *
 * @param {object} tweet - parsed json object of a tweet.
 * @param {Twit} T - twit object
 *
 * @returns {undefined} nothing
 **/
events.mention = function(tweet, T) {
  if(cmd.streams.indexOf('mentions')!==-1) {
    this.parseTweet(tweet, T, 'mentions');
  }
};

/**
 * Internal sorter / handler for tweets.
 *
 * @param {object} tweet - twit.tweet object
 * @param {object} T - authenticated twit object
 * @param {string} stream - where the tweet originated from.
 *
 * @returns {boolean} wether a command executed or not
 * @todo Remove code duplication, condense it.
 **/
events.parseTweet = (tweet, T, stream) => {
  cmd.patterns.filter(condition => {
    if(condition.stream !== stream) return debug('pattern:check', 'wrong stream')

    // create RegExp
    const re = new RegExp(condition.pattern.string, condition.pattern.flag)

    // test the regex
    if(!re.test(tweet.text)) return debug('pattern:check', 'failed to match pattern.')

    // call the function
    cf[condition.function](T, tweet, condition);
  });
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
  console.log('connecting to twitter ... ');
}

/**
 * Connected event.
 *
 * @param {object} res - twitter response without http response object
 * @returns {undefined} nothing returned
 **/
events.connected = () => {

  // start the events
  console.log('starting timer/one-shot=stream events ... ');
  et.filter(event => {
    if(event.type === 'timer') {
      event.start();
    } else if(event.type === 'one-shot' && event.target === 'stream') {
      event.start();
    }
  });
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
  console.log(`reconnecting in ${connectInterval}`)
}


/**
 * On disconnect from the stream.
 *
 * @param {string} disconnectMessage - disconnect message/reason.
 * @returns {undefined} returns nothing
 */
events.disconnected = disconnectMessage => {
  debug('event:disconnected', disconnectMessage)
  console.log('We were disconnected from Twitter!');
  console.log(disconnectMessage);
};

module.exports = events;
