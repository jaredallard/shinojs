/**
 * Handles events thrown by shinobot
 *
 * <insert MIT license here>
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 0.1.0
 **/

var spin = require('simple-spinner'),
    hb   = require('handlebars'),
    cf   = require('./command_functions.js'),
    gi   = require('google-images'),
    base64 = require('node-base64-image');

var events = {};
var cr = require('../commands.json').commands;
var er = require('../commands.json').events;
var cmd = {
  cmds: {},
  patterns: []
} // populated later

// setup the global event table
global.et = []

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
        response: v.response,
        template: hb.compile(v.response)
      }
    } else if(v.pattern !== undefined) {
      cmd.patterns.push({
        function: v.function,
        pattern: v.pattern,
        response: v.response,
        template: hb.compile(v.response)
      })
    }
  });
  spin.stop();
  console.log("done.")

  process.stdout.write("registering events ... ");
  spin.start(50);
  er.filter(function(v, i) {
    if(v.type === 'timer') {
      global.et.push({
        interval: v.interval,
        function: v.function,
        type: v.type,
        start: function() {
          var that = this;
          this.ic = setInterval(function() {
            cf[that.function](T);
          }, this.interval);
        },
        stop: function() {
          clearInterval(this.ic);
        }
      });
    }
  });
  spin.stop();
  console.log('done.');

  process.stdout.write("updating location with version ... ");
  spin.start(50);
  T.post('account/update_profile', {
    location: 'v'+global.version+"."+global.commit,
    skip_status: true
  }, function(err, data, response) {
    if(err) {
      console.log(err);
      return false;
    }
    spin.stop();
    console.log("done.")

    if(cb !== undefined) {
      cb();
    }
  });
}

/**
 * On a new tweet
 *
 * @param {object} tweet - parsed json object of a tweet.
 * @note This does not recieve mentions.
 **/
events.tweet = function(tweet) {
  // we ignore all tweets.
};

/**
 * On a new mention
 *
 * @param {object} tweet - parsed json object of a tweet.
 * @note This only recieves mentions
 **/
events.mention = function(tweet, T) {
  // parse commands.
  // [0]   = username
  // [1]   = (should be) command
  // [...] = paramaters...
  var cl = tweet.text.split(' '); // we use spaces as the split paramater

  // shorthand of parsed_cmd_array[command_line[1_command_param]]
  var clp = cmd.cmds[cl[1]];

  if(clp !== undefined) {
    if(clp.function !== undefined) {
      if(cf[clp.function] !== undefined) {
        cf[clp.function](T, tweet, clp); // call the command_function specified
      } else {
        console.log("error in "+cl[1]+" template, function not found.")
      }
    } else {
      tweet.reply(clp.response); // for templates that need no functions.
    }
  } else { // maybe it fits one of the patterns
    // TODO: make less repatative
    cmd.patterns.filter(function(v, i) {
      // create the format out of the re
      if(Array.isArray(v.pattern) === true) {
        v.pattern.filter(function(val, index) {
          var re = new RegExp(val.string, val.flag);

          if(tweet.text.match(re)) {
            cf[v.function](T, tweet, v);
            return true;
          }
        });
      } else {
        var re = new RegExp(v.pattern.string, v.pattern.flag);

        if(tweet.text.match(re)) {
          cf[v.function](T, tweet, v);
        }
      }
    });
  }
};

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
  process.stdout.write("connecting to twitter ... ")
  global.ipc_spin = spin;
  global.ipc_spin.start(50);
}

/**
 * Connected event.
 *
 * @param {object} res - twitter response without http response object
 **/
events.connected = function(res) {
  global.ipc_spin.stop();
  console.log('connected.');

  // start the events
  process.stdout.write("starting timer events ... ");
  spin.start(50);
  global.et.filter(function(v, i) {
    if(v.type === 'timer') {
      v.start();
    }
  });
  spin.stop();
  console.log("done.");
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
