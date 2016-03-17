module.exports = function (config) {
  config.set({
    basePath: '',
    frameworks: ['mocha', 'expect', 'sinon'],
    files: [
      './node_modules/sinon/pkg/sinon-timers-ie.js',
      'test/*.js'
    ],
    exclude: [
      'karma.conf.js'
    ],
    preprocessors: {
      'test/*.js': ['webpack', 'sourcemap']
    },
    reporters: ['spec'],
    logLevel: config.LOG_INFO,
    browsers: ['Chrome'],
    webpack: {
      devtool: 'inline-source-map'
    },
    webpackServer: {
      noInfo: true
    }
  })
}
