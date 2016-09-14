/* global describe, it, expect, beforeEach, afterEach, sinon */

var _ = require('underscore')
var createLocalStorageAdapter = require('../lib/local-storage-adapter')

var localStorage = window.localStorage

var spec = describe
try {
  localStorage.a = 'b'
} catch (e) {
  spec = describe.skip
}

spec('localStorageAdapter', function () {
  var clock
  var localStorageAdapter
  var QUEUE_KEY
  var ACTIVE_QUEUE_KEY
  var BACKOFF_TIME_KEY
  var ERROR_COUNT_KEY
  var QUEUE_PROCESSING_KEY

  beforeEach(function () {
    clock = sinon.useFakeTimers()
    localStorageAdapter = createLocalStorageAdapter('Some Name')
    QUEUE_KEY = 'Some Name - Queue'
    ACTIVE_QUEUE_KEY = 'Some Name - Active Queue'
    BACKOFF_TIME_KEY = 'Some Name - Backoff Time'
    ERROR_COUNT_KEY = 'Some Name - Error Count'
    QUEUE_PROCESSING_KEY = 'Some Name - Queue Processing'
  })

  afterEach(function () {
    localStorage.clear()
    clock.restore()
  })

  describe('works', function () {
    it('should return false if saving throws', function () {
      localStorageAdapter.save = function () {
        throw new Error('I ain\'t havin no data today m8.')
      }

      expect(localStorageAdapter.works).to.not.throwError()
      expect(localStorageAdapter.works()).to.be(false)
    })
    it('should return false if saving does not persist', function () {
      localStorageAdapter.save = sinon.stub()

      expect(localStorageAdapter.works()).to.be(false)
    })
    it('should return true if saving persists', function () {
      expect(localStorageAdapter.works()).to.be(true)
    })
  })

  describe('getQueue', function () {
    var data
    beforeEach(function () {
      data = ['a', 'b']
      localStorage[QUEUE_KEY] = JSON.stringify(data)
    })
    it('should be okay with an uninitialized queue', function () {
      localStorage.removeItem(QUEUE_KEY)
      expect(localStorageAdapter.getQueue()).to.eql([])
    })
    it('should get the queue from localStorage on first get', function () {
      expect(localStorageAdapter.getQueue()).to.eql(data)
    })
    it('should get the queue cache if set has been called', function () {
      localStorageAdapter.setQueue(['new thing'])
      expect(localStorageAdapter.getQueue()).to.eql(['new thing'])
      expect(JSON.parse(localStorage[QUEUE_KEY])).to.eql(['a', 'b'])
    })
    it('should get the queue from localStorage once flush is called', function () {
      localStorageAdapter.setQueue(['new thing'])
      localStorageAdapter.flush()
      expect(JSON.parse(localStorage[QUEUE_KEY])).to.eql(['new thing'])

      localStorage[QUEUE_KEY] = JSON.stringify(['other', 'thing'])
      expect(localStorageAdapter.getQueue()).to.eql(['other', 'thing'])
    })
    it('should get from localStorage after defer', function () {
      clock.tick(10)
      expect(localStorageAdapter.getQueue()).to.eql(['a', 'b'])
      localStorage[QUEUE_KEY] = JSON.stringify(['c', 'd'])
      expect(localStorageAdapter.getQueue()).to.eql(['a', 'b'])
      clock.tick(10)
      expect(localStorageAdapter.getQueue()).to.eql(['c', 'd'])
    })
  })

  describe('setQueue', function () {
    it('should set the queue cache', function () {
      var queue = _.range(5)
      localStorageAdapter.setQueue(queue)
      expect(localStorage[QUEUE_KEY]).to.be(undefined)
      expect(localStorageAdapter.getQueue()).to.eql(queue)
    })
    it('should set to localStorage after a flush', function () {
      var queue = _.range(5)
      localStorageAdapter.setQueue(queue)
      localStorageAdapter.flush()

      expect(localStorage[QUEUE_KEY]).to.be(JSON.stringify(queue))
      expect(localStorageAdapter.getQueue()).to.eql(queue)
    })
  })

  describe('flush', function () {
    it('should be called once after a number of gets and sets', function () {
      localStorageAdapter.setQueue([1, 2, 3])
      localStorageAdapter.getQueue()
      localStorageAdapter.getQueue()
      localStorageAdapter.setQueue([3, 4, 5])
      localStorageAdapter.setQueue([6, 7, 8])
      expect(localStorageAdapter.getQueue()).to.eql([6, 7, 8])
      expect(localStorage[QUEUE_KEY]).to.eql(undefined)

      clock.tick(10)
      expect(localStorageAdapter.getQueue()).to.eql([6, 7, 8])
      expect(JSON.parse(localStorage[QUEUE_KEY])).to.eql([6, 7, 8])

      localStorageAdapter.setQueue([10, 11, 12])
      clock.tick(10)
      expect(JSON.parse(localStorage[QUEUE_KEY])).to.eql([10, 11, 12])
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
      localStorage[ACTIVE_QUEUE_KEY] = JSON.stringify({
        id: 'the active queue id',
        ts: now()
      })

      expect(localStorageAdapter.getActiveQueue()).to.eql({
        id: 'the active queue id',
        ts: now()
      })
    })
  })

  describe('setActiveQueue', function () {
    it('should set the stringified active queue details', function () {
      localStorageAdapter.setActiveQueue('the active queue id')

      expect(JSON.parse(localStorage[ACTIVE_QUEUE_KEY])).to.eql({
        id: 'the active queue id',
        ts: now()
      })
    })
  })

  describe('getQueueProcessing', function () {
    it('should be false by default', function () {
      expect(localStorageAdapter.getQueueProcessing()).to.be(false)
    })

    it('should parse numeric string to boolean', function () {
      localStorage[QUEUE_PROCESSING_KEY] = '0'
      expect(localStorageAdapter.getQueueProcessing()).to.be(false)

      localStorage[QUEUE_PROCESSING_KEY] = '1'
      expect(localStorageAdapter.getQueueProcessing()).to.be(true)
    })
  })

  describe('setQueueProcessing', function () {
    it('should encode a boolean as a numeric string', function () {
      localStorageAdapter.setQueueProcessing(false)
      expect(localStorage[QUEUE_PROCESSING_KEY]).to.be('0')

      localStorageAdapter.setQueueProcessing(true)
      expect(localStorage[QUEUE_PROCESSING_KEY]).to.be('1')
    })
  })
})

function now () {
  return (new Date()).getTime()
}
