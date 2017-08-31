/**
 * Shino.js - Open Source Twitter Bot Framework
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 2.0.0
 */

'use strict';

const fs      = require('fs')
const path    = require('path')
const request = require('request-promise-native')
const debug   = require('debug')('shinojs')

class Shino {
  constructor(Twit, events, opts) {
    let getCommit = () => {
      let commit = '';
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

    // TODO REMOVE
    global.version = this.version
    global.commit  = this.commit
    global.name    = this.name

    // T addons, needs better object support...
    this.T.tweet                 = this.tweet
    this.T.T                     = this.T
    this.T.downloadImageInBase64 = this.downloadImageInBase64
  }

  /**
   * Init the bot framework
   *
   * @returns {undefined} nothing
   **/
  init() {
    const self   = this;
    const events = this.events;

    console.log(this.name, 'v:', this.version, 'commit:', this.commit);

    this.T.get('account/verify_credentials', (err, data) => {
      if(err) throw err

      if(!data.screen_name) throw 'data.screen_name undefined, bad credentials?';

      console.log('pre-init auth check succedded.')
      console.log('screen_name:', data.screen_name);

      events.init(this.T, data.screen_name, () => {
        self.main(this.T, data.screen_name);
      });
    });
  }

  /**
   * Download a image in base64, for Twitter.
   * @param {String} url           Image to download.
   * @param {Object} [headers={}]  Headers to include with request.
   * @return {Promise}             base64 encoded image on .then
   */
  async downloadImageInBase64(url, headers) {
    const image_download_raw = await request({
      uri: url,
      encoding: null,
      headers: headers
    })
    const image_base64 = image_download_raw.toString('base64')
    return image_base64
  }

  /**
   * Post a tweet with media support.
   * @param  {String|Object}  params   String: Text, Object: image url, image headers, replies, etc.
   * @example String: 'hello world'
   * @example Object:
   * {
   *  image: 'image url',
   *  headers: {
   *    'User-Agent': 'some cool user agent'
   *  },
   *  reply: {
   *    id: 'tweet id',
   *    name: 'screename' (NOT AT)
   *  }
   * }
   * @return {Promise}                 T.post
   */
  async tweet(params)  {
    // check if object, or if it even needs image processing
    const tweetParams = {
      status: params     // default to params value, if text?
    }

    // if object, hit the status button!!!
    if(typeof params === 'object') tweetParams.status = params.text || params.status

    // add image to tweet.
    if(params.image) {
      // download image in base64 format
      const image_base64 = await this.downloadImageInBase64(params.image, params.headers)

      // upload to twitter
      const res  = await this.T.post('media/upload', { media_data: image_base64 })

      debug('tweet:create', 'uploadImage', res.data)

      tweetParams.media_ids = [res.data.media_id_string]
    }

    // reply support
    if(params.reply) {
      debug('tweet:create', 'setting type to reply')
      tweetParams.in_reply_to_status_id = params.reply.id
      tweetParams.status                = `@${params.reply.name} ${tweetParams.status}`
    }

    // post status
    debug('tweet:create', 'posting tweet', tweetParams)
    return this.T.post('statuses/update', tweetParams)
  }

  /**
   * Add to the twit.tweet object
   *
   * @param {object} tweet  - twit.tweet object
   * @param {object} T      - authenticated twit object
   * @note will be async/await soon.
   * @return {object} tweet - twit.tweet object with addons
   **/
  tweetAddon(tweet, T) {

    /**
     * Reply to the tweet, wrapping around this.tweet
     *
     * @param   {String|Object} params  Text status, or object with text & image.
     * @example params = { text: 'hello world', image: 'image url', headers: {} }
     * @this    Shino
     * @returns {Promise}               T.post promise
     **/
    tweet.reply = async params => {
      // classic reply type, convert to object.
      if(typeof params !== 'object') params = {
        status: params
      }

      params.reply   = {
        id: tweet.id_str,
        name: tweet.user.screen_name
      }

      return this.tweet(params)
    }

    /**
     * Favourite the tweet
     *
     * @param {Function} cb - callback
     * @returns {Promise} T.post promise
     **/
    tweet.favorite = () => {
      return T.post('favorites/create', {
        id: tweet.id_str
      })
    }

    /**
     * Retweet the tweet.
     *
     * @returns {Promise} T.post promise
     **/
    tweet.retweet = () => {
      return T.post('statuses/retweet/:id', {
        id: tweet.id_str
      });
    }

    return tweet;
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

    let streamType = 'user';

    console.log('Subscribing to stream:', streamUrl);

    if(streamUrl.match('statuses')) { // probably a public stream
      streamType = 'public';
    }

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

      let streamName  = streamType;
      let screen_name = tweet.user.screen_name;
      let at_name     = `@${user}`;
      tweet           = this.tweetAddon(tweet, T); // construct the tweet addons

      // don't include tweets by us
      if(screen_name === user) return

      // check if it's @ us, if it is, that it's not a RT.
      if(tweet.text.match(at_name) && !tweet.retweeted_status) return events.mention(tweet, T);

      // we don't listen for mentions on pub
      if(streamType === 'user') streamName = 'home'

      // call tweet event, for publics
      events.tweet(tweet, T, streamName);
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
    let col    = path.join(process.cwd(), 'commands.json');
    let stream = null;

    const cmd_json = require(col);

    // create user stream
    if(cmd_json.streams.indexOf('home') !== -1) {
      stream = T.stream('user');
    }

    if(cmd_json.streams.indexOf('public') !== -1) {

      // we need opts for public streams
      if(!cmd_json.public_opts) {
        console.error('commands.public_opts is undefined while on public stream');
        process.exit(1);
      }

      // stream endpoint
      stream = T.stream(`statuses/${cmd_json.public_opts.endpoint}`, cmd_json.public_opts.opts);
    }

    // construct the stream
    return this.constructStream(stream, user, T);
  }

}

module.exports = Shino
