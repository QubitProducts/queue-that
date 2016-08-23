var _ = require('underscore')

var log = require('./log')
var createLocalStorageAdapter = require('./local-storage-adapter')
var createGlobalVariableAdapter = require('./global-variable-adapter')

var DEFAULT_QUEUE_LABEL = 'Queue That'
var QUEUE_POLL_INTERVAL = 100
var ACTIVE_QUEUE_EXPIRE_TIME = 1500
var DEFAULT_BATCH_SIZE = 20
var BACKOFF_TIME = 1000

module.exports = createQueueThat

function createQueueThat (options) {
  if (!options.process) {
    throw new Error('a process function is required')
  }
  options.batchSize = options.batchSize || DEFAULT_BATCH_SIZE
  options.label = options.label || DEFAULT_QUEUE_LABEL
  options.trim = options.trim || _.identity
  options.queuePollInterval = options.queuePollInterval || QUEUE_POLL_INTERVAL
  options.backoffTime = options.backoffTime || BACKOFF_TIME

  var processInterval
  var queueIsProcessing = false
  var queueId = Math.random() + now()

  var storageAdapter = createLocalStorageAdapter(options.label)
  if (!storageAdapter.works()) {
    storageAdapter = createGlobalVariableAdapter(options.label)
  }

  /**
   * Check after ACTIVE_QUEUE_EXPIRE_TIME in case
   * the previous page's queue has not expired yet.
   */
  var initialCheckTimer = setTimeout(function () {
    if (!activeQueueRunning()) {
      switchActiveQueue(queueId)
    }
  }, ACTIVE_QUEUE_EXPIRE_TIME)

  queueThat.storageAdapter = storageAdapter
  queueThat.options = options
  queueThat.destroy = function destroy () {
    clearInterval(processInterval)
    clearTimeout(initialCheckTimer)
  }
  queueThat.flushQueueCache = queueThat.storageAdapter.flush
  deactivateOnUnload(queueId)

  log.info('Initialized with queue ID ' + queueId)
  return queueThat

  function queueThat (item) {
    var queue = storageAdapter.getQueue()
    queue.push(item)
    storageAdapter.setQueue(options.trim(queue))

    log.info('Item queued')

    if (!activeQueueRunning()) switchActiveQueue(queueId)
  }

  function switchActiveQueue (queueId) {
    log.info('Switching active queue to ' + queueId + ' (this instance)')
    clearInterval(processInterval)
    storageAdapter.setActiveQueue(queueId)
    processInterval = setInterval(processQueue, options.queuePollInterval)
  }

  function processQueue () {
    storageAdapter.setActiveQueue(queueId)

    if (queueIsProcessing) {
      return
    }
    if (storageAdapter.getBackoffTime() > now()) {
      return
    }

    var batch = storageAdapter.getQueue().slice(0, options.batchSize)
    if (batch.length === 0) {
      return
    }

    batch.containsRepeatedItems = storageAdapter.getQueueProcessing()

    log.info('Processing queue batch of ' + batch.length + ' items')

    if (batch.containsRepeatedItems) log.info('Batch contains repeated items')
    else log.info('Batch does not contain repeated items')

    var itemsProcessing = batch.length
    queueIsProcessing = true

    options.process(batch, function (err) {
      queueIsProcessing = false
      if (err) {
        processError(err)
        return
      }
      storageAdapter.setErrorCount(0)
      var queue = _.rest(storageAdapter.getQueue(), itemsProcessing)
      storageAdapter.setQueue(queue)

      storageAdapter.setQueueProcessing(false)
      storageAdapter.flush()

      log.info('Queue processed, ' + queue.length + ' remaining items')
    })

    storageAdapter.setQueueProcessing(true)
    storageAdapter.flush()
  }

  function processError (err) {
    log.error('Process error, backing off (' + err.message + ')')
    var errorCount = storageAdapter.getErrorCount() + 1
    storageAdapter.setErrorCount(errorCount)
    storageAdapter.setBackoffTime(now() + options.backoffTime * Math.pow(2, errorCount - 1))
    log.warn('backoff time ' + (storageAdapter.getBackoffTime() - now()) + 'ms')
  }

  function activeQueueRunning () {
    var activePageDetails = storageAdapter.getActiveQueue()
    if (activePageDetails === undefined) {
      return false
    }
    var timeSincePoll = now() - activePageDetails.ts
    return !(timeSincePoll >= ACTIVE_QUEUE_EXPIRE_TIME)
  }

  function now () {
    return (new Date()).getTime()
  }

  /**
   * Deactivating the queue on beforeunload is not
   * necessary but is better/quicker than waiting for a
   * few seconds for the queue to be unresponsive.
   */
  function deactivateOnUnload (queueId) {
    if (window.addEventListener) {
      window.addEventListener('beforeunload', deactivate)
    } else if (window.attachEvent) {
      window.attachEvent('onbeforeunload', deactivate)
    }

    function deactivate () {
      var activeQueue = storageAdapter.getActiveQueue()
      if (activeQueue && activeQueue.id === queueId) {
        queueThat.destroy()
        storageAdapter.clearActiveQueue()
        log.info('deactivated on page unload')
      }
    }
  }
}
