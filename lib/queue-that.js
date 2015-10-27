var _ = require('underscore')
var createLocalStorageAdapter = require('./local-storage-adapter')

var DEFAULT_QUEUE_LABEL = 'Queue That'
var QUEUE_POLL_INTERVAL = 100
var ACTIVE_QUEUE_EXPIRE_TIME = 3000
var DEFAULT_BATCH_SIZE = 20
var INITIAL_BACKOFF_TIME = 1000

module.exports = createQueueThat

function createQueueThat (options) {
  if (!options.process) {
    throw new Error('a process function is required')
  }
  options.batchSize = options.batchSize || DEFAULT_BATCH_SIZE
  options.label = options.label || DEFAULT_QUEUE_LABEL

  var storageAdapter = createLocalStorageAdapter(options.label)
  var queueId = Math.random() + now()
  var processInterval, queueIsSending = false

  /**
   * Check after ACTIVE_QUEUE_EXPIRE_TIME in case
   * the previous page's queue has not expired yet.
   */
  var initialCheckTimer = setTimeout(function () {
    if (!activeQueueRunning()) {
      switchActiveQueue(queueId)
    }
  }, ACTIVE_QUEUE_EXPIRE_TIME)

  queueThat.destroy = function destroy () {
    clearInterval(processInterval)
    clearTimeout(initialCheckTimer)
  }

  return queueThat

  function queueThat (item) {
    var queue = storageAdapter.getQueue()
    queue.push(item)
    storageAdapter.setQueue(queue)

    if (activeQueueRunning()) {
      log('Item(s) sent to active queue')
      return
    }
    switchActiveQueue(queueId)
  }

  function switchActiveQueue (queueId) {
    log('Switching to queue', queueId)
    clearInterval(processInterval)
    storageAdapter.setActiveQueue(queueId)
    processInterval = setInterval(processQueue, QUEUE_POLL_INTERVAL)
  }

  function processQueue () {
    storageAdapter.setActiveQueue(queueId)

    if (queueIsSending) {
      return
    }
    if (storageAdapter.getBackoffTime() > now()) {
      return
    }

    var batch = storageAdapter.getQueue().slice(0, options.batchSize)
    if (batch.length === 0) {
      return
    }

    log('Processing queue batch', batch)
    var itemsProcessing = batch.length
    queueIsSending = true
    options.process(batch, function (err) {
      queueIsSending = false
      if (err) {
        processError(err)
        return
      }
      storageAdapter.setErrorCount(0)
      var queue = _.rest(storageAdapter.getQueue(), itemsProcessing)
      storageAdapter.setQueue(queue)
      log('Queue processed, remaining items', queue)
    })
  }

  function processError (err) {
    log(err)
    var errorCount = storageAdapter.getErrorCount() + 1
    storageAdapter.setErrorCount(errorCount)
    storageAdapter.setBackoffTime(now() + INITIAL_BACKOFF_TIME * Math.pow(2, errorCount - 1))
    log('backoff time:', storageAdapter.getBackoffTime() - now())
  }

  function activeQueueRunning () {
    var activePageDetails = storageAdapter.getActiveQueue()
    if (activePageDetails === undefined) {
      return false
    }
    var timeSincePoll = now() - activePageDetails.ts
    return !(timeSincePoll >= ACTIVE_QUEUE_EXPIRE_TIME)
  }

  function log () {
    var logLabel = '*:'.replace('*', options.label)
    if (options.log === true) {
      console.log.apply(console,
        [logLabel].concat(_.toArray(arguments)))
    }
  }

  function now () {
    return (new Date()).getTime()
  }
}
