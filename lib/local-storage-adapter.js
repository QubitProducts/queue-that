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

  var adapter = {
    getQueue: getQueue,
    setQueue: setQueue,
    getErrorCount: getErrorCount,
    getBackoffTime: getBackoffTime,
    setErrorCount: setErrorCount,
    setBackoffTime: setBackoffTime,
    getActiveQueue: getActiveQueue,
    setActiveQueue: setActiveQueue,
    save: save,
    load: load,
    works: works,
    reset: reset,
    remove: remove,
    type: 'localStorage'
  }

  return adapter

  function getQueue () {
    return json.parse(adapter.load(queueKey) || '[]')
  }

  function setQueue (queue) {
    adapter.save(queueKey, json.stringify(queue))
  }

  function getErrorCount () {
    var count = adapter.load(errorCountKey)
    return count === undefined ? 0 : Number(count)
  }

  function getBackoffTime () {
    var time = adapter.load(backoffTimeKey)
    return time === undefined ? 0 : Number(time)
  }

  function setErrorCount (n) {
    adapter.save(errorCountKey, n)
  }

  function setBackoffTime (n) {
    adapter.save(backoffTimeKey, n)
  }

  function getActiveQueue () {
    if (adapter.load(activeQueueKey) === undefined) {
      return
    }
    return json.parse(adapter.load(activeQueueKey))
  }

  function setActiveQueue (id) {
    adapter.save(activeQueueKey, json.stringify({
      id: id,
      ts: now()
    }))
  }

  function works () {
    var works
    try {
      adapter.save('queue-that-works', 'anything')
    } catch (e) {}
    works = adapter.load('queue-that-works') === 'anything'
    adapter.remove('queue-that-works')
    return works
  }

  function reset () {
    adapter.remove(activeQueueKey)
    adapter.remove(backoffTimeKey)
    adapter.remove(errorCountKey)
    adapter.remove(queueKey)
  }

  function save (key, data) {
    window.localStorage[key] = data
  }

  function load (key) {
    return window.localStorage[key]
  }

  function remove (key) {
    delete window.localStorage[key]
  }

  function now () {
    return (new Date()).getTime()
  }
}
