module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['mocha', 'browserify', 'expect', 'sinon'],
    files: [
      './node_modules/sinon/pkg/sinon-timers-ie-1.14.1.js',
      {
        pattern: 'test/*.js',
        watched: false,
        included: true,
        served: true
      }
    ],
    exclude: [
      'karma.conf.js'
    ],
    preprocessors: {
      'test/*.js': ['browserify'],
      'lib/*.js': ['browserify']
    },
    browserify: {
      debug: true,
      plugin: ['proxyquireify-es3/plugin']
    },
    reporters: ['spec'],
    logLevel: config.LOG_INFO,
    browsers: ['Chrome']
  })
}
