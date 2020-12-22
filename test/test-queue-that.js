/* global describe, it, expect, beforeEach, afterEach, sinon */

var _ = require('underscore')
var createQueueThatInjector = require('inject!../lib/queue-that')

var QUEUE_GROUP_TIME = 100
var ACTIVE_QUEUE_TIMEOUT = 2500
var BACKOFF_TIME = 1000
var PROCESS_TIMEOUT = 2000

describe('createQueueThat', function () {
  var createQueueThat
  var createLocalStorageAdapter
  var createGlobalVariableAdapter
  var localStorageAdapter
  var globalVariableAdapter
  var clock
  beforeEach(function () {
    clock = sinon.useFakeTimers(1000)

    if (window.attachEvent) {
      sinon.stub(window, 'attachEvent')
    }
    if (window.addEventListener) {
      sinon.stub(window, 'addEventListener')
    }

    localStorageAdapter = createAdapter()
    createLocalStorageAdapter = sinon.stub().returns(localStorageAdapter)
    globalVariableAdapter = createAdapter()
    createGlobalVariableAdapter = sinon.stub().returns(globalVariableAdapter)
    createQueueThat = sinon.spy(createQueueThatInjector({
      './local-storage-adapter': createLocalStorageAdapter,
      './global-variable-adapter': createGlobalVariableAdapter
    }))
  })

  afterEach(function () {
    _.each(createQueueThat.getCalls(), function (call) {
      if (call.returnValue) {
        call.returnValue.destroy()
      }
    })
    clock.restore()
    if (window.attachEvent) {
      window.attachEvent.restore()
    }
    if (window.addEventListener) {
      window.addEventListener.restore()
    }
  })

  it('should require a process option', function () {
    expect(createQueueThat).withArgs({
      process: sinon.stub()
    }).to.not.throwException()
    expect(createQueueThat).withArgs({}).to.throwException()
    expect(createLocalStorageAdapter.withArgs('Queue That').callCount).to.be(1)
  })

  it('should create an adapter with the label option', function () {
    var queueThat = createQueueThat({
      process: sinon.stub(),
      label: 'A label'
    })

    expect(createLocalStorageAdapter.withArgs('A label').callCount).to.be(1)
    expect(createGlobalVariableAdapter.withArgs('A label').callCount).to.be(0)
    expect(queueThat.storageAdapter).to.be(localStorageAdapter)
  })

  it('should use the global variable adapter if localStorage does not work', function () {
    localStorageAdapter.works.returns(false)
    var queueThat = createQueueThat({
      process: sinon.stub(),
      label: 'A label'
    })

    expect(createGlobalVariableAdapter.withArgs('A label').callCount).to.be(1)
    expect(queueThat.storageAdapter).to.be(globalVariableAdapter)
  })

  describe('queueThat', function () {
    var queueThat
    var options

    beforeEach(function () {
      options = {
        process: sinon.stub()
      }
      queueThat = createQueueThat(options)
    })

    it('should not change the active queue if the active queue hasn\'t expired', function () {
      localStorageAdapter.getActiveQueue.returns({
        id: '123',
        ts: now()
      })
      queueThat('A')
      localStorageAdapter.getActiveQueue.returns({
        id: '123',
        ts: (now() - ACTIVE_QUEUE_TIMEOUT) + QUEUE_GROUP_TIME + 1
      })
      queueThat('A')

      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(0)
    })

    it('should change the active queue if there is not an active queue defined', function () {
      queueThat('A')

      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(1)
    })

    it('should change the active queue if the active queue has expired', function () {
      localStorageAdapter.getActiveQueue.returns({
        id: 123,
        ts: now() - ACTIVE_QUEUE_TIMEOUT
      })
      queueThat('A')

      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(1)
    })

    it('should check the active queue after initialisation and again after ACTIVE_QUEUE_TIMEOUT ms', function () {
      localStorageAdapter.getActiveQueue.returns({
        id: 123,
        ts: now() - ACTIVE_QUEUE_TIMEOUT
      })

      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(1)

      clock.tick(ACTIVE_QUEUE_TIMEOUT - QUEUE_GROUP_TIME)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(2)
    })

    it('should update the active timestamp on activity', function () {
      queueThat('A')

      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(1)
      clock.tick(QUEUE_GROUP_TIME)

      expect(localStorageAdapter.setActiveQueue.callCount).to.be(1)
      queueThat('B')
      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(1)

      expect(options.process.callCount).to.be(1)

      // a callback will keep the queue active
      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(2)

      // an error should also keep the queue active
      options.process.getCall(1).args[1](new Error())
      clock.tick(QUEUE_GROUP_TIME)
      clock.tick(BACKOFF_TIME)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(3)
    })

    it('should not read the queue while tasks are processing', function () {
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.getQueue.callCount).to.be(2)

      clock.tick(QUEUE_GROUP_TIME)
      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.getQueue.callCount).to.be(2)

      options.process.getCall(0).args[1]()
      expect(localStorageAdapter.getQueue.callCount).to.be(3)

      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.getQueue.callCount).to.be(4)
    })

    it('should save tasks to the queue', function () {
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.setQueue.getCall(0).args[0]).to.eql(['A'])
    })

    it('should add tasks to the end of the queue', function () {
      localStorageAdapter.getQueue.returns(['A'])
      queueThat('B')
      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.setQueue.callCount).to.be(1)
      expect(localStorageAdapter.setQueue.getCall(0).args[0]).to.eql(['A', 'B'])
    })

    it('should group multiple tasks every ' + QUEUE_GROUP_TIME + 'ms', function () {
      options.process = sinon.spy(function (task, done) {
        setTimeout(done, 10)
      })
      localStorageAdapter.setQueue(['A'])
      queueThat('B')
      clock.tick(QUEUE_GROUP_TIME / 2)
      queueThat('C')
      clock.tick(QUEUE_GROUP_TIME / 2)

      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0]).to.eql(arrayWithoutRepeatedItems(['A', 'B', 'C']))

      queueThat('D')
      clock.tick(QUEUE_GROUP_TIME)
      expect(options.process.callCount).to.be(2)
      expect(options.process.getCall(1).args[0]).to.eql(arrayWithoutRepeatedItems(['D']))
    })

    it('should process tasks on defer when flush is called', function () {
      queueThat.flush()
      queueThat('A')
      queueThat('B')

      /*
       * Flushing should only happen once with
       * multiple calls.
       */
      queueThat.flush()
      queueThat.flush()
      queueThat('C')

      clock.tick(1)
      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0]).to.eql(arrayWithoutRepeatedItems(['A', 'B', 'C']))

      queueThat('D')
      clock.tick(QUEUE_GROUP_TIME)
      expect(options.process.callCount).to.be(1)

      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_GROUP_TIME)
      expect(options.process.callCount).to.be(2)
      expect(options.process.getCall(1).args[0]).to.eql(arrayWithoutRepeatedItems(['D']))
    })

    it('should not process new tasks added to the active queue until processing has finished', function () {
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)
      queueThat('B')
      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0]).to.eql(arrayWithoutRepeatedItems(['A']))

      clock.tick(QUEUE_GROUP_TIME)

      expect(options.process.callCount).to.be(1)
    })

    it('should process new tasks added to the active queue after processing', function () {
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)
      queueThat('B')
      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0]).to.eql(arrayWithoutRepeatedItems(['A']))

      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_GROUP_TIME)

      expect(options.process.callCount).to.be(2)
      expect(options.process.getCall(1).args[0]).to.eql(arrayWithoutRepeatedItems(['B']))
    })

    it('should have a default batch size of 20', function () {
      localStorageAdapter.setQueue(_.range(50))
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)

      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0].length).to.be(20)
      expect(options.process.getCall(0).args[0][0]).to.be(0)
      expect(options.process.getCall(0).args[0][1]).to.be(1)

      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_GROUP_TIME)

      expect(options.process.callCount).to.be(2)
      expect(options.process.getCall(1).args[0].length).to.be(20)

      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_GROUP_TIME)

      expect(options.process.callCount).to.be(3)
      expect(options.process.getCall(2).args[0].length).to.be(11)
    })

    it('should use a custom batch size option', function () {
      options.batchSize = 10
      localStorageAdapter.setQueue(_.range(14))
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)

      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0].length).to.be(10)

      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_GROUP_TIME)

      expect(options.process.callCount).to.be(2)
      expect(options.process.getCall(1).args[0].length).to.be(5)
    })

    it('should allow an unlimited batch size option', function () {
      options.batchSize = Infinity
      localStorageAdapter.setQueue(_.range(1000))
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)

      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0].length).to.be(1001)

      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_GROUP_TIME)

      expect(options.process.callCount).to.be(1)
    })

    it('should allow a trim function option', function () {
      options.trim = function (items) {
        return _.filter(items, function (item) {
          return item !== 'B'
        })
      }

      queueThat('A')
      queueThat('B')
      queueThat('C')
      queueThat('B')
      queueThat('D')
      queueThat('B')
      queueThat('C')

      expect(localStorageAdapter.getQueue()).to.eql(['A', 'C', 'D', 'C'])

      clock.tick(QUEUE_GROUP_TIME)

      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0]).to.eql(arrayWithoutRepeatedItems(['A', 'C', 'D', 'C']))
    })

    it('should backoff exponentially on process error', function () {
      localStorageAdapter.setQueue(_.range(4))
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)

      options.process.getCall(0).args[1]('error')
      clock.tick(BACKOFF_TIME)

      expect(options.process.callCount).to.be(2)
      options.process.getCall(1).args[1]('error')

      clock.tick(BACKOFF_TIME)
      expect(options.process.callCount).to.be(2)

      clock.tick(BACKOFF_TIME)
      expect(options.process.callCount).to.be(3)
      options.process.getCall(2).args[1]('error')

      // backoff should wait to BACKOFF_TIME * 4
      clock.tick(BACKOFF_TIME * 2)
      expect(options.process.callCount).to.be(3)
    })

    it('should backoff to options.maxBackoff', function () {
      options.maxBackoff = 2 * BACKOFF_TIME
      localStorageAdapter.setQueue(_.range(4))
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)

      options.process.getCall(0).args[1]('error')
      clock.tick(BACKOFF_TIME)

      options.process.getCall(1).args[1]('error')

      clock.tick(2 * (BACKOFF_TIME))
      options.process.getCall(2).args[1]('error')

      clock.tick(2 * (BACKOFF_TIME))
      expect(options.process.callCount).to.be(4)
    })

    it('should backoff on timeout', function () {
      localStorageAdapter.setQueue(_.range(4))
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)
      clock.tick(PROCESS_TIMEOUT - 1)

      expect(localStorageAdapter.setErrorCount.withArgs(1).callCount).to.be(0)

      clock.tick(1)
      expect(localStorageAdapter.setErrorCount.withArgs(1).callCount).to.be(1)
      expect(options.process.callCount).to.be(1)

      // a success should not affect anything
      options.process.getCall(0).args[1]()

      clock.tick(BACKOFF_TIME)
      expect(options.process.callCount).to.be(2)
      expect(options.process.getCall(1).args[0]).to.eql(arrayWithRepeatedItems([0, 1, 2, 3, 'A']))
    })

    it('should report repeated items on process error', function () {
      localStorageAdapter.setQueue(_.range(4))
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)

      options.process.getCall(0).args[1]('error')
      clock.tick(BACKOFF_TIME + QUEUE_GROUP_TIME)

      expect(options.process.getCall(1).args[0]).to.eql(arrayWithRepeatedItems([0, 1, 2, 3, 'A']))
    })

    it('should report repeated items on process error followed by a new item', function () {
      localStorageAdapter.setQueue(_.range(4))
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)

      options.process.getCall(0).args[1]('error')
      queueThat('B')
      clock.tick(BACKOFF_TIME + QUEUE_GROUP_TIME)

      expect(options.process.getCall(1).args[0]).to.eql(arrayWithRepeatedItems([0, 1, 2, 3, 'A', 'B']))
    })

    it('should not report repeated items on process error followed by success', function () {
      localStorageAdapter.setQueue(_.range(4))
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)

      options.process.getCall(0).args[1]('error')
      queueThat('B')
      clock.tick(BACKOFF_TIME + QUEUE_GROUP_TIME)

      options.process.getCall(1).args[1]()
      clock.tick(QUEUE_GROUP_TIME)
      queueThat('C')
      queueThat('D')

      clock.tick(QUEUE_GROUP_TIME)
      expect(options.process.getCall(2).args[0]).to.eql(arrayWithoutRepeatedItems(['C', 'D']))
    })

    it('should not report repeated items on success batch after error batch', function () {
      options.batchSize = 5
      localStorageAdapter.setQueue(_.range(8))
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)

      options.process.getCall(0).args[1]('error')

      clock.tick(BACKOFF_TIME + QUEUE_GROUP_TIME)

      expect(options.process.getCall(1).args[0]).to.eql(arrayWithRepeatedItems([0, 1, 2, 3, 4]))

      options.process.getCall(1).args[1]()
      clock.tick(QUEUE_GROUP_TIME)

      expect(options.process.getCall(2).args[0]).to.eql(arrayWithoutRepeatedItems([5, 6, 7, 'A']))
    })

    it('should allow a backoff option', function () {
      options.backoffTime = 30000
      localStorageAdapter.setQueue(_.range(4))
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)

      options.process.getCall(0).args[1]('error')
      clock.tick(options.backoffTime + QUEUE_GROUP_TIME)

      expect(options.process.callCount).to.be(2)
      options.process.getCall(1).args[1]('error')

      clock.tick(options.backoffTime + QUEUE_GROUP_TIME)
      expect(options.process.callCount).to.be(2)

      clock.tick(options.backoffTime + QUEUE_GROUP_TIME)
      expect(options.process.callCount).to.be(3)
    })

    it('should use localStorage as the back off timer', function () {
      localStorageAdapter.setBackoffTime(now() + 3000)
      localStorageAdapter.setErrorCount(3)
      queueThat('A')

      clock.tick(QUEUE_GROUP_TIME)

      clock.tick(3000 - QUEUE_GROUP_TIME - 1)

      expect(options.process.callCount).to.be(0)

      clock.tick(1)
      expect(options.process.callCount).to.be(1)

      options.process.getCall(0).args[1](new Error(404))
      expect(localStorageAdapter.setErrorCount.withArgs(4).callCount).to.be(1)
      expect(localStorageAdapter.setBackoffTime.withArgs(now() + BACKOFF_TIME * Math.pow(2, 3)).callCount).to.be(1)

      clock.tick((BACKOFF_TIME * Math.pow(2, 3)))
      clock.tick(QUEUE_GROUP_TIME)
      options.process.getCall(1).args[1]()
      expect(options.process.callCount).to.be(2)

      expect(localStorageAdapter.setErrorCount.withArgs(0).callCount).to.be(1)
    })

    it('should not increment backoff when options.process succeeds', function () {
      localStorageAdapter.setBackoffTime(now() + 3000)
      localStorageAdapter.setErrorCount(1)

      expect(localStorageAdapter.setBackoffTime.callCount).to.be(1)
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)

      clock.tick(3000 + QUEUE_GROUP_TIME)
      expect(localStorageAdapter.setBackoffTime.callCount).to.be(1)
      options.process.getCall(0).args[1]()

      clock.tick(BACKOFF_TIME * Math.pow(2, 6))
      expect(localStorageAdapter.setBackoffTime.callCount).to.be(1)
    })

    it('should deactivate on beforeunload if it is the active queue', function () {
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.clearActiveQueue.callCount).to.be(0)
      if (window.addEventListener) {
        expect(window.addEventListener.getCall(0).args[0]).to.be('beforeunload')
        window.addEventListener.getCall(0).args[1]()
      } else {
        expect(window.attachEvent.getCall(0).args[0]).to.be('onbeforeunload')
        window.attachEvent.getCall(0).args[1]()
      }

      expect(localStorageAdapter.clearActiveQueue.callCount).to.be(1)
    })

    it('should not deactivate on beforeunload if it is not the active queue', function () {
      queueThat('A')
      clock.tick(QUEUE_GROUP_TIME)
      expect(localStorageAdapter.clearActiveQueue.callCount).to.be(0)
      localStorageAdapter.setActiveQueue(1234)
      if (window.addEventListener) {
        expect(window.addEventListener.getCall(0).args[0]).to.be('beforeunload')
        window.addEventListener.getCall(0).args[1]()
      } else {
        expect(window.attachEvent.getCall(0).args[0]).to.be('onbeforeunload')
        window.attachEvent.getCall(0).args[1]()
      }

      expect(localStorageAdapter.clearActiveQueue.callCount).to.be(0)
    })
  })
})

