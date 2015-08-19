/**
 * Handles events thrown by shinobot
 *
 * <insert MIT license here>
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 0.1.0
 **/

// npm modules
var spin = require('simple-spinner'),
    hb   = require('handlebars'),
    cf   = require('./command_functions.js'),
    gi   = require('google-images'),
    base64 = require('node-base64-image');

// events specific stuff
var events = {},
    cr = require('../commands.json').commands,
    er = require('../commands.json').events,
    cmd = {
      cmds: {}, // commands table
      patterns: [], // commands that use patterns, table
      validators: [], // commands that use validators table
      streams: require('../commands.json').streams // streams table
    },
    et = []; // events table

/**
 * Executed on init of the client.
 *
 * @param {object} T - authenticated twit object
 * @param {string} user - same as tweet.user_name
 * @param {function} cb - callback
 * @note This is not the same as index.init,
 **/
events.init = function(T, user, cb) {
  process.stdout.write("pre-compiling templates ... ");
  spin.start(50);
  cr.filter(function(v, i) {
    if(v.response === undefined) {
      v.response = "";
    }

    if(v.command !== undefined) {

      cmd.cmds[v.command] = {
        function: v.function,
        command: v.command,
        order:  v.order || 0,
        response: v.response,
        template: hb.compile(v.response)
      };
    } else if(v.pattern !== undefined) {
      cmd.patterns.push({
        function: v.function,
        pattern: v.pattern,
        order: v.order || 0,
        response: v.response,
        stream: v.stream,
        matchAll: v.matchAll,
        template: hb.compile(v.response)
      });
    } else if(v.validator !== undefined) {
      cmd.validators.push({
        function: v.function,
        order: v.order || 0,
        response: v.response,
        stream: v.stream,
        validator: v.validator,
        matchAll: v.matchAll,
        template: hb.compile(v.response)
      })
    }
  });

  // sort by order
  function sorter(a, b) {
    if(a.order < b.order) {
      return -1;
    } else if (a.order > b.order) {
      return 1;
    } else {
      return 0;
    }
  }
  cmd.patterns.sort(sorter);
  cmd.validators.sort(sorter);

  spin.stop();
  console.log("done.");

  process.stdout.write("registering events ... ");
  spin.start(50);
  er.filter(function(v, i) {
    if(v.type === 'timer' || v.type === 'one-shot') {
      et.push({
        interval: v.interval,
        function: v.function,
        target: v.target,
        type: v.type,
        start: function() {
          if(this.type === 'timer') { // we create an interval
            var that = this;
            this.ic = setInterval(function() {
              cf[that.function](T);
            }, this.interval);
          } else if(this.type === 'one-shot') { // we run this once
            cf[this.function](T);

            // destroy the event, it's one-shot.
            this.start = function() {};
          }
        },
        stop: function() {
          if(this.type === 'timer') {
            clearInterval(this.ic);
          }
        }
      });
    }
  });
  spin.stop();
  console.log('done.');

  // search for init events
  process.stdout.write("starting one-shot=init events ... ");
  spin.start(50);
  et.filter(function(v, i) {
    if(v.type === 'one-shot' && v.target === 'init') {
      v.start();
    }
  });
  spin.stop();
  console.log("done.");

  if(cb !== undefined) {
    cb();
  }
};

/**
 * On a new tweet, could be home or public stream
 *
 * @param {object} tweet - parsed json object of a tweet.
 * @note This does not recieve mentions.
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
 * @note This only recieves mentions
 **/
events.mention = function(tweet, T) {
  if(cmd.streams.indexOf('mentions')!==-1) {
    this.parseTweet(tweet, T, "mentions");
  }
};

/**
 * Internal sorter / handler for tweets.
 *
 * @param {object} tweet - twit.tweet object
 * @param {object} T - authenticated twit object
 * @param {string} stream - where the tweet originated from.
 * @return {boolean} wether a command executed or not
 * @todo Remove code duplication, condense it.
 **/
events.parseTweet = function(tweet, T, stream) {
  // parse commands.
  // [0]   = username
  // [1]   = (should be) command
  // [...] = paramaters...
  var cl = tweet.text.split(' '); // we use spaces as the split paramater

  // shorthand of parsed_cmd_array[command_line[1_command_param]]
  var clp = cmd.cmds[cl[1]];

  if(clp !== undefined) { // "command": "string" trigge handler
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
    cmd.patterns.filter(function(v, i) {
      if(v.stream === stream) { // only execute on the stream specified.
        // init the variables
        var must_match_all = v.matchAll,
            matched        = false,
            matches_all    = null;

        if(must_match_all !== true) {
          must_match_all = false; // failsafe
        }

        if(Array.isArray(v.pattern) === true) {
          v.pattern.filter(function(val, index) {
            var re = new RegExp(val.string, val.flag);

            // test the regex
            var match_result = re.test(tweet.text);
            if(match_result === true && must_match_all === false && matched === false) {
              matched = true; // invalidate any other regexs.
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
          var re = new RegExp(v.pattern.string, v.pattern.flag); // init dynamic regex object

          if(re.test(tweet.text)) {
            cf[v.function](T, tweet, v);
            return true;
          }
        }
      }
    });

    // test any validators.
    cmd.validators.filter(function(v, i) {
      if(v.stream === stream) { // only execute on the stream specified.
        // init the variables
        var must_match_all = v.matchAll,
            matched        = false,
            matches_all    = null;

        if(must_match_all !== true) {
          must_match_all = false; // failsafe
        }

        if(Array.isArray(v.validator) === true) {
          v.validator.filter(function(val, index) {
            try {
              var match_result = cf[val](T, tweet);
            } catch(err) {
              console.log(v.validator);
              console.log(cf[v.validator]);
              console.log(err);
              return false;
            }

            if(match_result===undefined) {
              match_result = false; // failsafe
            }

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
          try {
            var re = cf[v.validator](T, tweet);
          } catch(err) {
            console.log(v.validator);
            console.log(cf[v.validator]);
            console.log(err);
            return false;
          }

          if(re===undefined) {
            re = false;
          }

          if(re === true) {
            cf[v.function](T, tweet, v);
            return true;
          } else {
            return false;
          }
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
  console.log("connecting to twitter ... ");
}

/**
 * Connected event.
 *
 * @param {object} res - twitter response without http response object
 **/
events.connected = function(res) {

  // start the events
  console.log("starting timer/one-shot=stream events ... ");
  et.filter(function(v, i) {
    if(v.type === 'timer') {
      v.start();
    } else if(v.type === 'one-shot' && v.target === 'stream') {
      v.start();
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
  console.log('reconnecting in '+connectInterval)
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
