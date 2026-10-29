import { createHash, randomUUID } from 'node:crypto';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
export class DomAdapter {
    page;
    mapping;
    captures;
    deadline;
    binding = 'nightshift' + randomUUID().replaceAll('-', '');
    disposed = false;
    versions = new Map();
    constructor(page, mapping, captures, deadline = 10000) {
        this.page = page;
        this.mapping = mapping;
        this.captures = captures;
        this.deadline = deadline;
    }
    async login(credentials) {
        const m = this.mapping;
        if (!m.login || !m.password || !m.loginSubmit || !m.loginSuccess)
            throw Error('Login mapping has not been verified');
        await this.page.locator(m.login).fill(credentials);
        await this.page.locator(m.password).fill(credentials);
        await this.page.locator(m.loginSubmit).click();
        try {
            await this.page.locator(m.loginSuccess).waitFor({ state: 'visible', timeout: 30000 });
        }
        catch {
            throw Error('Login not verified. Handle CAPTCHA/MFA in the visible browser; then retry inspection.');
        }
    }
    async confirmLogin() { if (!this.mapping.loginSuccess)
        throw Error('Login success mapping not verified'); await this.page.locator(this.mapping.loginSuccess).waitFor({ state: 'visible', timeout: 10000 }); }
    async snapshot() {
        return this.page.evaluate(({ m, binding }) => {
            const root = document.querySelector(m.question);
            if (!root)
                return null;
            const norm = (s) => s?.replace(/\s+/g, ' ').trim() ?? '';
            const choices = [...root.querySelectorAll(m.choice)].map(c => ({ id: c.getAttribute(m.choiceIdAttribute) ?? '', text: norm(c.textContent) }));
            const media = [...root.querySelectorAll('img,canvas,svg,math')].map(e => e instanceof HTMLImageElement ? { type: 'img', src: e.getAttribute('src'), alt: e.alt } : e instanceof HTMLCanvasElement ? { type: 'canvas', data: e.toDataURL() } : { type: e.tagName, html: e.outerHTML });
            const identity = JSON.stringify({ id: root.getAttribute(m.idAttribute), text: norm(root.querySelector(m.text)?.textContent ?? ''), choices, media });
            return { version: window[binding + 'version'] ?? 0, identity, text: norm(root.querySelector(m.text)?.textContent ?? ''), choices, media, mode: root.getAttribute(m.multipleAttribute ?? 'data-multiple') === 'true' ? 'multiple' : 'single', loading: !!document.querySelector(m.loading), mathPending: !!document.querySelector(m.mathPending), brokenImages: [...root.querySelectorAll('img')].some(i => i.complete && !i.naturalWidth), imagesPending: [...root.querySelectorAll('img')].some(i => !i.complete) };
        }, { m: this.mapping, binding: this.binding });
    }
    async getQuestionIdentity() { const s = await this.snapshot(); return s ? createHash('sha256').update(s.identity).digest('hex') : ''; }
    async installManualTrigger(emit) {
        await this.page.exposeBinding(this.binding, ({ frame }, e) => { if (!this.disposed && frame === this.page.mainFrame())
            emit(e); });
        const args = { m: this.mapping, binding: this.binding };
        const install = ({ m, binding }) => {
            const win = window;
            if (win[binding + 'installed'])
                return;
            win[binding + 'installed'] = true;
            let keyboardAt = 0;
            let keyboardTarget = null;
            const snapshot = () => {
                const root = document.querySelector(m.question);
                if (!root)
                    return '';
                const norm = (s) => s?.replace(/\s+/g, ' ').trim() ?? '';
                return JSON.stringify({ id: root.getAttribute(m.idAttribute), text: norm(root.querySelector(m.text)?.textContent ?? ''), choices: [...root.querySelectorAll(m.choice)].map(c => ({ id: c.getAttribute(m.choiceIdAttribute) ?? '', text: norm(c.textContent) })), media: [...root.querySelectorAll('img,canvas,svg,math')].map(e => e instanceof HTMLImageElement ? { type: 'img', src: e.getAttribute('src'), alt: e.alt } : e instanceof HTMLCanvasElement ? { type: 'canvas', data: e.toDataURL() } : { type: e.tagName, html: e.outerHTML }) });
            };
            const handle = (event) => {
                if (!event.isTrusted || !(event.target instanceof Element))
                    return;
                const next = event.target.closest(m.next);
                const choice = event.target.closest(m.choice);
                if (event instanceof KeyboardEvent) {
                    if (!['Enter', ' '].includes(event.key) || event.repeat)
                        return;
                    if (!next && !choice)
                        return;
                    keyboardAt = performance.now();
                    keyboardTarget = next ?? choice;
                }
                else if (event instanceof MouseEvent && event.detail === 0 && performance.now() - keyboardAt < 700 && (next ?? choice) === keyboardTarget)
                    return;
                if (!next && !choice)
                    return;
                win[binding + 'version'] = (win[binding + 'version'] ?? 0) + 1;
                void win[binding]({ kind: next ? 'next' : 'override', baseline: snapshot(), eventId: crypto.randomUUID() });
            };
            document.addEventListener('click', handle, true);
            document.addEventListener('keydown', handle, true);
        };
        // Hash the baseline in Node using the same normalization used for question IDs.
        // Binding receives raw serialized data so it can capture synchronously before site handlers.
        const original = emit;
        // Binding closure above calls this forwarding function via reassigned parameter.
        emit = e => original({ ...e, baseline: e.baseline ? createHash('sha256').update(e.baseline).digest('hex') : '' });
        await this.page.addInitScript(install, args);
        await this.page.evaluate(install, args);
    }
    async waitForQuestionReady(baseline, signal) {
        const end = Date.now() + this.deadline;
        let previous = '';
        let stable = 0;
        let reason = 'question missing';
        while (Date.now() < end) {
            signal.throwIfAborted();
            try {
                const s = await this.snapshot();
                const id = s ? createHash('sha256').update(s.identity).digest('hex') : '';
                reason = !s ? 'question missing' : id === baseline ? 'identity unchanged' : s.loading ? 'loading indicator' : !s.text || s.choices.length < 2 ? 'question/choices missing' : s.choices.some(c => !c.id) || new Set(s.choices.map(c => c.id)).size !== s.choices.length ? 'choice IDs missing/duplicated' : s.brokenImages ? 'image failed' : s.imagesPending ? 'images pending' : s.mathPending ? 'math pending' : '';
                if (s?.brokenImages)
                    throw Error('Relevant image failed to load');
                if (!reason) {
                    stable = id === previous ? stable + 1 : 1;
                    if (stable >= 3)
                        return;
                }
                else
                    stable = 0;
                previous = id;
            }
            catch (e) {
                if (e.message.includes('image failed'))
                    throw e;
                if (this.page.isClosed())
                    throw e;
                reason = 'navigation in progress';
            }
            await new Promise(r => setTimeout(r, 40));
        }
        throw Error('Readiness deadline: ' + reason);
    }
    async captureQuestion(eventId, generation) {
        const before = await this.getQuestionIdentity();
        const s = await this.snapshot();
        if (!s)
            throw Error('Question disappeared');
        const images = [];
        // Region-only screenshot preserves diagrams, math and associated choice images.
        if (s.media.length) {
            await mkdir(this.captures, { recursive: true });
            const file = path.join(this.captures, randomUUID() + '.png');
            await this.page.locator(this.mapping.question).screenshot({ path: file });
            images.push({ localPath: file, description: 'Question region including choices and visual notation' });
        }
        if (before !== await this.getQuestionIdentity())
            throw Error('Question changed during capture');
        this.versions.set(before, s.version);
        return { eventId, generation, questionId: before, subject: 'unspecified', text: s.text, choices: s.choices, images, selectionMode: s.mode, capturedAt: new Date().toISOString() };
    }
    async applyAnswer(q, a, signal) {
        for (const id of a.selectedChoiceIds) {
            signal.throwIfAborted();
            if (await this.getQuestionIdentity() !== q.questionId)
                throw Error('Stale question before click');
            // Execute the identity check and native DOM click in the same browser task to close the navigation race.
            const s = await this.snapshot();
            if (!s || createHash('sha256').update(s.identity).digest('hex') !== q.questionId)
                throw Error('Stale capture');
            await this.page.evaluate(({ m, identity, id, binding, version }) => {
                if ((window[binding + 'version'] ?? 0) !== version)
                    throw Error('Manual event superseded answer');
                const root = document.querySelector(m.question);
                if (!root)
                    throw Error('Question gone');
                const norm = (s) => s?.replace(/\s+/g, ' ').trim() ?? '';
                const actual = JSON.stringify({ id: root.getAttribute(m.idAttribute), text: norm(root.querySelector(m.text)?.textContent ?? ''), choices: [...root.querySelectorAll(m.choice)].map(c => ({ id: c.getAttribute(m.choiceIdAttribute) ?? '', text: norm(c.textContent) })), media: [...root.querySelectorAll('img,canvas,svg,math')].map(e => e instanceof HTMLImageElement ? { type: 'img', src: e.getAttribute('src'), alt: e.alt } : e instanceof HTMLCanvasElement ? { type: 'canvas', data: e.toDataURL() } : { type: e.tagName, html: e.outerHTML }) });
                if (actual !== identity)
                    throw Error('Question changed before atomic click');
                const c = [...root.querySelectorAll(m.choice)].find(c => c.getAttribute(m.choiceIdAttribute) === id);
                if (!c || c.closest(m.next) || c.closest('a[href]') || (c instanceof HTMLButtonElement && c.type === 'submit') || (c instanceof HTMLInputElement && !['radio', 'checkbox'].includes(c.type)) || !c.getClientRects().length)
                    throw Error('Choice is unavailable or overlaps Next');
                const selected = c instanceof HTMLInputElement ? c.checked : c.getAttribute(m.selectedAttribute ?? 'aria-checked') === 'true';
                if (!selected)
                    c.click();
            }, { m: this.mapping, identity: s.identity, id, binding: this.binding, version: this.versions.get(q.questionId) });
        }
    }
    async verifyAnswer(a) {
        const s = await this.snapshot();
        if (!s || await this.getQuestionIdentity() !== a.questionId)
            return false;
        return this.page.evaluate(({ m, ids }) => { const selected = [...document.querySelectorAll(m.question + ' ' + m.choice)].filter(c => c instanceof HTMLInputElement ? c.checked : c.getAttribute(m.selectedAttribute ?? 'aria-checked') === 'true').map(c => c.getAttribute(m.choiceIdAttribute)); return selected.length === ids.length && ids.every(id => selected.includes(id)); }, { m: this.mapping, ids: a.selectedChoiceIds });
    }
    async dispose() { this.disposed = true; }
}
