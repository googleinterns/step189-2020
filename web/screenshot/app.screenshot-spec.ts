import { browser} from 'protractor';

describe('protractor-image-comparison desktop', () => {
  it('should be the same as the baseline', async () => {
    await browser.get(browser.baseUrl);
    expect(await browser.imageComparison.checkScreen('my-pushes')).toEqual(0);
  });
});
