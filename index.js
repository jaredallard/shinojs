/**
 * (c) 2015 Jared Allard
 *
 * <insert MIT license here>
 *
 * @license MIT
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 **/

var prompt  = require('prompt'),
    fs      = require('fs'),
    spin    = require('simple-spinner'),
    events  = require('./lib/events.js'),
    twit    = require('twit');

// temp?
function getCommit() {
  var commit = 'NOT-GIT';
  if(fs.existsSync('.git/refs/heads/master')) {
    commit = fs.readFileSync('.git/refs/heads/master', 'utf8').substr(0, 7);
  }

  return commit;
}

// version information
global.version =  require('./package.json').version;
global.commit = getCommit();
global.name = require('./package.json').name;


// check the config files, if they don't exist start an interactive prompt.
// TODO: allow specification from the command line?
if(!fs.existsSync('./config.json')) {
  // use npm prompt to ask the user.
  prompt.start();

  var schema = {
    properties: {
      consumer_key: {
        required: true
      },
      consumer_secret: {
        required: true
      },
      access_token: {
        required: true
      },
      access_token_secret: {
        required: true
      }
    }
  };

  prompt.get(schema, function (err, result) {
    if(result.consumer_key === '') {
      throw 'consumer_key empty';
    } else if (result.consumer_secret === '') {
      throw 'consumer_secret empty';
    } else if(result.access_token === '') {
      throw 'access_token empty';
    } else if (result.access_token_secret === '') {
      throw 'access_token_secret empty';
    }

    // test our credentials
    process.stdout.write('testing credentials ... ');

    // start the spinner
    spin.start(50);

    // check if we're okay with twit.
    var T = new twit({
      consumer_key: result.consumer_key,
      consumer_secret: result.consumer_secret,
      access_token: result.access_token,
      access_token_secret: result.access_token_secret
    });

    T.get('account/verify_credentials', function(err, data, res) {
      if(err) {
        throw err;
      }

      if(data.screen_name === undefined) {
        throw 'data.screen_name undefined, bad credentials?';
      }

      // stop the spinner.
      spin.stop();
      console.log("done.");

      var config = result; // should be already setup.

      // write it async-ly to our config file, then we can init.
      fs.writeFile('./config.json', JSON.stringify(config), 'utf8', function() {
        init(result.consumer_key, result.consumer_secret, result.access_token, result.access_token_secret);
      });
    });
  });
} else {
  var data = require('./config.json');
  if(data.access_token === '') {
    throw 'config.json is invalid. please delete it.'
  } else {
    init(data.consumer_key, data.consumer_secret, data.access_token, data.access_token_secret);
  }
}

// init the applications, for async.
function init(ck, cs, at, ats) {
  console.log("(c) 2015 Jared Allard");
  console.log(global.name, "v:", global.version, "c:", global.commit);

  var T = new twit({
    consumer_key: ck,
    consumer_secret: cs,
    access_token: at,
    access_token_secret: ats
  });

  T.get('account/verify_credentials', function(err, data, res) {
    if(err) {
      throw err;
    }

    if(data.screen_name === undefined) {
      throw 'data.screen_name undefined, bad credentials?';
    }

    console.log('pre-init auth check succedded.')
    console.log("screen_name:", data.screen_name);

    events.init(T, data.screen_name, function() {
      main(T, data.screen_name);
    });
  });
}

/**
 * Add to the twit.tweet object
 *
 * @param {object} tweet  - twit.tweet object
 * @param {object} T      - authenticated twit object
 * @return {object} tweet - twit.tweet object with addons
 **/
function tweetAddon(tweet, T) {
  /**
   * Reply to a tweet
   *
   * @param {string} text - status to send. Automatically adds username at front.
   * @callback cb
   * @return {object} err - returns err on error.
   **/
  tweet.reply = function(text, cb) {
      T.post('statuses/update', {
        status: '@'+tweet.user.screen_name+' '+text,
        in_reply_to_status_id: tweet.id_str
      }, function(err, data, res) {
        if(err) {
          if(cb!==undefined) cb(err);
          return;
        }

        if(cb!==undefined) cb();
      });
  }

  /**
   * Favourite a tweet
   *
   * @callback cb
   * @return {object} err - returns err on error.
   **/
  tweet.favorite = function(cb) {
    T.post('favorites/create', {
      id: tweet.id_str
    }, function(err, data, res) {
      if(err) {
        if(cb!==undefined) cb(err);
        return;
      }

      if(cb!==undefined) cb();
    })
  }

  /**
   * Retweet a tweet
   *
   * @callback cb
   * @return {object} err - returns err on error.
   **/
  tweet.retweet = function(cb) {
    T.post('statuses/retweet/:id', {
      id: tweet.id_str
    }, function(err, data, res) {
      if(err) {
        if(cb!==undefined) cb(err);
        return;
      }

      if(cb!==undefined) cb();
    })
  }

  return tweet;
}

/**
 * Construct a stream object for events.js
 *
 * @param {object} stream - twit.stream object
 * @param {string} user   - accounts "atname" aka @<whatever>
 * @param {object} T      - authenticated twit object
 * @return {object} stream - constructed stream object.
 **/
function constructStream(stream, user, T) {
  stream.on('connect', function(req) {
    events.connect(req, T)
  });

  stream.on('connected', function(res) {
    events.connected(res, T);
  });

  stream.on('tweet', function(tweet) {
    tweet = tweetAddon(tweet, T);

    if(tweet.user.screen_name===user) { // drop tweets from us.
      return;
    }

    // check if it's @ us, and if it is that it's not a RT.
    if(tweet.text.match('@'+user) && (typeof(tweet.retweeted_status)==='undefined')) {
      events.mention(tweet, T); // call mention event.
    } else {
      events.tweet(tweet, T); // call tweet event.
    }
  });

  stream.on('favorite', events.favorite);

  stream.on('disconnect', events.disconnected);

  return stream; // return the stream object if needed.
}

/**
 * Main function
 *
 * @param {object} T - authenticated twit object
 * @param {string} user - screen_name
 **/
function main(T, user) {
  // stream
  var stream = T.stream('user');

  constructStream(stream, user, T);
}
