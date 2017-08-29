/**
 * Handles events thrown by shinobot
 *
 * <insert MIT license here>
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 0.1.0
 **/

'use strict';

// npm modules
const spin = require('simple-spinner'),
      path = require('path'),
      hb   = require('handlebars');

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
let events = {},
    cr     = commands.commands,
    er     = commands.events,
    cmd    = {
      cmds: {}, // commands table
      patterns: [], // commands that use patterns, table
      validators: [], // commands that use validators table
      streams: commands.streams // streams table
    },
    et     = []; // events table

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
    if(!event.response) {
      event.response = '';
    }

    // If order not specified, set default of 0
    if(!event.order) event.order = 0

    event.template = hb.compile(event.response)

    if(event.command) {
      return cmd.cmds[event.command] = event;
    }

    if(event.pattern) {
      return cmd.patterns.push(event);
    }

    if(event.validator) {
      return cmd.validators.push(event);
    }
  });

  // sort by order
  function sorter(a, b) {
    if(a.order < b.order) {
      return -1;
    } else if (a.order > b.order) {
      return 1;
    }

    // default
    return 0;
  }
  cmd.patterns.sort(sorter);
  cmd.validators.sort(sorter);

  spin.stop();
  console.log('done.');

  console.log(`registering events (${er.length})... `);
  er.forEach(event => {
    if(event.type !== 'timer' && event.type !== 'one-shot') return

    console.log(`event: [type=${event.type},func='${event.function}'] ${event.type === 'timer' ? `every ${event.interval}ms` : ''}`)

    // push the event onto the "event" array.
    et.push({
      interval: event.interval,
      function: event.function,
      target:   event.target,
      type:     event.type,
      start: function() {
        console.log(`[event: func='${this.function}']`, 'started')
        // timer events.
        if(this.type === 'timer') {
          // create an interval
          this.ic = setInterval(() => {
            cf[this.function](T);
          }, this.interval);
        }

        // one shot events.
        if(this.type === 'one-shot') { // we run this once
          cf[this.function](T);

          this.stop()
        }
      },
      stop: function() {
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
    if(event.type === 'one-shot' && event.target === 'init') {
      console.log(`running one-shot init event '${event.function}'`)
      event.start();
    }
  });
  console.log('done.');

  if(cb) cb();
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
  // parse commands.
  // [0]   = username
  // [1]   = (should be) command
  // [...] = paramaters...
  let cl = tweet.text.split(' '); // we use spaces as the split paramater

  // shorthand of parsed_cmd_array[command_line[1_command_param]]
  let clp = cmd.cmds[cl[1]];

  if(clp !== undefined) { // "command": "string" trigger handler
    // check the stream
    if(clp.stream !== stream) {
      return false; // return false, didn't match the stream.
    }

    if(clp.function !== undefined) {
      if(cf[clp.function] !== undefined) {
        cf[clp.function](T, tweet, clp); // call the command_function specified
        return true;
      }
    }
  } else { // "pattern": Array, "pattern": Object trigger handler
    cmd.patterns.filter((v, i) => {
      if(v.stream === stream) { // only execute on the stream specified.
        // init the variables
        let must_match_all = v.matchAll,
            matched        = false,
            matches_all    = null;

        if(must_match_all !== true) {
          must_match_all = false; // failsafe
        }

        if(Array.isArray(v.pattern) === true) {
          v.pattern.filter((val, index) => {
            let re = new RegExp(val.string, val.flag);

            // test the regex
            let match_result = re.test(tweet.text);
            if(match_result && !must_match_all && !matched) {
              matched = true; // invalidate any other regexs.
              cf[v.function](T, tweet, v); // run the function.
            } else {
              if(!match_result && matches_all) {
                matches_all=false;
              } else if(match_result && matches_all === null) {
                matches_all=true;
              }
            }
          });

          // if they all match, and matchAll is true, trigger the event.
          if(matches_all && must_match_all) {
            cf[v.function](T, tweet, v);
            return true;
          }
        } else {
          let re = new RegExp(v.pattern.string, v.pattern.flag); // init dynamic regex object

          if(re.test(tweet.text)) {
            cf[v.function](T, tweet, v);
            return true;
          }
        }
      }
    });

    // test any validators.
    cmd.validators.filter((v, i) => {
      if(v.stream === stream) { // only execute on the stream specified.
        // init the variables
        let must_match_all = v.matchAll,
            matched        = false,
            matches_all    = null;

        if(must_match_all !== true) {
          must_match_all = false; // failsafe
        }

        if(Array.isArray(v.validator) === true) {
          v.validator.filter(val => {
            let match_result;
            try {
              match_result = cf[val](T, tweet);
            } catch(err) {
              console.log(v.validator);
              console.log(cf[v.validator]);
              console.log(err);
              return false;
            }

            if(!match_result) match_result = false;

            if(match_result === true && must_match_all === false && matched === false) {
              matched = true;
              cf[v.function](T, tweet, v); // run the function.
            } else {
              if(match_result === false && matches_all === true) {
                matches_all=false;
              } else if(match_result === true && matches_all === null ) {
                matches_all=true;
              }
            }
          });

          // if they all match, and matchAll is true, trigger the event.
          if(matches_all === true && must_match_all === true) {
            cf[v.function](T, tweet, v);
            return true;
          }
        } else {
          let re;
          try {
            re = cf[v.validator](T, tweet);
          } catch(err) {
            console.log(v.validator);
            console.log(cf[v.validator]);
            console.log(err);
            return false;
          }

          if(!re) {
            re = false;
          }

          if(re) {
            cf[v.function](T, tweet, v);
            return true;
          }

          return false;
        }
      }
    });
  }
}

/**
 * Favorite event
 *
 * @param {object} favorite - favorite object
 **/
events.favorite = function(favorite) {
  // we ignore favorites.
}

/**
 * On Twitter connection event.
 *
 * @param {object} resq - connect request without http request object
 */
events.connect = function(req) {
  console.log('connecting to twitter ... ');
}

/**
 * Connected event.
 *
 * @param {object} res - twitter response without http response object
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
 **/
events.reconnect = function(request, response, connectInterval) {
  console.log(`reconnecting in ${connectInterval}`)
}


/**
 * On disconnect from the stream.
 *
 * @param {string} disconnectMessage - disconnect message/reason.
 */
events.disconnected = function(disconnectMessage) {
  console.log('We were disconnected from Twitter!');
  console.log('Reason: ', disconnectMessage);
};

module.exports = events;
