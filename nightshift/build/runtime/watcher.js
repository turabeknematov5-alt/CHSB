import { validateAnswer } from './contracts.js';
export class Watcher {
    adapter;
    solver;
    report;
    state = 'IDLE';
    generation = 0;
    completed = new Set();
    acceptedEvents = new Set();
    lastError = '';
    controller;
    tail = Promise.resolve();
    stopped = false;
    constructor(adapter, solver, report = () => { }) {
        this.adapter = adapter;
        this.solver = solver;
        this.report = report;
    }
    async start() { await this.adapter.installManualTrigger(e => this.event(e)); this.set('IDLE'); }
    set(s, d) { this.state = s; this.report(s, d); }
    event(e) {
        if (this.stopped || this.state === 'PAUSED')
            return;
        if (e.kind === 'override') {
            this.generation++;
            this.controller?.abort();
            this.set('IDLE', 'Manual answer override');
            return;
        }
        if (this.acceptedEvents.has(e.eventId))
            return;
        this.acceptedEvents.add(e.eventId);
        this.controller?.abort();
        const generation = ++this.generation;
        const controller = this.controller = new AbortController();
        // Serialize cycles even when the solver ignores cancellation. It cannot overlap another solve.
        this.tail = this.tail.catch(() => { }).then(() => this.cycle(e, generation, controller.signal));
    }
    async cycle(e, generation, signal) {
        const current = () => { signal.throwIfAborted(); if (generation !== this.generation)
            throw Error('Obsolete generation'); };
        try {
            current();
            this.set('WAITING_FOR_NEW_QUESTION');
            await this.adapter.waitForQuestionReady(e.baseline, signal);
            current();
            this.set('CAPTURING');
            const q = await this.adapter.captureQuestion(e.eventId, generation);
            current();
            if (this.completed.has(q.questionId)) {
                this.set('IDLE', 'Question already completed');
                return;
            }
            this.set('SOLVING');
            const raw = await this.solver(q, signal);
            current();
            const answer = validateAnswer(raw, q);
            if (await this.adapter.getQuestionIdentity() !== q.questionId) {
                this.set('IDLE', 'Page moved; result discarded');
                return;
            }
            current();
            if (answer.status === 'needs_input') {
                this.set('PAUSED', answer.uncertainty ?? 'Question needs input');
                return;
            }
            this.set('APPLYING');
            await this.adapter.applyAnswer(q, answer, signal);
            current();
            if (!await this.adapter.verifyAnswer(answer))
                throw Error('Choice selection was not verified');
            this.completed.add(q.questionId);
            this.set('IDLE');
        }
        catch (error) {
            if (signal.aborted || generation !== this.generation)
                return;
            this.lastError = error.message;
            this.set('ERROR', this.lastError);
        }
    }
    pause() { this.generation++; this.controller?.abort(); this.set('PAUSED'); }
    resume() { if (!this.stopped)
        this.set('IDLE'); }
    async stop() { this.stopped = true; this.generation++; this.controller?.abort(); this.set('STOPPING'); await this.tail; await this.adapter.dispose(); }
    async settled() { await this.tail; }
}
export function mockSolver(delay = 25) {
    return async (q, signal) => {
        await new Promise((resolve, reject) => { const t = setTimeout(resolve, delay); signal.addEventListener('abort', () => { clearTimeout(t); reject(Error('Cancelled')); }, { once: true }); });
        return { questionId: q.questionId, status: 'answered', selectedChoiceIds: q.selectionMode === 'multiple' ? ['a', 'c'] : ['b'], explanation: 'Deterministic demo fixture; no AI inference.', uncertainty: null };
    };
}
