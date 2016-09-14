var json = require('json-bourne')

var QUEUE_KEY = '* - Queue'
var ACTIVE_QUEUE_KEY = '* - Active Queue'
var BACKOFF_TIME_KEY = '* - Backoff Time'
var ERROR_COUNT_KEY = '* - Error Count'
var QUEUE_PROCESSING_KEY = '* - Queue Processing'

module.exports = createLocalStorageAdapter

function createLocalStorageAdapter (queueName) {
  var queueKey = QUEUE_KEY.replace('*', queueName)
  var activeQueueKey = ACTIVE_QUEUE_KEY.replace('*', queueName)
  var backoffTimeKey = BACKOFF_TIME_KEY.replace('*', queueName)
  var errorCountKey = ERROR_COUNT_KEY.replace('*', queueName)
  var queueProcessingKey = QUEUE_PROCESSING_KEY.replace('*', queueName)

  var dirtyCache = true
  var setPending = false
  var queueCache = []

  var adapter = {
    getQueue: getQueue,
    setQueue: setQueue,
    getErrorCount: getErrorCount,
    getBackoffTime: getBackoffTime,
    setErrorCount: setErrorCount,
    setBackoffTime: setBackoffTime,
    getActiveQueue: getActiveQueue,
    setActiveQueue: setActiveQueue,
    clearActiveQueue: clearActiveQueue,
    getQueueProcessing: getQueueProcessing,
    setQueueProcessing: setQueueProcessing,
    save: save,
    load: load,
    works: works,
    reset: reset,
    remove: remove,
    type: 'localStorage',
    flush: flush
  }

  return adapter

  function flush () {
    dirtyCache = true
    if (setPending) {
      adapter.save(queueKey, json.stringify(queueCache))
      setPending = false
    }
  }

  function getQueue () {
    if (dirtyCache) {
      queueCache = json.parse(adapter.load(queueKey) || '[]')
      dirtyCache = false
      setTimeout(flush, 0)
    }
    return queueCache
  }

  function setQueue (queue) {
    queueCache = queue
    dirtyCache = false
    setPending = true
    setTimeout(flush, 0)
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

  function clearActiveQueue () {
    adapter.remove(activeQueueKey)
  }

  function getQueueProcessing () {
    return Boolean(Number(adapter.load(queueProcessingKey)))
  }

  function setQueueProcessing (isProcessing) {
    adapter.save(queueProcessingKey, Number(isProcessing))
  }

  function works () {
    var works = false
    try {
      adapter.save('queue-that-works', 'anything')
      works = adapter.load('queue-that-works') === 'anything'
      adapter.remove('queue-that-works')
    } catch (e) {}
    return works
  }

  function reset () {
    adapter.remove(activeQueueKey)
    adapter.remove(backoffTimeKey)
    adapter.remove(errorCountKey)
    adapter.remove(queueKey)
    adapter.remove(queueProcessingKey)
  }
}

function save (key, data) {
  window.localStorage[key] = data
}

function load (key) {
  return window.localStorage[key]
}

function remove (key) {
  window.localStorage.removeItem(key)
}

function now () {
  return (new Date()).getTime()
}
