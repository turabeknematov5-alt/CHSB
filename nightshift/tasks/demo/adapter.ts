import {DomAdapter,type Mapping} from '../../runtime/dom-adapter.js';
export const demoMapping:Mapping={question:'#question',text:'.text',choice:'input[data-choice]',next:'#next',loading:'#loading',mathPending:'[data-math-pending]',idAttribute:'data-id',choiceIdAttribute:'data-choice',multipleAttribute:'data-multiple'};
export class DemoAdapter extends DomAdapter {async login(){} }
import type {Page} from 'playwright';
export async function createAdapter(page:Page,captures:string){return new DemoAdapter(page,demoMapping,captures);}
