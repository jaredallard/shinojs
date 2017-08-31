/**
 * Stores functions to be accessed by commands.json
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 2.0.0
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
cf.hw = async (T, tweet) => {
  await tweet.reply('Hello, world!');
}

module.exports = cf;
