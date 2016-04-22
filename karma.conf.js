module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['mocha', 'expect', 'sinon'],
    files: [
      './node_modules/sinon/pkg/sinon-timers-ie.js',
      './test/attach-event-ie.js',
      'test/**/test-*.js'
    ],
    exclude: [
      'karma.conf.js'
    ],
    preprocessors: {
      'test/**/test-*.js': ['webpack', 'sourcemap']
    },
    reporters: ['spec'],
    logLevel: config.LOG_INFO,
    browsers: ['PhantomJS'],
    webpack: {
      devtool: 'inline-source-map'
    },
    webpackServer: {
      noInfo: true
    }
  })
}
