var json = require('json-bourne')

var QUEUE_KEY = '* - Queue'
var ACTIVE_QUEUE_KEY = '* - Active Queue'
var BACKOFF_TIME_KEY = '* - Backoff Time'
var ERROR_COUNT_KEY = '* - Error Count'

module.exports = createLocalStorageAdapter

function createLocalStorageAdapter (queueName) {
  var queueKey = QUEUE_KEY.replace('*', queueName)
  var activeQueueKey = ACTIVE_QUEUE_KEY.replace('*', queueName)
  var backoffTimeKey = BACKOFF_TIME_KEY.replace('*', queueName)
  var errorCountKey = ERROR_COUNT_KEY.replace('*', queueName)

  var localStorageAdapter = {
    getQueue: getQueue,
    setQueue: setQueue,
    getErrorCount: getErrorCount,
    getBackoffTime: getBackoffTime,
    setErrorCount: setErrorCount,
    setBackoffTime: setBackoffTime,
    getActiveQueue: getActiveQueue,
    setActiveQueue: setActiveQueue
  }

  return localStorageAdapter

  function getQueue () {
    return json.parse(load(queueKey) || '[]')
  }

  function setQueue (queue) {
    save(queueKey, json.stringify(queue))
  }

  function getErrorCount () {
    var count = load(errorCountKey)
    return count === undefined ? 0 : Number(count)
  }

  function getBackoffTime () {
    var time = load(backoffTimeKey)
    return time === undefined ? 0 : Number(time)
  }

  function setErrorCount (n) {
    save(errorCountKey, n)
  }

  function setBackoffTime (n) {
    save(backoffTimeKey, n)
  }

  function getActiveQueue () {
    if (load(activeQueueKey) === undefined) {
      return
    }
    return json.parse(load(activeQueueKey))
  }

  function setActiveQueue (id) {
    save(activeQueueKey, json.stringify({
      id: id,
      ts: now()
    }))
  }

  function save (key, data) {
    window.localStorage[key] = data
  }

  function load (key) {
    return window.localStorage[key]
  }

  function now () {
    return (new Date()).getTime()
  }
}
