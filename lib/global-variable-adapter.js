var createLocalStorageAdapter = require('./local-storage-adapter')

module.exports = createGlobalVariableAdapter

function createGlobalVariableAdapter (queueName) {
  window.__queueThat__ = window.__queueThat__ || {}

  var localStorageAdapter = createLocalStorageAdapter(queueName)
  localStorageAdapter.save = save
  localStorageAdapter.load = load
  localStorageAdapter.remove = remove
  localStorageAdapter.type = 'globalVariable'

  return localStorageAdapter

  function save (key, data) {
    window.__queueThat__[key] = String(data)
  }

  function load (key) {
    return window.__queueThat__[key]
  }

  function remove (key) {
    delete window.__queueThat__[key]
  }
}
