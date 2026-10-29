import { chromium } from 'playwright';
import { readFile, mkdir, access } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline';
import { startDemo } from '../tasks/demo/server.js';
import { Watcher, mockSolver } from './watcher.js';
import { codexSolver } from './codex.js';
import { discover } from './discovery.js';
const args = process.argv.slice(2);
const isDemo = args.includes('--demo');
const mock = args.includes('--mock');
const session = path.resolve(process.env.NIGHTSHIFT_SESSION ?? '.local-demo');
const root = process.cwd();
const terminal = createInterface({ input: process.stdin, output: process.stdout });
const input = terminal[Symbol.asyncIterator]();
let close;
let context;
let watcher;
try {
    if (args.includes('--start-gated')) {
        const gate = JSON.parse((await input.next()).value ?? '{}');
        if (gate.start !== true)
            throw Error('Mission gate was not released');
    }
    await mkdir(session, { recursive: true });
    const plugin = JSON.parse(await readFile('plugins/browser/plugin.json', 'utf8'));
    const tasks = await discover(root, plugin.capabilities);
    const taskId = isDemo ? 'demo' : args[args.indexOf('--task') + 1];
    const task = tasks.find(t => t.id === taskId);
    if (!task?.compatible)
        throw Error('Task unavailable or missing capabilities: ' + (task?.missing ?? taskId));
    let url = task.url;
    if (isDemo) {
        const demo = await startDemo();
        url = demo.url;
        close = demo.close;
    }
    const profile = path.join(session, 'browser-profile');
    let channel;
    if (process.platform === 'win32') {
        outer: for (const [name, relative] of [['msedge', 'Microsoft/Edge/Application/msedge.exe'], ['chrome', 'Google/Chrome/Application/chrome.exe']])
            for (const prefix of [process.env.PROGRAMFILES, process.env['PROGRAMFILES(X86)'], process.env.LOCALAPPDATA])
                if (prefix) {
                    try {
                        await access(path.join(prefix, relative));
                        channel = name;
                        break outer;
                    }
                    catch { }
                }
    }
    context = await chromium.launchPersistentContext(profile, { headless: args.includes('--headless'), channel, ...(process.env.NIGHTSHIFT_BROWSER ? { executablePath: process.env.NIGHTSHIFT_BROWSER } : {}), viewport: null });
    const page = context.pages()[0] ?? await context.newPage();
    const captures = path.join(session, 'captures');
    const module = await import(pathToFileURL(path.join(root, 'build/tasks', task.folder, task.adapter)).href);
    const adapter = await module.createAdapter(page, captures, path.join(root, 'tasks', task.folder, task.mappingFile ?? ''));
    // No bindings on the login document; no credentials reach logs, command lines or capture packets.
    if (!isDemo) {
        console.log('Waiting for masked website login from lifecycle stdin.');
        let credential = JSON.parse((await input.next()).value ?? '{}').credential;
        if (!credential)
            throw Error('Website credential missing');
        await page.goto(url);
        try {
            await adapter.login(credential);
        }
        catch {
            credential = null;
            console.log('[PAUSED] Login is unverified. Complete CAPTCHA/MFA or login in the shared browser, then type Continue; End session cancels.');
            const reply = (await input.next()).value ?? '';
            if (reply.toLowerCase() !== 'continue')
                throw Error('Login verification cancelled');
            await adapter.confirmLogin();
        }
        finally {
            credential = null;
        }
    }
    else
        await page.goto(url);
    let solver = mockSolver();
    if (!mock) {
        const selection = JSON.parse(await readFile(path.join(session, 'selection.json'), 'utf8'));
        solver = codexSolver({ exe: process.env.NIGHTSHIFT_CODEX, home: process.env.CODEX_HOME, ...selection, work: path.join(session, 'solver-jobs'), schema: path.join(root, 'runtime/solver-schema.json'), instructions: await readFile(path.join(root, 'tasks/chsb/solver.md'), 'utf8') });
    }
    watcher = new Watcher(adapter, solver, (s, d) => console.log(`[${s}] ${d ?? ''}`));
    await watcher.start();
    console.log('Shared browser ready. Initial question is IDLE. Commands: Pause / Resume / End session.');
    await new Promise(resolve => { void (async () => { for await (const line of { [Symbol.asyncIterator]: () => input }) {
        if (line.toLowerCase() === 'pause')
            watcher.pause();
        if (line.toLowerCase() === 'resume')
            watcher.resume();
        if (line.toLowerCase() === 'end session') {
            resolve();
            return;
        }
    } resolve(); })(); context.on('close', () => resolve()); process.once('SIGINT', resolve); process.once('SIGTERM', resolve); });
}
catch (e) {
    console.error('[ERROR] ' + e.message);
    process.exitCode = 1;
}
finally {
    await watcher?.stop();
    await context?.close();
    await close?.();
    terminal.close();
}
