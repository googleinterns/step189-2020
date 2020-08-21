const { RemoteBrowserTarget } = require('happo.io');

module.exports = {
  
  apiKey: process.env.HAPPO_API_KEY,
  apiSecret: process.env.HAPPO_API_SECRET,
  
  pages: [
    { url: process.env.URL, title: 'my-pushes' },
    { url: process.env.URL/28a1555e453f, title: 'all-pushes 11k' },
    { url: process.env.URL/28a1555e453f/@20200805-211425.620604, title: 'built unchanged one-push 11k' },
    { url: process.env.URL/28a1555e453f/@20200724-212811.116442, title: 'completed one-push 11k' },
    { url: process.env.URL/7f4535707267, title: 'all-pushes 83' },
    { url: process.env.URL/7f4535707267/@20200413-170000.042638, title: 'completed one push 83' },
    { url: process.env.URL/7f4535707267/@20200316-170000.080599, title: 'reverted one push 83' },
  ],

  targets: {
    'chrome-desktop': new RemoteBrowserTarget('chrome', {
      viewport: '1024x768',
    })
  },
};
