var log = require('./log')
var createLocalStorageAdapter = require('./local-storage-adapter')
var createGlobalVariableAdapter = require('./global-variable-adapter')

var DEFAULT_QUEUE_LABEL = 'Queue That'
var BACKOFF_TIME = 1000
var QUEUE_GROUP_TIME = 100
var PROCESS_TIMEOUT = 2000
var DEFAULT_BATCH_SIZE = 20
var DEFAULT_MAX_BACKOFF = 5 * 60 * 1000
var ACTIVE_QUEUE_TIMEOUT = 2500

module.exports = createQueueThat

function createQueueThat (options) {
  if (!options.process) {
    throw new Error('a process function is required')
  }
  options.batchSize = options.batchSize || DEFAULT_BATCH_SIZE
  options.label = options.label || DEFAULT_QUEUE_LABEL
  options.trim = options.trim || identity
  options.queueGroupTime = options.queueGroupTime || QUEUE_GROUP_TIME
  options.backoffTime = options.backoffTime || BACKOFF_TIME
  options.maxBackoff = options.maxBackoff || DEFAULT_MAX_BACKOFF
  options.processTimeout = options.processTimeout || PROCESS_TIMEOUT
  options.activeQueueTimeout = options.activeQueueTimeout || ACTIVE_QUEUE_TIMEOUT

  if (options.processTimeout > options.activeQueueTimeout) {
    throw new Error('active queue timeout must be greater than process timeout')
  }

  var checkTimer, processTimer, newQueueTimer, flushTimer
  var processingTasks = false
  var checkScheduled = false
  var queueId = Math.random() + now()
  var flushScheduled = false
  var destroyed = false

  var storageAdapter = createLocalStorageAdapter(options.label)
  if (!storageAdapter.works()) {
    storageAdapter = createGlobalVariableAdapter(options.label)
  }

  queueThat.storageAdapter = storageAdapter
  queueThat.options = options
  queueThat.flush = flush
  queueThat.destroy = function destroy () {
    destroyed = true
    clearTimeout(checkTimer)
    clearTimeout(processTimer)
    clearTimeout(newQueueTimer)
    clearTimeout(flushTimer)
  }
  queueThat.flushQueueCache = queueThat.storageAdapter.flush
  deactivateOnUnload(queueId)

  log.info('Initialized with queue ID ' + queueId)

  checkQueueDebounce()
  /**
   * This check is in case the queue is initialised quickly after
   * the queue from the previous page expires.
   */
  newQueueTimer = setTimeout(checkQueue, ACTIVE_QUEUE_TIMEOUT)

  return queueThat

  function queueThat (item) {
    var queue = storageAdapter.getQueue()
    queue.push(item)
    storageAdapter.setQueue(options.trim(queue))

    log.info('Item queued')

    checkQueueDebounce()
  }

  function flush () {
    if (flushScheduled) return

    checkScheduled = true
    flushScheduled = true
    clearTimeout(checkTimer)

    flushTimer = setTimeout(function checkQueueAndReset () {
      checkQueue()
      checkScheduled = false
      flushScheduled = false
    })
  }

  function checkQueueDebounce () {
    if (checkScheduled) return
    checkScheduled = true
    checkTimer = setTimeout(function checkQueueAndReset () {
      checkQueue()
      checkScheduled = false
    }, options.queueGroupTime)
  }

  function checkQueue () {
    log.info('Checking queue')

    if (processingTasks) return

    var backoffTime = storageAdapter.getBackoffTime() - now()
    if (backoffTime > 0) {
      setTimeout(checkQueue, backoffTime)
      return
    }

    var lastActiveQueue = getLastActiveQueueInfo()
    if (lastActiveQueue.active && lastActiveQueue.id !== queueId) return
    if (lastActiveQueue.id !== queueId) log.info('Switching active queue to ' + queueId)

    // Need to always do this to keep active
    storageAdapter.setActiveQueue(queueId)

    var batch = storageAdapter.getQueue().slice(0, options.batchSize)
    if (batch.length === 0) {
      return
    }

    log.info('Processing queue batch of ' + batch.length + ' items')
    batch.containsRepeatedItems = storageAdapter.getQueueProcessing()
    if (batch.containsRepeatedItems) log.info('Batch contains repeated items')
    else log.info('Batch does not contain repeated items')

    var itemsProcessing = batch.length
    var timeout = false
    var finished = false

    options.process(batch, function (err) {
      if (timeout || destroyed) return
      processingTasks = false
      finished = true
      if (err) {
        processError(err)
        checkQueueDebounce()
        return
      }

      storageAdapter.setErrorCount(0)
      var queue = rest(storageAdapter.getQueue(), itemsProcessing)
      storageAdapter.setQueue(queue)

      storageAdapter.setQueueProcessing(false)
      storageAdapter.flush()

      log.info('Queue processed, ' + queue.length + ' remaining items')

      checkQueueDebounce()
    })

    processTimer = setTimeout(function () {
      if (finished || destroyed) return
      timeout = true
      processingTasks = false
      processError(new Error('Task timeout'))
    }, options.processTimeout)

    processingTasks = true
    storageAdapter.setQueueProcessing(true)
    storageAdapter.flush()
  }

  function processError (err) {
    log.error('Process error, backing off (' + err.message + ')')
    var errorCount = storageAdapter.getErrorCount() + 1
    storageAdapter.setErrorCount(errorCount)
    storageAdapter.setBackoffTime(
      now() +
      Math.min(
        options.maxBackoff,
        options.backoffTime * Math.pow(2, errorCount - 1)
      )
    )
    log.warn('backoff time ' + (storageAdapter.getBackoffTime() - now()) + 'ms')
  }

  function getLastActiveQueueInfo () {
    var info = {}
    var activeinstance = storageAdapter.getActiveQueue()
    if (activeinstance === undefined) {
      info.active = false
      return info
    }
    info.id = activeinstance.id
    var timeSinceActive = now() - activeinstance.ts
    info.active = !(timeSinceActive >= ACTIVE_QUEUE_TIMEOUT)
    return info
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

function identity (input) {
  return input
}

function rest (array, n) {
  return Array.prototype.slice.call(array, n)
}
