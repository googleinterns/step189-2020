import { AppPage } from './app.po';
import { browser, logging } from 'protractor';
import { join } from 'path';

const PixDiff = require('pix-diff');

describe('pix-diff-img-comparison', () => {
  beforeEach(() => {
    browser.pixDiff = new PixDiff({
      basePath: join(process.cwd(), '/e2e/screenshots/'),
      diffPath: join(process.cwd(), '/e2e/screenshots/'),
      baseline: true
    });
    browser.get(browser.baseUrl);
  });

  it('should match the page', () => {
    browser.pixDiff.checkScreen('homepage')
      .then(result => {
        expect(result.code).toEqual(PixDiff.RESULT_IDENTICAL);
      });
  });
});

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
