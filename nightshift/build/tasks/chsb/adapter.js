import { readFile } from 'node:fs/promises';
import { DomAdapter } from '../../runtime/dom-adapter.js';
// No selectors are guessed for this authenticated site. A reviewed local mapping is mandatory.
export async function createAdapter(page, captures, mappingFile) {
    const config = JSON.parse(await readFile(mappingFile, 'utf8'));
    if (config.verified !== true || !config.inspectedAt)
        throw Error('CHSB mapping awaits authenticated DOM verification');
    for (const key of ['question', 'text', 'choice', 'next', 'loading', 'mathPending', 'idAttribute', 'choiceIdAttribute', 'login', 'password', 'loginSubmit', 'loginSuccess'])
        if (!config.mapping[key])
            throw Error('Missing inspected CHSB mapping: ' + key);
    return new DomAdapter(page, config.mapping, captures, 20000);
}
