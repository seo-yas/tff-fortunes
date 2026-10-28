import base from './playwright.config.mjs';
export default { ...base, use: { ...base.use, baseURL: 'https://fortunes.thefreckledfork.com' }, webServer: undefined };
