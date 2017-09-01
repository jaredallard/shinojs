/**
 * Helper functions for Shino.js
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @license MIT
 * @version 1
 */

const request  = require('request-promise-native')

module.exports = {

  /**
   * Download a image in base64, for Twitter.
   * @param {String} url           Image to download.
   * @param {Object} [headers={}]  Headers to include with request.
   * @return {Promise}             base64 encoded image on .then
   */
  downloadImageInBase64: async (url, headers) => {
     const image_download_raw = await request({
       uri: url,
       encoding: null,
       headers: headers
     })
     const image_base64 = image_download_raw.toString('base64')
     return image_base64
   }
}
