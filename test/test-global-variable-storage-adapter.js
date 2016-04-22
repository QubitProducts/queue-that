/* global describe, it, expect, beforeEach, afterEach, sinon */

var _ = require('underscore')
var globalVariableInjector = require('inject!../lib/global-variable-adapter')
var createLocalStorageAdapter = require('../lib/local-storage-adapter')

describe('globalVariableAdapter', function () {
  var clock
  var globalVariableAdapter
  var QUEUE_KEY
  var ACTIVE_QUEUE_KEY
  var BACKOFF_TIME_KEY
  var ERROR_COUNT_KEY

  beforeEach(function () {
    clock = sinon.useFakeTimers()
    var createGlobalVariableAdapter = globalVariableInjector({
      './local-storage-adapter': createLocalStorageAdapter
    })
    globalVariableAdapter = createGlobalVariableAdapter('Some Name')
    QUEUE_KEY = 'Some Name - Queue'
    ACTIVE_QUEUE_KEY = 'Some Name - Active Queue'
    BACKOFF_TIME_KEY = 'Some Name - Backoff Time'
    ERROR_COUNT_KEY = 'Some Name - Error Count'
  })

  afterEach(function () {
    window.__queueThat__ = undefined
    clock.restore()
  })

  describe('getQueue', function () {
    var data
    beforeEach(function () {
      data = ['a', 'b']
      window.__queueThat__[QUEUE_KEY] = JSON.stringify(data)
    })
    it('should be okay with an uninitialized queue', function () {
      window.__queueThat__[QUEUE_KEY] = undefined
      expect(globalVariableAdapter.getQueue()).to.eql([])
    })
    it('should get the queue from global variable on first get', function () {
      expect(globalVariableAdapter.getQueue()).to.eql(data)
    })
    it('should get the queue cache if set has been called', function () {
      globalVariableAdapter.setQueue(['new thing'])
      expect(globalVariableAdapter.getQueue()).to.eql(['new thing'])
      expect(JSON.parse(window.__queueThat__[QUEUE_KEY])).to.eql(['a', 'b'])
    })
    it('should get the queue from global variable once flush is called', function () {
      globalVariableAdapter.setQueue(['new thing'])
      globalVariableAdapter.flush()
      expect(JSON.parse(window.__queueThat__[QUEUE_KEY])).to.eql(['new thing'])

      window.__queueThat__[QUEUE_KEY] = JSON.stringify(['other', 'thing'])
      expect(globalVariableAdapter.getQueue()).to.eql(['other', 'thing'])
    })
    it('should get from  global variable after defer', function () {
      clock.tick(10)
      expect(globalVariableAdapter.getQueue()).to.eql(['a', 'b'])
      window.__queueThat__[QUEUE_KEY] = JSON.stringify(['c', 'd'])
      expect(globalVariableAdapter.getQueue()).to.eql(['a', 'b'])
      clock.tick(10)
      expect(globalVariableAdapter.getQueue()).to.eql(['c', 'd'])
    })
  })

  describe('setQueue', function () {
    it('should set the queue cache', function () {
      var queue = _.range(5)
      globalVariableAdapter.setQueue(queue)
      expect(window.__queueThat__[QUEUE_KEY]).to.be(undefined)
      expect(globalVariableAdapter.getQueue()).to.eql(queue)
    })
    it('should set to global variable after a flush', function () {
      var queue = _.range(5)
      globalVariableAdapter.setQueue(queue)
      globalVariableAdapter.flush()

      expect(window.__queueThat__[QUEUE_KEY]).to.be(JSON.stringify(queue))
      expect(globalVariableAdapter.getQueue()).to.eql(queue)
    })
  })

  describe('flush', function () {
    it('should be called once after a number of gets and sets', function () {
      globalVariableAdapter.setQueue([1, 2, 3])
      globalVariableAdapter.getQueue()
      globalVariableAdapter.getQueue()
      globalVariableAdapter.setQueue([3, 4, 5])
      globalVariableAdapter.setQueue([6, 7, 8])
      expect(globalVariableAdapter.getQueue()).to.eql([6, 7, 8])
      expect(window.__queueThat__[QUEUE_KEY]).to.eql(undefined)

      clock.tick(10)
      expect(globalVariableAdapter.getQueue()).to.eql([6, 7, 8])
      expect(JSON.parse(window.__queueThat__[QUEUE_KEY])).to.eql([6, 7, 8])
    })
  })

  describe('getErrorCount', function () {
    it('should return 0 when undefined', function () {
      expect(globalVariableAdapter.getErrorCount()).to.be(0)
    })
    it('should get the error count', function () {
      window.__queueThat__[ERROR_COUNT_KEY] = 1
      expect(globalVariableAdapter.getErrorCount()).to.be(1)
    })
  })

  describe('getBackoffTime', function () {
    it('should return 0 when undefined', function () {
      expect(globalVariableAdapter.getBackoffTime()).to.be(0)
    })
    it('should get the backoff time', function () {
      window.__queueThat__[BACKOFF_TIME_KEY] = 1
      expect(globalVariableAdapter.getBackoffTime()).to.be(1)
    })
  })

  describe('setErrorCount', function () {
    it('should set the error count', function () {
      globalVariableAdapter.setErrorCount(5)
      expect(window.__queueThat__[ERROR_COUNT_KEY]).to.be('5')
    })
  })

  describe('setBackoffTime', function () {
    it('should set the backoff time', function () {
      globalVariableAdapter.setBackoffTime(5)
      expect(window.__queueThat__[BACKOFF_TIME_KEY]).to.be('5')
    })
  })

  describe('getActiveQueue', function () {
    it('should return undefined when undefined', function () {
      expect(globalVariableAdapter.getActiveQueue()).to.be(undefined)
    })
    it('should return the parsed active queue details', function () {
      window.__queueThat__[ACTIVE_QUEUE_KEY] = JSON.stringify({
        id: 'the active queue id',
        ts: now()
      })

      expect(globalVariableAdapter.getActiveQueue()).to.eql({
        id: 'the active queue id',
        ts: now()
      })
    })
  })

  describe('setActiveQueue', function () {
    it('should set the stringified active queue details', function () {
      globalVariableAdapter.setActiveQueue('the active queue id')

      expect(JSON.parse(window.__queueThat__[ACTIVE_QUEUE_KEY])).to.eql({
        id: 'the active queue id',
        ts: now()
      })
    })
  })
})

function now () {
  return (new Date()).getTime()
}
