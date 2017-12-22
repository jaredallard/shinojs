/**
 * Handle all conent analysis.
 *
 * @author Jared Allard <jaredallard@outlook.com>
 * @version 1
 * @license MIT
 */

const Natural   = require('natural')
const Sentiment = require('sentiment')
const debug     = require('debug')('shinojs:analysis')

/**
 * Run content analysis on a text.
 *
 * @param  {Object}  classifier   Classifier to run
 * @param  {String}  content      Content to parse
 * @param  {String}  [context=''] Context to filter
 * @return {Object}               Analysis object
 */
const Analyze = (classifier, content, context = '') => {
  // machine learning stuff
  const classifierResult = classifier.run(content.text)
  const sentimentResult  = Sentiment(content.text)

  debug('run:classifiers', classifierResult)

  // filter out classifiers based on context, or root methods.
  const availableClassifiers   = classifierResult.filter(c => {
    const found = c.label.indexOf(`${context || ''}.`) === -1 ? false : true

    if(context) return found
    return found === false // invert, we're NOT looking for this
  })

  debug('run:classifications', availableClassifiers)
  debug('run:sentiment', sentimentResult)

  const analysis = {
    version: 1,
    nlp: {
      classifications: availableClassifiers,
      classified: availableClassifiers[0]
    },
    sentiment: sentimentResult
  }

  return analysis;
}


/**
 * Classifier
 *
 * @class Classifier
 */
class Classifier extends Natural.LogisticRegressionClassifier {
  constructor() {
    super()
  }

  add(sample = '', label) {
    this.addDocument(sample, label)
  }

  run(text) {
    return this.getClassifications(text)
  }
}

module.exports = {
  Classifier: Classifier,
  Analyze: Analyze
}
