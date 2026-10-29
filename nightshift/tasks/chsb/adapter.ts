import {readFile} from 'node:fs/promises';
import type {Page} from 'playwright';
import {DomAdapter,type Mapping} from '../../runtime/dom-adapter.js';
// No selectors are guessed for this authenticated site. A reviewed local mapping is mandatory.
export async function createAdapter(page:Page,captures:string,mappingFile:string){
 const config=JSON.parse(await readFile(mappingFile,'utf8')) as {verified:boolean;inspectedAt:string;mapping:Mapping};
 if(config.verified!==true||!config.inspectedAt)throw Error('CHSB mapping awaits authenticated DOM verification');
 for(const key of ['question','text','choice','next','loading','mathPending','idAttribute','choiceIdAttribute','login','password','loginSubmit','loginSuccess'] as const)if(!config.mapping[key])throw Error('Missing inspected CHSB mapping: '+key);
 return new DomAdapter(page,config.mapping,captures,20000);
}
