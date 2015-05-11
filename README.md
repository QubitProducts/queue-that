Queue That
----------

A queue managed in localStorage for async tasks that may run immediately before page unload.

### API

```javascript
var queueThat = require('queue-that')
var post = require('post')

/**
 * The queue will not process any more events
 * until done is called.
 */
var q = queueThat({
  process: function (items, done) {
    post('https://somewhere.com/events', items)
      .then(done)
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

### Things to note

- When more than one tab is open, only one active queue will process tasks
- The active queue will poll localStorage every 100ms for changes
- If the active queue does not poll for over 5 seconds, the next tab to queue
  a process will become the active queue

### Todo

- [ ] Tests
