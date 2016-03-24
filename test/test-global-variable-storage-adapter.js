/* global describe, it, expect, beforeEach, afterEach, sinon */

var _ = require('underscore')
var globalVariableInjector = require('inject!../lib/global-variable-adapter')
var adapterInjector = require('inject!../lib/local-storage-adapter')

describe('globalVariableAdapter', function () {
  var json
  var clock
  var globalVariableAdapter
  var QUEUE_KEY
  var ACTIVE_QUEUE_KEY
  var BACKOFF_TIME_KEY
  var ERROR_COUNT_KEY

  beforeEach(function () {
    clock = sinon.useFakeTimers()
    json = {
      parse: sinon.stub(),
      stringify: sinon.stub()
    }
    var createLocalStorageAdapter = adapterInjector({
      'json-bourne': json
    })
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
    delete window.__queueThat__
    clock.restore()
  })

  describe('getQueue', function () {
    var data
    beforeEach(function () {
      data = ['a', 'b']
      json.parse.returns(data)
      window.__queueThat__[QUEUE_KEY] = 'the data'
    })
    it('should get the queue array', function () {
      expect(globalVariableAdapter.getQueue(data)).to.eql(data)
      expect(json.parse.callCount).to.be(1)
      expect(json.parse.getCall(0).args[0]).to.be('the data')
    })
  })

  describe('setQueue', function () {
    it('should set the queue array', function () {
      var queue = _.range(5)
      json.stringify.returns('the queue')
      globalVariableAdapter.setQueue(queue)

      expect(window.__queueThat__[QUEUE_KEY]).to.be('the queue')
      expect(json.stringify.callCount).to.be(1)
      expect(json.stringify.getCall(0).args[0]).to.be(queue)
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
      window.__queueThat__[ACTIVE_QUEUE_KEY] = 'the stringified details'
      json.parse.returns('the parsed details')

      expect(globalVariableAdapter.getActiveQueue()).to.be('the parsed details')
      expect(json.parse.callCount).to.be(1)
      expect(json.parse.getCall(0).args[0]).to.be('the stringified details')
    })
  })

  describe('setActiveQueue', function () {
    it('should set the stringified active queue details', function () {
      json.stringify.returns('the stringified details')
      globalVariableAdapter.setActiveQueue('the active queue id')

      expect(window.__queueThat__[ACTIVE_QUEUE_KEY]).to.be('the stringified details')
      expect(json.stringify.callCount).to.be(1)
      expect(json.stringify.getCall(0).args[0]).to.eql({
        id: 'the active queue id',
        ts: now()
      })
    })
  })
})

function now () {
  return (new Date()).getTime()
}
