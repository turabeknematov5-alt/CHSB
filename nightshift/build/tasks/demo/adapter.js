import { DomAdapter } from '../../runtime/dom-adapter.js';
export const demoMapping = { question: '#question', text: '.text', choice: 'input[data-choice]', next: '#next', loading: '#loading', mathPending: '[data-math-pending]', idAttribute: 'data-id', choiceIdAttribute: 'data-choice', multipleAttribute: 'data-multiple' };
export class DemoAdapter extends DomAdapter {
    async login() { }
}
export async function createAdapter(page, captures) { return new DemoAdapter(page, demoMapping, captures); }
