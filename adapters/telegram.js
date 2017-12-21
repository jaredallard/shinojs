/**
 * Implements Twitter in an Adapter
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1
 * @license MIT
 */

const EventEmitter = require('events').EventEmitter;
const Telegram     = require('node-telegram-bot-api')
const debug        = require('debug')('shinojs:adapter:telegram')
const _            = require('lodash')

/**
 * Implements a private message, i.e Direct Message, IM, Text, whatever.
 *
 * @class Message
 */
class Message {
  constructor(message, bot) {

    const sender     = message.from;

    const senderObject = {
      identifier: sender.id,
      username: sender.username || sender.first_name,
      display_name: sender.first_name,
      bio: null,
      profile_image: null
    }

    this.bot = bot

    this.from       = senderObject
    this.text       = message.text
    this.identifier = message.message_id
    this.at         = message.date

    this.original   = () => {
      debug('warning', 'this is a service specific field that likely won\'t work with other services')
      return message
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
    let message = params
    if(typeof params === 'object') message = params.text

    debug('message:create', 'sending message')

    this.bot.sendMessage(params.to.identifier, message)

    return {}
  }
}

/**
 * Implements a public facing message, i.e Tweet, or Status.
 *
 * @class Public
 */
class Public extends Message {
  constructor(message, bot) {
    super(message, bot)
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

    this.telegram = null
    this.auth     = () => auth; // prevent leaking into console
  }

  /**
   * Connects to your service (Twitter).
   * This will be called first by shinojs
   *
   * @param  {Object} auth    Auth Object
   * @return {Undefined}      Returns nothing
   */
  async connect() {
    const bot = this.telegram = new Telegram(this.auth(), {
      polling: true
    })

    bot.on('message', message => {
      debug('message', message)

      const from   = message.from
      const chat   = message.chat
      const chatId = chat.id

      if(!message.text) return; // we don't care about non messages
      if(chat.type === 'group') {
        return this.emit('public', new Public(message, bot))
      }

      if(chat.type === 'private') {
        return this.emit('message', new Message(message, bot))
      }
    })
  }

  /**
   * Return our username / screenname.
   * This is so shinojs can filter messages from ourself, if it needs that
   *
   * @return {String} Our username
   */
  identity() {
    return null
  }
}

module.exports = {
  version: 1,
  Adapter: Adapter
}
