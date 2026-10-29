import {chromium} from 'playwright';
import {existsSync} from 'node:fs';
const available=existsSync(chromium.executablePath())||process.platform==='win32'&&[process.env.PROGRAMFILES,process.env['PROGRAMFILES(X86)'],process.env.LOCALAPPDATA].some(p=>p&&(existsSync(p+'\\Microsoft\\Edge\\Application\\msedge.exe')||existsSync(p+'\\Google\\Chrome\\Application\\chrome.exe')));
if(!available){console.error('No reusable Edge/Chrome or installed Playwright Chromium. Run node node_modules/playwright/cli.js install chromium');process.exitCode=1;}else console.log('Browser dependency found');
