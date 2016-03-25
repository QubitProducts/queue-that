var _ = require('underscore')

createLog.levels = ['info', 'warn', 'error', 'silent']
module.exports = createLog

function createLog (label, maxlevel) {
  maxlevel = maxlevel || 'silent'
  var logLabel = label + ':'
  var log = { level: maxlevel }
  var logLevels = createLog.levels
  var availableLevels = _.without(logLevels, 'silent')

  _.each(availableLevels, function (level) {
    log[level] = function () {
      if (_.indexOf(logLevels, level) >= _.indexOf(logLevels, log.level)) {
        console[level]([logLabel].concat(_.toArray(arguments)).join(' '))
      }
    }
  })
  return log
}
