Queue That
----------

[![js-standard-style](https://cdn.rawgit.com/feross/standard/master/badge.svg)](https://github.com/feross/standard)

[ ![Codeship Status for qubitdigital/jolt](https://codeship.com/projects/1ef92b10-ceb4-0133-7c75-664cd4c01036/status?branch=master)](https://codeship.com/projects/141036)

A queue managed in localStorage for async tasks that may run immediately before page unload.
Queue That is built primarily to queue XHR requests for reporting.

### API

```javascript
var queueThat = require('queue-that')
var post = require('post')
var when = require('when')

var q = queueThat({
  /**
   * Default is 'Queue That'. This label is
   * used to store the queue in localStorage.
   * If there are more than one queues, unique
   * labels are required separate them.
   */
  label: 'Events',
  /**
   * The queue will not process any more events
   * until done is called.
   */
  process: function (items, done) {
    when.all(
      items.map(post.bind(null, 'https://somewhere.com/events'))
    ).then(done)
  },
  /**
   * Every time the queue is set, this setter will be called.
   * Good for reducing the queue size if it gets too long.
   */
  trim: function (items) {
    return items.filter(function (item) {
      return item !== 'Low priority'
    })
  }
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

### Features

- When more than one tab is open, only one active queue will process tasks.
- If `options.process` calls back with an error, the tasks will be passed to `options.process`
  again after a second. This backoff time doubles for each sequential error. The backoff timer is
  stored in localStorage and so will not reset when Queue That is reinitialised.
- Tasks are batched with a default batch size of **100**. The option `batchSize` can be used to change
  the batch size. Disable batching by setting `batchSize` to `Infinity`.
- The active queue polls localStorage every **20ms** for new tasks.
- If the active queue does not poll for over **1.5 seconds**, the next tab to queue
  a process will become the active queue. Also the active queue will become unactive when the page unloads.
- Falls back to `window.__queueThat__` variable if localStorage throws or doesn't work.
- Optional trim function that will be called as a setter every time the queue is set. This is good for
  when the queue is taking up a lot of localStorage or if JSON parsing/stringifying becomes slow.

### Support

Supported and tested on

- IE8+
- Firefox
- Safari
- Opera
- Chrome
