/* global describe, it, expect, beforeEach, afterEach */

var _ = require('underscore')
var proxyquire = require('proxyquireify-es3')(require)
var sinon = require('sinon')

var localStorage = window.localStorage

describe('localStorageAdapter', function () {
  var json
  var clock
  var localStorageAdapter
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
    var createLocalStorageAdapter = proxyquire('../lib/local-storage-adapter', {
      'json-bourne': json
    })
    localStorageAdapter = createLocalStorageAdapter('Some Name')
    QUEUE_KEY = 'Some Name - Queue'
    ACTIVE_QUEUE_KEY = 'Some Name - Active Queue'
    BACKOFF_TIME_KEY = 'Some Name - Backoff Time'
    ERROR_COUNT_KEY = 'Some Name - Error Count'
  })

  afterEach(function () {
    localStorage.clear()
    clock.restore()
  })

  describe('getQueue', function () {
    var data
    beforeEach(function () {
      data = ['a', 'b']
      json.parse.returns(data)
      localStorage[QUEUE_KEY] = 'the data'
    })
    it('should get the queue array', function () {
      expect(localStorageAdapter.getQueue(data)).to.eql(data)
      expect(json.parse.callCount).to.be(1)
      expect(json.parse.getCall(0).args[0]).to.be('the data')
    })
  })

  describe('setQueue', function () {
    it('should set the queue array', function () {
      var queue = _.range(5)
      json.stringify.returns('the queue')
      localStorageAdapter.setQueue(queue)

      expect(localStorage[QUEUE_KEY]).to.be('the queue')
      expect(json.stringify.callCount).to.be(1)
      expect(json.stringify.getCall(0).args[0]).to.be(queue)
    })
  })

  describe('getErrorCount', function () {
    it('should return 0 when undefined', function () {
      expect(localStorageAdapter.getErrorCount()).to.be(0)
    })
    it('should get the error count', function () {
      localStorage[ERROR_COUNT_KEY] = '1'
      expect(localStorageAdapter.getErrorCount()).to.be(1)
    })
  })

  describe('getBackoffTime', function () {
    it('should return 0 when undefined', function () {
      expect(localStorageAdapter.getBackoffTime()).to.be(0)
    })
    it('should get the backoff time', function () {
      localStorage[BACKOFF_TIME_KEY] = '1'
      expect(localStorageAdapter.getBackoffTime()).to.be(1)
    })
  })

  describe('setErrorCount', function () {
    it('should set the error count', function () {
      localStorageAdapter.setErrorCount(5)
      expect(localStorage[ERROR_COUNT_KEY]).to.be('5')
    })
  })

  describe('setBackoffTime', function () {
    it('should set the backoff time', function () {
      localStorageAdapter.setBackoffTime(5)
      expect(localStorage[BACKOFF_TIME_KEY]).to.be('5')
    })
  })

  describe('getActiveQueue', function () {
    it('should return undefined when undefined', function () {
      expect(localStorageAdapter.getActiveQueue()).to.be(undefined)
    })
    it('should return the parsed active queue details', function () {
      localStorage[ACTIVE_QUEUE_KEY] = 'the stringified details'
      json.parse.returns('the parsed details')

      expect(localStorageAdapter.getActiveQueue()).to.be('the parsed details')
      expect(json.parse.callCount).to.be(1)
      expect(json.parse.getCall(0).args[0]).to.be('the stringified details')
    })
  })

  describe('setActiveQueue', function () {
    it('should set the stringified active queue details', function () {
      json.stringify.returns('the stringified details')
      localStorageAdapter.setActiveQueue('the active queue id')

      expect(localStorage[ACTIVE_QUEUE_KEY]).to.be('the stringified details')
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
