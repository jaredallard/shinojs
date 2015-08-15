/**
 * Stores functions to be accessed by commands.json
 *
 * <insert MIT license here>
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 0.1.0
 **/

var gi   = require('google-images'),
    base64 = require('node-base64-image');

var cf = {}

function uploadImage(T, tweet) {
  var rn = Math.floor(Math.random() * 50) + 1
  gi.search('Asada Shino', {
    page: rn,
    callback: function(err, imgs) {
      if(err) {
        console.log(err);
        return false;
      }

      var options = {string: true}

      // get a random image in the returned object.
      rn = Math.floor(Math.random() * imgs.length) + 0
      base64.base64encoder(imgs[rn].url, options, function (err, image) {
        if (err) {
          console.log(err);
          return false;
        }

        T.post('media/upload', { media_data: image }, function (err, data, response) {
          if(err) {
            console.log(err);
            return false;
          }

          var mediaIdStr = data.media_id_string
          var params = {
            status: ' ',
            media_ids: [mediaIdStr],
          }

          if(tweet) { // on reply, aka getTweet function
            params.status = '@'+tweet.user.screen_name+' ';
            params.in_reply_to_status_id = tweet.id_str;
          }

          T.post('statuses/update', params, function (err, data, response) {
            if(err) {
              console.log(err);
              return false;
            }
          });
        });
      });
    }
  });
}

/**
 * example of a event functions
 *
 * @param {object} T - authenticated twit object
 * @return {boolean} success
 **/
cf.postImage = function(T) {
  uploadImage(T);
}

/**
 * Get the version / commit of the bot.
 *
 * @param {object} tweet - tweet object w/ .reply
 * @param {object} array - command object
 * @return {boolean} success
 **/
cf.getVersion = function(T, tweet, array) {
  var text = array.template({
    version: global.version,
    commit: global.commit
  });

  // reply with parsed data.
  tweet.reply(text);

  return true;
}

/**
 * Update the location to reflect our version
 *
 * @param {object} T - authenticated twit object
 **/
cf.updateLocation = function(T) {
  T.post('account/update_profile', {
    location: 'v'+global.version+"."+global.commit,
    skip_status: true
  }, function(err, data, response) {
    if(err) {
      console.log(err);
      return false;
    }
  });
}

/**
 * Get the version / commit of the bot.
 *
 * @param {object} tweet - tweet object w/ .reply
 * @param {object} array - command object
 * @return {boolean} success
 **/
 cf.getImage = function(T, tweet, array) {
   uploadImage(T, tweet);
 }

module.exports = cf;
