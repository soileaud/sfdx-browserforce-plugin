import { BrowserforcePlugin } from '../../../plugin.js';

export type Config = {
  services: Array<{
    label: string;
    enabled: boolean;
  }>;
};

const PATHS = {
  EDIT_VIEW: 'domainname/EditLogin.apexp'
};

const SELECTORS = {
  SERVICE_CHECKBOX: 'input.authOption[type="checkbox"]',
  SAVE_BUTTON: 'input[value="Save"]'
};

export class AuthenticationConfiguration extends BrowserforcePlugin {
  public async retrieve(definition: Config): Promise<Config> {
    const page = await this.browserforce.openPage(PATHS.EDIT_VIEW);

    await page.waitForSelector(SELECTORS.SERVICE_CHECKBOX);

    const services = await page.$$eval(
      SELECTORS.SERVICE_CHECKBOX,
      (inputs, definedServices) =>
      (inputs as HTMLInputElement[])
        .map((cb) => {
        const labelElement = document.querySelector(`label[for="${cb.id}"]`);
        const label = labelElement ? labelElement.textContent!.trim() : cb.id;
        return {
          label,
          enabled: cb.checked
        };
        })
        .filter((service) =>
        definedServices.some((definedService) => definedService.label === service.label)
        ),
      definition.services
    );

    await page.close();
    return { services };
  }

  public async apply(plan: Config): Promise<void> {
    const page = await this.browserforce.openPage(PATHS.EDIT_VIEW);

    await page.waitForSelector(SELECTORS.SERVICE_CHECKBOX);

    for (const svc of plan.services) {
      const checkboxId = await page.$$eval(
        SELECTORS.SERVICE_CHECKBOX,
        (inputs, serviceName) => {
          for (const inp of inputs as HTMLInputElement[]) {
            const labelElement = document.querySelector(`label[for="${inp.id}"]`);
            if (labelElement && labelElement.textContent!.trim() === serviceName) {
              return inp.id;
            }
          }
          return null;
        },
        svc.label
      ) as string | null;

      if (!checkboxId) {
        throw new Error(`Authentication service "${svc.label}" not found`);
      }

      const selector = `[id="${checkboxId}"]`;
      const isChecked = await page.$eval(
        selector,
        (el) => (el as HTMLInputElement).checked
      );

      if (svc.enabled !== isChecked) {
        await page.click(selector);
      }
    }

    await page.waitForSelector(SELECTORS.SAVE_BUTTON);
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'networkidle0' }),
      page.click(SELECTORS.SAVE_BUTTON)
    ]);

    await page.close();
  }
}
