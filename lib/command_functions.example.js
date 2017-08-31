/**
 * Stores functions to be accessed by commands.json
 *
 * <insert MIT license here>
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 0.1.0
 **/

'use strict';

const cf = {}

/**
 * Example of a easy hello world.
 *
 * @param {object} T - authenticated twit object
 * @param {object} tweet - twit.tweet object
 * @param {object} array - shinojs.rule object
 * @returns {undefined} no need
 **/
cf.hw = function(T, tweet) {
  tweet.reply('Hello, world!');
}

module.exports = cf;
