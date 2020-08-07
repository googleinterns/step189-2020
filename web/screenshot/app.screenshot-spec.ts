import { AppPage } from './app.po';
import { $, browser, logging } from 'protractor';

describe('protractor-image-comparison desktop', () => {
  beforeEach(async () => {
    await browser.get(browser.baseUrl);
  });

  it('should be the same as the baseline', async () => {
    expect(await browser.imageComparison.checkScreen('my-pushes')).toEqual(0);
  });
});