function arrayWithoutRepeatedItems (list) {
  list.containsRepeatedItems = false
  return list
}

function arrayWithRepeatedItems (list) {
  list.containsRepeatedItems = true
  return list
}

function now () {
  return (new Date()).getTime()
}

function createAdapter () {
  var adapter = {
    getQueue: sinon.stub().returns([]),
    setQueue: sinon.spy(function (q) {
      adapter.getQueue.returns(q)
    }),
    getErrorCount: sinon.stub().returns(0),
    getBackoffTime: sinon.stub().returns(0),
    setErrorCount: sinon.spy(function (n) {
      adapter.getErrorCount.returns(n)
    }),
    setBackoffTime: sinon.spy(function (t) {
      adapter.getBackoffTime.returns(t)
    }),
    getActiveQueue: sinon.stub(),
    setActiveQueue: sinon.spy(function (id) {
      adapter.getActiveQueue.returns({
        id: id,
        ts: now()
      })
    }),
    clearActiveQueue: sinon.spy(function (id) {
      adapter.getActiveQueue.returns(undefined)
    }),
    getQueueProcessing: sinon.stub().returns(false),
    setQueueProcessing: sinon.spy(function (isProcessing) {
      adapter.getQueueProcessing.returns(isProcessing)
    }),
    works: sinon.stub().returns(true),
    flush: sinon.stub()
  }
  return adapter
}
