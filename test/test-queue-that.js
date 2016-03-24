/* global describe, it, expect, beforeEach, afterEach, sinon */

var _ = require('underscore')
var createQueueThatInjector = require('inject!../lib/queue-that')

var QUEUE_POLL_INTERVAL = 100
var ACTIVE_QUEUE_EXPIRE_TIME = 3000
var INITIAL_BACKOFF_TIME = 1000

describe('createQueueThat', function () {
  var createQueueThat
  var createLocalStorageAdapter
  var createGlobalVariableAdapter
  var localStorageAdapter
  var globalVariableAdapter
  var clock
  beforeEach(function () {
    clock = sinon.useFakeTimers(1000)

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
        ts: now() - ACTIVE_QUEUE_EXPIRE_TIME + 1
      })
      queueThat('A')
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(0)
    })

    it('should change the active queue if there is not an active queue defined', function () {
      queueThat('A')
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(1)
    })

    it('should change the active queue if the active queue has expired', function () {
      localStorageAdapter.getActiveQueue.returns({
        id: 123,
        ts: now() - ACTIVE_QUEUE_EXPIRE_TIME
      })
      queueThat('A')
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(1)
    })

    it('should check the active queue ACTIVE_QUEUE_EXPIRE_TIME after initialisation', function () {
      localStorageAdapter.getActiveQueue.returns({
        id: 123,
        ts: now() - ACTIVE_QUEUE_EXPIRE_TIME
      })

      clock.tick(ACTIVE_QUEUE_EXPIRE_TIME - 1)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(0)

      clock.tick(1)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(1)
    })

    it('should continue updating the active timestamp', function () {
      queueThat('A')
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(1)
      clock.tick(QUEUE_POLL_INTERVAL)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(2)
      clock.tick(QUEUE_POLL_INTERVAL)
      expect(localStorageAdapter.setActiveQueue.callCount).to.be(3)
    })

    it('should not read the queue while tasks are processing', function () {
      queueThat('A')
      clock.tick(QUEUE_POLL_INTERVAL)
      expect(localStorageAdapter.getQueue.callCount).to.be(2)

      clock.tick(QUEUE_POLL_INTERVAL)
      clock.tick(QUEUE_POLL_INTERVAL)
      expect(localStorageAdapter.getQueue.callCount).to.be(2)

      options.process.getCall(0).args[1]()
      expect(localStorageAdapter.getQueue.callCount).to.be(3)

      clock.tick(QUEUE_POLL_INTERVAL)
      expect(localStorageAdapter.getQueue.callCount).to.be(4)
    })

    it('should save tasks to the queue', function () {
      queueThat('A')
      clock.tick(QUEUE_POLL_INTERVAL)
      expect(localStorageAdapter.setQueue.getCall(0).args[0]).to.eql(['A'])
    })

    it('should add tasks to the end of the queue', function () {
      localStorageAdapter.getQueue.returns(['A'])
      queueThat('B')
      clock.tick(QUEUE_POLL_INTERVAL)
      expect(localStorageAdapter.setQueue.callCount).to.be(1)
      expect(localStorageAdapter.setQueue.getCall(0).args[0]).to.eql(['A', 'B'])
    })

    it('should group multiple tasks every ' + QUEUE_POLL_INTERVAL + 'ms', function () {
      options.process = sinon.spy(function (task, done) {
        done()
      })
      localStorageAdapter.setQueue(['A'])
      queueThat('B')
      clock.tick(QUEUE_POLL_INTERVAL / 2)
      queueThat('C')
      clock.tick(QUEUE_POLL_INTERVAL / 2)

      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0]).to.eql(['A', 'B', 'C'])

      queueThat('D')
      clock.tick(QUEUE_POLL_INTERVAL)
      expect(options.process.callCount).to.be(2)
      expect(options.process.getCall(1).args[0]).to.eql(['D'])
    })

    it('should not process new tasks added to the active queue until processing has finished', function () {
      queueThat('A')
      clock.tick(QUEUE_POLL_INTERVAL)
      queueThat('B')
      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0]).to.eql(['A'])

      clock.tick(QUEUE_POLL_INTERVAL)

      expect(options.process.callCount).to.be(1)
    })

    it('should process new tasks added to the active queue after processing', function () {
      queueThat('A')
      clock.tick(QUEUE_POLL_INTERVAL)
      queueThat('B')
      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0]).to.eql(['A'])

      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_POLL_INTERVAL)

      expect(options.process.callCount).to.be(2)
      expect(options.process.getCall(1).args[0]).to.eql(['B'])
    })

    it('should have a default batch size of 20', function () {
      localStorageAdapter.setQueue(_.range(50))
      queueThat('A')
      clock.tick(QUEUE_POLL_INTERVAL)

      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0].length).to.be(20)
      expect(options.process.getCall(0).args[0][0]).to.be(0)
      expect(options.process.getCall(0).args[0][1]).to.be(1)

      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_POLL_INTERVAL)

      expect(options.process.callCount).to.be(2)
      expect(options.process.getCall(1).args[0].length).to.be(20)

      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_POLL_INTERVAL)

      expect(options.process.callCount).to.be(3)
      expect(options.process.getCall(2).args[0].length).to.be(11)
    })

    it('should use a custom batch size option', function () {
      options.batchSize = 10
      localStorageAdapter.setQueue(_.range(14))
      queueThat('A')
      clock.tick(QUEUE_POLL_INTERVAL)

      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0].length).to.be(10)

      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_POLL_INTERVAL)

      expect(options.process.callCount).to.be(2)
      expect(options.process.getCall(1).args[0].length).to.be(5)
    })

    it('should allow an unlimited batch size option', function () {
      options.batchSize = Infinity
      localStorageAdapter.setQueue(_.range(1000))
      queueThat('A')
      clock.tick(QUEUE_POLL_INTERVAL)

      expect(options.process.callCount).to.be(1)
      expect(options.process.getCall(0).args[0].length).to.be(1001)

      options.process.getCall(0).args[1]()
      clock.tick(QUEUE_POLL_INTERVAL)

      expect(options.process.callCount).to.be(1)
    })

    it('should backoff exponentially on process error', function () {
      localStorageAdapter.setQueue(_.range(4))
      queueThat('A')
      clock.tick(QUEUE_POLL_INTERVAL)

      options.process.getCall(0).args[1]('error')
      clock.tick(INITIAL_BACKOFF_TIME + QUEUE_POLL_INTERVAL)

      expect(options.process.callCount).to.be(2)
      options.process.getCall(1).args[1]('error')

      clock.tick(INITIAL_BACKOFF_TIME + QUEUE_POLL_INTERVAL)
      expect(options.process.callCount).to.be(2)

      clock.tick(INITIAL_BACKOFF_TIME + QUEUE_POLL_INTERVAL)
      expect(options.process.callCount).to.be(3)
    })

    it('should use localStorage as the back off timer', function () {
      localStorageAdapter.setBackoffTime(now() + 3000)
      localStorageAdapter.setErrorCount(3)
      queueThat('A')

      clock.tick(2999)
      expect(options.process.callCount).to.be(0)

      clock.tick(1)
      expect(options.process.callCount).to.be(1)

      options.process.getCall(0).args[1]('error')
      expect(localStorageAdapter.setErrorCount.withArgs(4).callCount).to.be(1)
      expect(localStorageAdapter.setBackoffTime.withArgs(now() + INITIAL_BACKOFF_TIME * Math.pow(2, 3)).callCount).to.be(1)

      clock.tick(INITIAL_BACKOFF_TIME * Math.pow(2, 4) + QUEUE_POLL_INTERVAL)
      expect(options.process.callCount).to.be(2)

      options.process.getCall(1).args[1]()

      expect(localStorageAdapter.setErrorCount.withArgs(0).callCount).to.be(1)
    })

    it('should not increment backoff when options.process succeeds', function () {
      localStorageAdapter.setBackoffTime(now() + 3000)
      localStorageAdapter.setErrorCount(1)

      expect(localStorageAdapter.setBackoffTime.callCount).to.be(1)
      queueThat('A')
      clock.tick(QUEUE_POLL_INTERVAL)

      clock.tick(3000 + QUEUE_POLL_INTERVAL)
      expect(localStorageAdapter.setBackoffTime.callCount).to.be(1)
      options.process.getCall(0).args[1]()

      clock.tick(INITIAL_BACKOFF_TIME * Math.pow(2, 6))
      expect(localStorageAdapter.setBackoffTime.callCount).to.be(1)
    })
  })
})

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
    works: sinon.stub().returns(true)
  }
  return adapter
}
