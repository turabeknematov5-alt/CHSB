import test from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { startDemo } from '../tasks/demo/server.js';
import { DemoAdapter, demoMapping } from '../tasks/demo/adapter.js';
import { Watcher, mockSolver } from '../runtime/watcher.js';
let browser;
let demo;
let temp;
test.before(async () => { browser = await chromium.launch({ headless: true, executablePath: process.env.NIGHTSHIFT_BROWSER ?? (process.platform === 'win32' ? chromium.executablePath() : '/usr/bin/chromium'), args: ['--no-sandbox'] }); demo = await startDemo(); temp = await mkdtemp(path.join(os.tmpdir(), 'nightshift-')); });
test.after(async () => { await browser.close(); await demo.close(); await rm(temp, { recursive: true, force: true }); });
async function setup(solver, url = '') { const page = await browser.newPage(); await page.goto(demo.url + url); const packets = []; const base = solver ?? mockSolver(); const watcher = new Watcher(new DemoAdapter(page, demoMapping, temp), async (q, s) => { packets.push(q); return base(q, s); }); await watcher.start(); return { page, watcher, packets, close: async () => { await watcher.stop(); await page.close(); } }; }
async function waitUntil(fn, ms = 5000) { const end = Date.now() + ms; while (Date.now() < end) {
    if (await fn())
        return;
    await new Promise(r => setTimeout(r, 20));
} throw Error('Test condition deadline'); }
async function solved(x, n = 1) { await waitUntil(() => x.watcher.completed.size === n || x.watcher.state === 'ERROR'); assert.notEqual(x.watcher.state, 'ERROR', x.watcher.lastError); }
test('initial load, untrusted click and background mutations cause zero solves', async () => { const x = await setup(); try {
    await x.page.waitForTimeout(350);
    await x.page.locator('#next').evaluate(e => e.click());
    await x.page.waitForTimeout(700);
    assert.equal(x.packets.length, 0);
}
finally {
    await x.close();
} });
test('manual Next waits for new text, image and math; selects valid choice; never advances/submits', async () => { const x = await setup(); try {
    await x.page.click('#next');
    await solved(x);
    assert.equal(x.packets.length, 1);
    assert.match(x.packets[0].text, /Question 1/);
    assert.equal(x.packets[0].images.length, 1);
    assert.equal(await x.page.locator('[data-choice=b]').isChecked(), true);
    assert.deepEqual(await x.page.evaluate(() => window.stats), { next: 1, finish: 0, applied: 1 });
}
finally {
    await x.close();
} });
test('keyboard Enter and generated click count once', async () => { const x = await setup(); try {
    await x.page.focus('#next');
    await x.page.keyboard.press('Enter');
    await solved(x);
    assert.equal(x.packets.length, 1);
    assert.equal(x.watcher.acceptedEvents.size, 1);
}
finally {
    await x.close();
} });
test('keyboard Space and generated click count once', async () => { const x = await setup(); try {
    await x.page.focus('#next');
    await x.page.keyboard.press('Space');
    await solved(x);
    assert.equal(x.packets.length, 1);
    assert.equal(x.watcher.acceptedEvents.size, 1);
}
finally {
    await x.close();
} });
test('rapid Next cancels obsolete solver and only latest question applies', async () => { const x = await setup(mockSolver(550)); try {
    await x.page.click('#next');
    await waitUntil(() => x.watcher.state === 'SOLVING');
    await x.page.click('#next');
    await x.page.click('#next');
    await solved(x);
    assert.match(x.packets.at(-1).text, /Question 3/);
    assert.equal(await x.page.evaluate(() => window.stats.applied), 1);
    assert.equal(x.watcher.completed.size, 1);
}
finally {
    await x.close();
} });
test('moving away without Next discards an in-flight result', async () => { const x = await setup(mockSolver(400)); try {
    await x.page.click('#next');
    await waitUntil(() => x.watcher.state === 'SOLVING');
    await x.page.goto(demo.url);
    await x.watcher.settled();
    assert.equal(x.watcher.completed.size, 0);
    assert.equal(await x.page.locator('input:checked').count(), 0);
}
finally {
    await x.close();
} });
test('manual answer overrides pending solve', async () => { const x = await setup(mockSolver(500)); try {
    await x.page.click('#next');
    await waitUntil(() => x.watcher.state === 'SOLVING');
    await x.page.click('[data-choice=a]');
    await x.watcher.settled();
    assert.equal(await x.page.locator('[data-choice=a]').isChecked(), true);
    assert.equal(await x.page.evaluate(() => window.stats.applied), 0);
}
finally {
    await x.close();
} });
test('malformed and stale output are rejected', async () => { for (const response of [null, { questionId: 'old', status: 'answered', selectedChoiceIds: ['b'], explanation: '', uncertainty: null }]) {
    const x = await setup(async () => response);
    try {
        await x.page.click('#next');
        await waitUntil(() => x.watcher.state === 'ERROR');
        assert.equal(await x.page.locator('input:checked').count(), 0);
    }
    finally {
        await x.close();
    }
} });
test('multiple selection applies and verifies exact IDs', async () => { const x = await setup(); try {
    await x.page.evaluate(() => window.fixture.multiple = true);
    await x.page.click('#next');
    await solved(x);
    assert.equal(await x.page.locator('input:checked').count(), 2);
}
finally {
    await x.close();
} });
test('completed repeated fingerprints do not solve twice', async () => { const x = await setup(); try {
    await x.page.evaluate(() => window.fixture.repeated = true);
    await x.page.click('#next');
    await solved(x);
    await x.page.click('#next');
    await x.page.waitForTimeout(1000);
    assert.equal(x.packets.length, 1);
}
finally {
    await x.close();
} });
test('full navigation preserves manual token without solving reload independently', async () => { const x = await setup(undefined, '/?full'); try {
    await x.page.click('#next');
    await solved(x);
    assert.match(x.packets[0].text, /Question 1/);
    await x.page.reload();
    await x.page.waitForTimeout(700);
    assert.equal(x.packets.length, 1);
}
finally {
    await x.close();
} });
test('duplicate event ID produces at most one solve', async () => { const x = await setup(); try {
    const baseline = await x.watcher.adapter.getQuestionIdentity();
    x.watcher.event({ kind: 'next', baseline, eventId: 'duplicate' });
    x.watcher.event({ kind: 'next', baseline, eventId: 'duplicate' });
    await x.page.locator('#next').evaluate(e => e.click());
    await solved(x);
    assert.equal(x.packets.length, 1);
}
finally {
    await x.close();
} });
test('pause and stop cancel work; resume does not mint a solve', async () => { const x = await setup(mockSolver(500)); try {
    await x.page.click('#next');
    await waitUntil(() => x.watcher.state === 'SOLVING');
    x.watcher.pause();
    await x.watcher.settled();
    x.watcher.resume();
    assert.equal(x.watcher.completed.size, 0);
    assert.equal(x.packets.length, 1);
}
finally {
    await x.close();
} });
test('unreadable image reports failure instead of solving text only', async () => { const x = await setup(); try {
    await x.page.evaluate(() => window.fixture.broken = true);
    await x.page.click('#next');
    await waitUntil(() => x.watcher.state === 'ERROR');
    assert.match(x.watcher.lastError, /image failed/);
    assert.equal(x.packets.length, 0);
}
finally {
    await x.close();
} });
test('needs_input pauses without clicking any choice', async () => { const x = await setup(async (q) => ({ questionId: q.questionId, status: 'needs_input', selectedChoiceIds: [], explanation: '', uncertainty: 'Fixture missing evidence' })); try {
    await x.page.click('#next');
    await waitUntil(() => x.watcher.state === 'PAUSED');
    assert.equal(await x.page.locator('input:checked').count(), 0);
}
finally {
    await x.close();
} });
