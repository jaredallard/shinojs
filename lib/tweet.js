/**
 * Create a Shino.js Tweet Object from Twit Tweet
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

const debug   = require('debug')('shinojs:tweet')
const helpers = require('./helpers.js')

const downloadImageInBase64 = helpers.downloadImageInBase64

class Tweet {
  /**
   * Add to the twit.tweet object
   *
   * @param {object} T      - authenticated twit object
   * @param {object} tweet  - twit.tweet object
   * @return {object} tweet - twit.tweet object with addons
   **/
  constructor(T, tweet) {
    this.T = T

    if(!tweet) return; // not an instance

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
      const image_base64 = await downloadImageInBase64(params.image, params.headers)

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
}
module.exports = Tweet;
