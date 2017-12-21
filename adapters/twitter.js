/**
 * Implements Twitter in an Adapter
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1
 * @license MIT
 */

const EventEmitter = require('events').EventEmitter;
const Twit         = require('twit')
const debug        = require('debug')('shinojs:adapter:twitter')
const _            = require('lodash')
const helpers      = require('../lib/helpers')

const downloadImageInBase64 = helpers.downloadImageInBase64

/**
 * Implements a public facing message, i.e Tweet, or Status.
 *
 * @class Public
 */
class Public {
  constructor(tweet, T) {
    this.T        = T
    this.original = tweet
  }
}

/**
 * Implements a private message, i.e Direct Message, IM, Text, whatever.
 */
class Message {
  constructor(message, T) {
    //debug('create:message', message)

    this.T   = T

    const dm = message.direct_message

    const sender     = dm.sender;

    const senderObject = {
      identifier: sender.id_str,
      username: sender.screen_name,
      display_name: sender.name,
      bio: sender.description,
      profile_image: sender.profile_image_url_https
    }

    this.from       = senderObject
    this.text       = dm.text
    this.identifier = dm.id_str
    this.at         = dm.created_at

    this.original   = () => {
      debug('warning', 'this is a service specific field that likely won\'t work with other services')
      return dm
    }
  }

  /**
   * Get a service specific field from the original object.
   *
   * @param  {String} field  name of the property, i.e sender.location
   * @return {*}             Value
   */
  getSpecific(field) {
    return _.get(this.original(), field)
  }

  async reply(params) {
    // classic reply type, convert to object.
    if(typeof params !== 'object') params = {
      text: params
    }

    params.to = {
      identifier:          this.from.identifier
    }

    debug('reply', params.to)

    return this.send(params)
  }

  async send(params) {
    debug('dm:create', 'sending DM')

    if(!params.to.identifier) throw new Error(`Expected user id, got '${params.to.identifier}'`)

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
          recipient_id: params.to.identifier
        }
      }
    }

    // if object, hit the status button!!!
    if(typeof params === 'object') tweetParams.message_create.message_data.text = params.text

    // add image to tweet.
    if(params.image) {
      // download image in base64 format
      debug('dm:create', 'downloading image')
      const image_base64 = await downloadImageInBase64(params.image, params.headers)

      // upload to twitter
      const res  = await this.T.post('media/upload', {
        media_data: image_base64
      })

      debug('dm:create', 'uploadImage', res.data)

      // DM attachment API
      tweetParams.message_create.message_data.attachment = {
        type: 'media',
        media: {
          id: res.data.media_id_string
        }
      }
    }

    // post status
    debug('dm:create', 'posting dm', tweetParams)
    debug('dm:create', 'attachment', tweetParams.message_create.message_data.attachment)
    this.T.post('direct_messages/events/new', { event: tweetParams })

    return {}
  }
}

/**
 * Ties together implemented Message / Public methods, and constructs
 * whatever method of polling is needed.
 *
 * @class Adapter
 */
class Adapter extends EventEmitter {
  constructor(auth) {
    super()

    // create Twit instance.
    this.T = new Twit({
      consumer_key: auth.consumer_key,
      consumer_secret: auth.consumer_secret,
      access_token: auth.access_token,
      access_token_secret: auth.access_token_secret
    });
  }

  /**
   * Connects to your service (Twitter).
   * This will be called first by shinojs
   *
   * @param  {Object} auth    Auth Object
   * @return {Undefined}      Returns nothing
   */
  async connect() {
    const res  = await this.T.get('account/verify_credentials')
    const data = res.data;

    this.username = data.screen_name

    debug('auth:err', this.username ? null : data)
    debug('username', this.username)

    if(!this.username) throw new Error('Failed to authenticate with Twitter.')

    const stream = this.T.stream('user');

    this.constructStream(stream);
  }

  /**
   * Construct a stream object for events.js
   *
   * @param   {Object} stream    twit.stream object
   * @param   {String} user      accounts "atname" aka @<whatever>
   * @param   {Object} T         authenticated twit object
   * @returns {Object}           constructed stream object.
   **/
  constructStream(stream) {
    const streamUrl = stream.reqOpts.url.match(/([a-z]+\/?[a-z]+)\.json/i)[0]
    debug('stream', 'connected to', streamUrl)

    // Forward events.
    stream.on('connect', res => { this.emit('connect', res) });
    stream.on('disconnect', res => { this.emit('disconnect', res) });
    stream.on('connected', res => { this.emit('connected', res) });

    stream.on('tweet', tweet => {
      debug('tweet', 'emitted')
      this.emit('public', new Public(tweet, this.T))
    });

    stream.on('direct_message', dm => {
      debug('direct_message', 'emitted')
      this.emit('message', new Message(dm, this.T))
    })
  }

  /**
   * Return our username / screenname.
   * This is so shinojs can filter messages from ourself.
   *
   * @return {String} Our username
   */
  identity() {
    return this.username
  }
}

module.exports = {
  version: 1,
  Adapter: Adapter
}
