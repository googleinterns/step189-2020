// @ts-check
// Protractor configuration file, see link for more information
// https://github.com/angular/protractor/blob/master/lib/config.ts

const { SpecReporter, StacktraceOption } = require('jasmine-spec-reporter');
const { join } = require('path');

/**
 * @type { import("protractor").Config }
 */
exports.config = {
  allScriptsTimeout: 11000,
  specs: [
    './*.screenshot-spec.ts'
  ],
  capabilities: {
    browserName: 'chrome',
    chromeOptions: {
      args: ["--headless"]
    }
  },
  directConnect: true,
  baseUrl: 'http://localhost:4200/',
  framework: 'jasmine',
  jasmineNodeOpts: {
    showColors: true,
    defaultTimeoutInterval: 30000,
    print: function() {}
  },
  onPrepare() {
    require('ts-node').register({
      project: require('path').join(__dirname, './tsconfig.json')
    });
    jasmine.getEnv().addReporter(new SpecReporter({
      spec: {
        displayStacktrace: StacktraceOption.PRETTY
      }
    }));
  },
  plugins: [{
    package: 'protractor-image-comparison',
    options: {
      baselineFolder: join(process.cwd(), './screenshot/baseline/'),
      formatImageName: `{tag}-{logName}-{width}x{height}`,
      screenshotPath: join(process.cwd(), './screenshot/.tmp/'),
      savePerInstance: true,
      autoSaveBaseline: true
    }
  }]
};

