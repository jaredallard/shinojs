/**
 * DirectMessage Object.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

const debug   = require('debug')('shinojs:dm')
const hb      = require('handlebars')
const helpers = require('./helpers.js')

const downloadImageInBase64 = helpers.downloadImageInBase64

class DirectMessage {
  /**
   * Create addons to the new DM object!
   *
   * @param  {Object} T  Twit object
   * @param  {Object} dm Direct Messages
   * @return {[type]}    [description]
   */
  constructor(T, dm) {
    this.T = T

    if(!dm) return; // not an instance

    /**
     * Reply to the dm, wrapping around dm method.
     *
     * @param   {String|Object} params  Text status, or object with text & image.
     * @example params = { text: 'hello world', image: 'image url', headers: {} }
     * @this    Shino
     * @returns {Promise}               T.post promise
     **/
    dm.reply = params => {
      // classic reply type, convert to object.
      if(typeof params !== 'object') params = {
        status: params
      }

      params.to = {
        id:          dm.sender.id_str,
        screen_name: dm.sender.screen_name,
        name:        dm.sender.name
      }

      return this.sendDM(params)
    }

    return dm;
  }

  /**
   * Post a DM with media support.
   *
   * @param  {Object}  params   Object: image url, image headers, replies, etc.
   * @example String: 'hello world'
   * @example Object:
   * {
   *  image: 'image url',
   *  headers: {
   *    'User-Agent': 'some cool user agent'
   *  },
   *  to: {
   *    id: 'id'
   *  }
   * }
   * @return {Promise}                 T.post
   */
  async sendDM(params)  {
    debug('dm:create', 'sending a Dm')
    // check if object, or if it even needs image processing
    const tweetParams = {
      type: 'message_create',
      message_create: {

        // dm message data
        message_data: {
          text: params // default to text
        },

        // user we send too
        target: {
          recipient_id: params.to.id
        }
      }
    }

    // if object, hit the status button!!!
    if(typeof params === 'object') tweetParams.message_create.message_data.text = params.text || params.status

    // add image to tweet.
    if(params.image) {
      // download image in base64 format
      debug('dm:create', 'downloading image')
      const image_base64 = await downloadImageInBase64(params.image, params.headers)

      // upload to twitter
      const res  = await this.T.post('media/upload', { media_data: image_base64 })

      debug('dm:create', 'uploadImage', res.data)

      // DM attachment API
      tweetParams.message_create.message_data.attachment = {
        type: 'media',
        media: {
          id: res.data.media_id_string
        }
      }
    }

    tweetParams.message_create.message_data.text = hb.compile(tweetParams.message_create.message_data.text)({
      screen_name: params.to.name
    })

    // post status
    debug('dm:create', 'posting dm', tweetParams)
    debug('dm:create', 'attachment', tweetParams.message_create.message_data.attachment)
    return this.T.post('direct_messages/events/new', { event: tweetParams })
  }
}

module.exports = DirectMessage
