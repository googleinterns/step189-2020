import { browser, by, element } from 'protractor';

export class AppPage {
  navigateTo(): Promise<unknown> {
    return browser.get(browser.baseUrl) as Promise<unknown>;
  }

  getPageNameText(): Promise<string> {
    return element(by.css('div.page-name')).getText() as Promise<string>;
  }
}
