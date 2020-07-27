import { AppPage } from './app.po';
import { $, browser, logging } from 'protractor';

describe('workspace-project App', () => {
  let page: AppPage;

  beforeEach(() => {
    page = new AppPage();
  });

  it('should display welcome message', () => {
    page.navigateTo();
    expect(page.getTitleText()).toEqual('my-pushes works!');
  });

  afterEach(async () => {
    // Assert that there are no errors emitted from the browser
    const logs = await browser.manage().logs().get(logging.Type.BROWSER);
    expect(logs).not.toContain(jasmine.objectContaining({
      level: logging.Level.SEVERE,
    } as logging.Entry));
  });
});

describe('protractor-image-comparison desktop', () => {
  beforeEach(async () => {
    await browser.get(browser.baseUrl);
  });

  it('should be the same as the baseline', async() => {
    // Check a screen
    expect(await browser.imageComparison.checkScreen('welcomePage')).toEqual(0);
  });
});

