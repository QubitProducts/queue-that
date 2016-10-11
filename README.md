Queue That
----------

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

[ ![Codeship Status for qubitdigital/jolt](https://codeship.com/projects/1ef92b10-ceb4-0133-7c75-664cd4c01036/status?branch=master)](https://codeship.com/projects/141036)

A queue managed in localStorage for async tasks that may run immediately before page unload.
Queue That is built primarily to queue XHR requests for reporting.

### How does it work?

- A queue of tasks is kept in `localStorage`.
- Tasks are batched in **100ms** buckets.
- Batches are passed to the `options.process` function, which calls a callback (optionally with an error object) when the tasks have finished processing.
- On page load and when a task is queued, succeeds or fails there is a check to see if there are any pending tasks and if there are any other queues processing them, if there are no active queues then the queue will set a flag in localStorage and begin processing tasks.

### Features

- When more than one tab is open, only one active queue will process tasks.
- If `options.process` calls back with an error, the tasks will be passed to `options.process`
  again after a second. This backoff time doubles for each sequential error. The backoff timer is
  stored in localStorage and so will not reset when Queue That is reinitialised.
- There is a **2 second** timeout for the process function, after which the queue will back off and retry later, ignoring any success/error callback from the first `options.process` call.
- The batch array passed to `options.process` contains a `containsRepeatedItems` property, useful for deduplicating requests sent to a server.
- Tasks are batched with a default batch size of **20**. The option `batchSize` can be used to change
  the batch size. Disable batching by setting `batchSize` to `Infinity`.
- Tasks are grouped in **100ms** batches
- If a queue is not active for over **2.5 seconds**, another tab's Queue may take over and become active (on an event such as initialization).
- Falls back to `window.__queueThat__` variable if localStorage throws or doesn't work.
- Optional trim function that will be called as a setter every time the queue is set. This is good for
  when the queue is taking up a lot of localStorage or if JSON parsing/stringifying becomes slow.

### API

```javascript
var queueThat = require('queue-that')
var post = require('post')
var when = require('when')

var q = queueThat({
  /**
   * This label is used to store the queue in localStorage.
   * If there are more than one queues, unique labels are required
   * to have them run without interference.
   *
   * @optional
   * @type {String}
   * @default 'Queue That'
   */
  label: 'Queue That',

  /**
   * Asynchronous function to process batches of tasks.
   * The queue will not process any more tasks until done is called
   * or the event times out.
   * 
   * @required
   * @type {Function}
   */
  process: function (batch, done) {
    var endpoint = 'https://somewhere.com/events' +
      (batch.containsRepeatedItems ? '?dedupe=true' : '?dedupe=false')
    when.all(
      batch.map(post.bind(null, 'https://somewhere.com/events'))
    ).then(done)
  },

  /**
   * Every time the queue is set, this setter will be called.
   * Good for reducing the queue size if it gets too long.
   * 
   * @optional
   * @type {Function}
   */
  trim: function (batch) {
    return batch.filter(function (task) {
      return task !== 'Low priority'
    })
  },

  /**
   * The time used to group tasks.
   * 
   * @optional
   * @type {Number}
   */
  queueGroupTime: 100,

  /**
   * The queue will wait this time when there is an
   * error before calling `options.process` again.
   * The time doubles on every error and resets on a success.
   * 
   * 
   * @optional
   * @type {Number}
   * @default 1000
   */
  backoffTime: 1000,

  /**
   * The queue will assume an error and backoff if a
   * task takes longer than this to process.
   * 
   * @optional
   * @type {Number}
   * @default 2000
   */
  processTimeout: 2000,

  /**
   * Another queue may become active if a queue hasn't
   * flagged itself as active for longer than this time.
   * This time must be longer than processTimeout.
   * 
   * @optional
   * @type {Number}
   * @default 2500
   */
  activeQueueTimeout: 2500
})

/**
 * This will usually fail because the page
 * will unload and cancel the XHR.
 */
post('https://somewhere.com/events', {
  name: 'Ronald',
  description: 'Clicked on a link'
})

/**
 * By queueing the event in localStorage, if the
 * window is closed, the event can be processed
 * later.
 */
q({
  name: 'Ronald',
  event: 'Clicked on a link'
})
```

### Developing

This repo uses [Yarn](https://yarnpkg.com/) for managing depenencies, so if you don't have Yarn

```bash
npm i -g yarnpkg
```

To install packasges and run testing.

```bash
make bootstrap
make test
```

### Support

Supported and tested on

- IE8+
- Firefox
- Safari
- Opera
- Chrome
