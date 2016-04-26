/* eslint-disable no-inner-declarations, no-unused-vars */
/**
 * Allows attachEvent to be stubbed in IE8.
 */
var __attachEvent__ = window.attachEvent
if (window.attachEvent) {
  function attachEvent () {}
  window.attachEvent = __attachEvent__
}
