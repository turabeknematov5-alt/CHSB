import type { Page } from 'playwright';
export type Choice = {id:string;text:string};
export type Question = {eventId:string;generation:number;questionId:string;subject:string;text:string;choices:Choice[];images:{localPath:string;description:string}[];selectionMode:'single'|'multiple';capturedAt:string};
export type Answer = {questionId:string;status:'answered'|'needs_input';selectedChoiceIds:string[];explanation:string;uncertainty:string|null};
export type Trigger = {kind:'next'|'override';baseline:string;eventId:string};
export interface Adapter {
 page:Page; login(credentials:string):Promise<void>; installManualTrigger(emit:(e:Trigger)=>void):Promise<void>;
 getQuestionIdentity():Promise<string>; waitForQuestionReady(baseline:string,signal:AbortSignal):Promise<void>;
 captureQuestion(eventId:string,generation:number):Promise<Question>;
 applyAnswer(q:Question,a:Answer,signal:AbortSignal):Promise<void>; verifyAnswer(a:Answer):Promise<boolean>; dispose():Promise<void>;
}
export type Solver = (q:Question,signal:AbortSignal)=>Promise<unknown>;
export function validateAnswer(raw:unknown,q:Question):Answer {
 const a=raw as Answer;
 if(!a || a.questionId!==q.questionId || !['answered','needs_input'].includes(a.status) || !Array.isArray(a.selectedChoiceIds) || typeof a.explanation!=='string' || !(a.uncertainty===null || typeof a.uncertainty==='string')) throw Error('Malformed or stale solver response');
 const ids=new Set(q.choices.map(c=>c.id));
 if(new Set(a.selectedChoiceIds).size!==a.selectedChoiceIds.length || a.selectedChoiceIds.some(id=>!ids.has(id))) throw Error('Unknown or duplicate choice ID');
 if(a.status==='needs_input' ? a.selectedChoiceIds.length!==0 : a.selectedChoiceIds.length<1 || (q.selectionMode==='single' && a.selectedChoiceIds.length!==1)) throw Error('Incompatible selection count');
 return a;
}
