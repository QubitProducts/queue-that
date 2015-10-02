var json = require('json-bourne')

var QUEUE_KEY = 'qb_queue'
var ACTIVE_QUEUE_KEY = 'qb_active_queue'
var BACKOFF_TIME_KEY = 'qb_backoff_time'
var ERROR_COUNT_KEY = 'qb_error_count'

module.exports = createLocalStorageAdapter

function createLocalStorageAdapter () {
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
    return json.parse(load(QUEUE_KEY) || '[]')
  }

  function setQueue (queue) {
    save(QUEUE_KEY, json.stringify(queue))
  }

  function getErrorCount () {
    var count = load(ERROR_COUNT_KEY)
    return count === undefined ? 0 : Number(count)
  }

  function getBackoffTime () {
    var time = load(BACKOFF_TIME_KEY)
    return time === undefined ? 0 : Number(time)
  }

  function setErrorCount (n) {
    save(ERROR_COUNT_KEY, n)
  }

  function setBackoffTime (n) {
    save(BACKOFF_TIME_KEY, n)
  }

  function getActiveQueue () {
    if (load(ACTIVE_QUEUE_KEY) === undefined) {
      return
    }
    return json.parse(load(ACTIVE_QUEUE_KEY))
  }

  function setActiveQueue (id) {
    save(ACTIVE_QUEUE_KEY, json.stringify({
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
