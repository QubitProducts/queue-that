var _ = require('underscore')
var createLocalStorageAdapter = require('./local-storage-adapter')

var QUEUE_POLL_INTERVAL = 100
var ACTIVE_QUEUE_EXPIRE_TIME = 3000
var DEFAULT_BATCH_SIZE = 20
var INITIAL_BACKOFF_TIME = 1000
var BACKOFF_POLL_INTERVAL = 1000

module.exports = createQueueThat

function createQueueThat (options) {
  if (!options.process) {
    throw new Error('a process function is required')
  }
  options.batchSize = options.batchSize || DEFAULT_BATCH_SIZE

  var storageAdapter = createLocalStorageAdapter()
  var queueId = Math.random() + now()
  var processInterval, backoffInterval, queueIsSending = false

  queueThat.destroy = function destroy () {
    clearInterval(processInterval)
    clearInterval(backoffInterval)
  }

  return queueThat

  function queueThat (item) {
    var queue = storageAdapter.getQueue()
    queue.push(item)
    storageAdapter.setQueue(queue)

    /**
     * Wait some time in case this is the only tab
     * and the the previous page's queue may not have
     * expired yet.
     */
    setTimeout(function () {
      if (activeQueueRunning()) {
        log('Item(s) sent to active queue')
        return
      }

      log('Switching to queue', queueId)
      clearInterval(processInterval)
      resumeBackoff()
      storageAdapter.setActiveQueue(queueId)
      processInterval = setInterval(processQueue, QUEUE_POLL_INTERVAL)
    }, ACTIVE_QUEUE_EXPIRE_TIME)
  }

  function processQueue () {
    storageAdapter.setActiveQueue(queueId)

    if (queueIsSending) {
      return
    }
    if (storageAdapter.getBackoffTime() > 0) {
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
    storageAdapter.setBackoffTime(INITIAL_BACKOFF_TIME * Math.pow(2, errorCount - 1))
    resumeBackoff()
  }

  function resumeBackoff () {
    if (storageAdapter.getBackoffTime() <= 0) {
      return
    }

    backoffInterval = setInterval(countBackoff, BACKOFF_POLL_INTERVAL)

    log('in backoff')
    log('backoff time:', storageAdapter.getBackoffTime())

    function countBackoff () {
      log('check backoff')
      storageAdapter.setBackoffTime(storageAdapter.getBackoffTime() - BACKOFF_POLL_INTERVAL)
      if (storageAdapter.getBackoffTime() <= 0) {
        log('backoff off')
        clearInterval(backoffInterval)
      }
    }
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
    if (options.log === true) {
      console.log.apply(console,
        ['Queue That:'].concat(_.toArray(arguments)))
    }
  }

  function now () {
    return (new Date()).getTime()
  }
}
