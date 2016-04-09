/**
 * shinojs - a simple twitter bot framework
 *
 * @license MIT
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1.0.0
 **/

'use strict';

const events  = require('./lib/events.js'),
      Shinojs = require('./lib/shino.js'),
      path    = require('path'),
      twit    = require('twit');

let config;
try {
  let cfl = path.join(process.cwd(), 'config.json');
  config = require(cfl);
} catch(e) {
  console.error('Failed to read config.json');
  process.exit(1);
}

if(config.access_token === '') {
  console.error('Config is invalid');
  process.exit(1);
}

let shinojs = new Shinojs(twit, events, {
  ck: config.consumer_key,
  cs: config.consumer_secret,
  at: config.access_token,
  ats: config.access_token_secret
});

return shinojs.init();
