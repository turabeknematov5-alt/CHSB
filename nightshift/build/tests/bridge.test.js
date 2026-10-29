import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { CatalogClient } from '../runtime/catalog.js';
import { codexSolver } from '../runtime/codex.js';
const exe = path.resolve('tests/fake-codex.mjs');
test('metadata bridge initializes and reads account/models via JSON-RPC fixture', { skip: process.platform === 'win32' ? 'Fixture uses POSIX executable shebang' : false }, async () => { const home = await mkdtemp(path.join(os.tmpdir(), 'nightshift-auth-fixture-')); const client = new CatalogClient(exe, home); try {
    await client.init();
    assert.equal((await client.account()).account.email, 'test@example.com');
    assert.equal((await client.models())[0].model, 'fixture-model');
}
finally {
    client.close();
    await rm(home, { recursive: true, force: true });
} });
test('exec bridge transports schema/image, inherits isolated home, handles timeout and cleans outputs', { skip: process.platform === 'win32' ? 'Fixture uses POSIX executable shebang' : false }, async () => { const work = await mkdtemp(path.join(os.tmpdir(), 'nightshift-bridge-')); process.env.FIXTURE_HOME = work; const solver = codexSolver({ exe, home: work, work, model: 'fixture-model', effort: 'low', images: true, schema: path.resolve('runtime/solver-schema.json'), instructions: 'fixture', timeout: 1000 }); const q = { eventId: 'e', generation: 1, questionId: 'q', subject: 'math', text: '2+2', choices: [{ id: 'b', text: '4' }], images: [{ localPath: '/fixture/image.png', description: 'transport only; fake CLI does not read it' }], selectionMode: 'single', capturedAt: new Date().toISOString() }; try {
    const response = await solver(q, new AbortController().signal);
    assert.equal(response.questionId, 'q');
    assert.deepEqual(await readdir(work), []);
    await assert.rejects(() => solver({ ...q, text: 'timeout' }, new AbortController().signal), /deadline/);
    assert.deepEqual(await readdir(work), []);
    const a = new AbortController();
    const pending = solver({ ...q, text: 'timeout' }, a.signal);
    setTimeout(() => a.abort(), 150);
    await assert.rejects(pending);
    assert.deepEqual(await readdir(work), []);
}
finally {
    delete process.env.FIXTURE_HOME;
    await rm(work, { recursive: true, force: true });
} });
