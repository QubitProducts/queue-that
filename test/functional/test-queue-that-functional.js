/* global describe, it, expect, beforeEach, afterEach, sinon */
var createQueueThat = require('../../lib/queue-that')

describe('queueThat (functional)', function () {
  var queueThat

  beforeEach(function () {
    queueThat = createQueueThat({
      process: sinon.stub(),
      label: 'A label'
    })
  })

  afterEach(function () {
    queueThat.destroy()
    queueThat.storageAdapter.reset()
  })

  it('should debounce tasks', function (done) {
    queueThat.options.process = sinon.spy(function (items, next) {
      expect(items).to.eql([{
        task: 'a'
      }, {
        task: 'b'
      }, {
        task: 'c'
      }])
      next()
      done()
    })

    queueThat({
      task: 'a'
    })

    queueThat({
      task: 'b'
    })

    setTimeout(function () {
      queueThat({
        task: 'c'
      })
    }, 10)
  })

  it('should batch tasks', function (done) {
    queueThat.options.batchSize = 4

    queueThat.options.process = sinon.spy(function (items, next) {
      if (queueThat.options.process.callCount === 2) {
        check()
      }
      next()
    })

    queueThat({
      task: 'a'
    })

    queueThat({
      task: 'b'
    })

    setTimeout(function () {
      queueThat({
        task: 'c'
      })
      queueThat({
        task: 'd'
      })
      queueThat({
        task: 'e'
      })
    }, 10)

    function check () {
      expect(queueThat.options.process.getCall(0).args[0]).to.eql([{
        task: 'a'
      }, {
        task: 'b'
      }, {
        task: 'c'
      }, {
        task: 'd'
      }])

      expect(queueThat.options.process.getCall(1).args[0]).to.eql([{
        task: 'e'
      }])

      done()
    }
  })

  it('should retry tasks', function (done) {
    queueThat.options.batchSize = 4

    queueThat.options.process = sinon.spy(function (items, next) {
      if (queueThat.options.process.callCount === 1) {
        return next(new Error('Failed'))
      }
      next()
      if (queueThat.options.process.callCount === 3) {
        check()
      }
    })

    queueThat({
      task: 'a'
    })

    queueThat({
      task: 'b'
    })

    setTimeout(function () {
      queueThat({
        task: 'c'
      })
      queueThat({
        task: 'd'
      })
      queueThat({
        task: 'e'
      })
    }, 10)

    function check () {
      expect(queueThat.options.process.getCall(0).args[0]).to.eql([{
        task: 'a'
      }, {
        task: 'b'
      }, {
        task: 'c'
      }, {
        task: 'd'
      }])

      expect(queueThat.options.process.getCall(1).args[0]).to.eql([{
        task: 'a'
      }, {
        task: 'b'
      }, {
        task: 'c'
      }, {
        task: 'd'
      }])

      expect(queueThat.options.process.getCall(2).args[0]).to.eql([{
        task: 'e'
      }])

      done()
    }
  })

  it('should work with two queues on the page', function (done) {
    this.timeout(5000)

    queueThat('A')
    queueThat('B')
    queueThat('C')

    queueThat.options.process = sinon.spy(function (items, next) {
      if (queueThat.options.process.callCount !== 3) {
        next(new Error('Try again'))
      } else {
        next()
        check()
      }
    })

    var anotherQueueThat = createQueueThat({
      process: sinon.spy(function (items, next) {
        if (anotherQueueThat.options.process.callCount === 1) {
          next(new Error('Not this time bub'))
        } else {
          next()
          check()
        }
      }),
      label: 'Another label'
    })

    setTimeout(function () {
      queueThat('D')
      queueThat('E')

      anotherQueueThat('F')
      anotherQueueThat('G')
      anotherQueueThat('H')
      anotherQueueThat('I')
      anotherQueueThat('J')
    })

    function check () {
      var queueThatDone = queueThat.options.process.callCount === 3
      var anotherQueueThatDone = anotherQueueThat.options.process.callCount === 2
      if (queueThatDone && anotherQueueThatDone) {
        expect(queueThat.options.process.getCall(0).args[0]).to.eql(['A', 'B', 'C', 'D', 'E'])
        expect(queueThat.options.process.getCall(1).args[0]).to.eql(['A', 'B', 'C', 'D', 'E'])
        expect(queueThat.options.process.getCall(2).args[0]).to.eql(['A', 'B', 'C', 'D', 'E'])

        expect(anotherQueueThat.options.process.getCall(0).args[0]).to.eql(['F', 'G', 'H', 'I', 'J'])
        expect(anotherQueueThat.options.process.getCall(1).args[0]).to.eql(['F', 'G', 'H', 'I', 'J'])

        anotherQueueThat.destroy()
        anotherQueueThat.storageAdapter.reset()
        done()
      }
    }
  })
})
