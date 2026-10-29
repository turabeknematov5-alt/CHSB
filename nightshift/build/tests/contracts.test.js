import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAnswer } from '../runtime/contracts.js';
import { resolveEffort, verifyAccount } from '../runtime/catalog.js';
const q = { eventId: 'e', generation: 1, questionId: 'q', subject: 'math', text: '2+2', choices: [{ id: 'a', text: '3' }, { id: 'b', text: '4' }], images: [], selectionMode: 'single', capturedAt: new Date().toISOString() };
const good = { questionId: 'q', status: 'answered', selectedChoiceIds: ['b'], explanation: '2+2=4', uncertainty: null };
test('answer contract rejects unknown/duplicate IDs, stale ID and invalid counts', () => { assert.equal(validateAnswer(good, q).selectedChoiceIds[0], 'b'); for (const patch of [{ selectedChoiceIds: ['unknown'] }, { selectedChoiceIds: ['a', 'a'] }, { selectedChoiceIds: [] }, { selectedChoiceIds: ['a', 'b'] }, { questionId: 'other' }, { status: 'finish-exam' }])
    assert.throws(() => validateAnswer({ ...good, ...patch }, q)); assert.equal(validateAnswer({ ...good, status: 'needs_input', selectedChoiceIds: [], uncertainty: 'unreadable' }, q).status, 'needs_input'); });
test('allowlist checks ChatGPT identity and never accepts API fallback', () => { assert.equal(verifyAccount({ type: 'chatgpt', email: 'TEST@example.com' }, 'test@example.com'), true); assert.equal(verifyAccount({ type: 'chatgpt', email: null }, 'test@example.com'), false); assert.throws(() => verifyAccount({ type: 'chatgpt', email: 'other@example.com' }, 'test@example.com')); assert.throws(() => verifyAccount({ type: 'apiKey' }, 'test@example.com')); });
test('effort resolves only advertised capabilities', () => { const model = { id: 'x', model: 'x', displayName: 'x', supportedReasoningEfforts: [{ reasoningEffort: 'low' }, { reasoningEffort: 'high' }] }; assert.equal(resolveEffort(model, 'lowest'), 'low'); assert.equal(resolveEffort(model, 'high'), 'high'); assert.throws(() => resolveEffort(model, 'medium')); });
