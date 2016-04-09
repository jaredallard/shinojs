/**
 * Main Class
 **/

'use strict';

const fs   = require('fs'),
      path = require('path');

module.exports = class Shino {
  constructor(Twit, events, opts) {
    let getCommit = () => {
      let commit = 'NOT-GIT';
      if(fs.existsSync('.git/refs/heads/master')) {
        commit = fs.readFileSync('.git/refs/heads/master', 'utf8').substr(0, 7);
      }

      return commit;
    }

    let cpackage;
    try {
      let pl = path.join(process.cwd(), 'package.json');
      cpackage = require(pl);
    } catch(e) {
      console.error(e);
      process.exit(1);
    }

    this.T = new Twit({
      consumer_key: opts.ck,
      consumer_secret: opts.cs,
      access_token: opts.at,
      access_token_secret: opts.ats
    });

    this.version = cpackage.version;
    this.commit  = getCommit();
    this.name    = cpackage.name;
    this.events  = events;

    // DEPRECATED
    global.version = this.version;
    global.name    = this.name;
    global.commit  = this.commit;
  }

  /**
   * Init the bot framework
   *
   * @returns {undefined} nothing
   **/
  init() {
    const self   = this;
    const events = this.events;

    console.log('(c) 2016 Jared Allard');
    console.log(this.name, 'v:', this.version, 'c:', this.commit);

    this.T.get('account/verify_credentials', (err, data) => {
      if(err) {
        throw err;
      }

      if(data.screen_name === undefined) {
        throw 'data.screen_name undefined, bad credentials?';
      }

      console.log('pre-init auth check succedded.')
      console.log('screen_name:', data.screen_name);

      events.init(this.T, data.screen_name, () => {
        self.main(this.T, data.screen_name);
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
  tweetAddon(tweet, T) {
    /**
     * Reply to a tweet
     *
     * @param {string} text - status to send. Automatically adds username at front.
     * @param {Function} cb - callback
     *
     * @return {object} err - returns err on error.
     **/
    tweet.reply = (text, cb) => {
        T.post('statuses/update', {
          status: '@'+tweet.user.screen_name+' '+text,
          in_reply_to_status_id: tweet.id_str
        }, (err) => {
          if(!cb) cb = () => {};
          return cb(err);
        });
    }

    /**
     * Favourite a tweet
     *
     * @param {Function} cb - callback
     * @return {object}  returns err on error.
     **/
    tweet.favorite = (cb) => {
      T.post('favorites/create', {
        id: tweet.id_str
      }, (err) => {
        if(!cb) cb = () => {};
        return cb(err);
      })
    }

    /**
     * Retweet a tweet
     *
     * @param {Function} cb - callback
     * @return {object} err - returns err on error.
     **/
    tweet.retweet = function(cb) {
      T.post('statuses/retweet/:id', {
        id: tweet.id_str
      }, (err) => {
        if(!cb) cb = () => {};
        return cb(err);
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
  constructStream(stream, user, T) {
    const events = this.events;

    let streamUrl = stream.reqOpts.url.match(/([a-z]+\/?[a-z]+)\.json/i)[0],
        streamType = 'user';

    console.log('Subscribing to stream:', streamUrl);

    if(streamUrl.match('statuses')) { // probably a public stream
      streamType = 'public';
    }

    stream.on('connect', req => {
      events.connect(req, T);
    });

    stream.on('connected', res => {
      events.connected(res, T);
    });

    stream.on('tweet', tweet => {
      let streamName  = streamType;
      let screen_name = tweet.user.screen_name;
      let at_name     = '@'+user;
      tweet           = this.tweetAddon(tweet, T); // construct the tweet addons

      if(screen_name === user) { // drop tweets from us.
        return;
      }

      // check if it's @ us, and if it is that it's not a RT.
      if(tweet.text.match(at_name) && !tweet.retweeted_status) {
        return events.mention(tweet, T);
      }

      // we don't listen for mentions on pub
      if(streamType === 'user') {
        streamName = 'home'
      }

      events.tweet(tweet, T, streamName); // call tweet event.
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
   *
   * @returns {Twit.stream} twit stream object
   **/
  main(T, user) {
    let cmd_json;
    try {
      let col = path.join(process.cwd(), 'commands.json');

      cmd_json = require(col);
    } catch(e) {
      console.error(e);
      process.exit(1);
    }

    let stream;
    if(cmd_json.streams.indexOf('home') !== -1 || cmd_json.streams.indexOf('home') !== -1) {
      stream = T.stream('user');
    }

    if(cmd_json.streams.indexOf('public') !== -1) {
      if(cmd_json.public_opts === undefined) {
        console.error('commands.public_opts is undefined while on puc stream');
        process.exit(1);
      }

      stream = T.stream('statuses/'+cmd_json.public_opts.endpoint, cmd_json.public_opts.opts);
    }

    // construct the stream
    return this.constructStream(stream, user, T);
  }

}
