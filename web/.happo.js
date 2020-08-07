const { RemoteBrowserTarget } = require('happo.io');

module.exports = {

  apiKey: process.env.HAPPO_API_KEY,
  apiSecret: process.env.HAPPO_API_SECRET,

  pages: [
    { url: process.env.URL, title: 'Pull Request' }
  ],

  targets: {
    'chrome-desktop': new RemoteBrowserTarget('chrome', {
      viewport: '1024x768'
    }),
    'firefox-desktop': new RemoteBrowserTarget('firefox', {
      viewport: '1024x768'
    })
  }
};
