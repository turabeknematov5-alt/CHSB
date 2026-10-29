import {randomUUID} from 'node:crypto';
import {validateAnswer,type Adapter,type Solver,type Trigger} from './contracts.js';
export type State='IDLE'|'WAITING_FOR_NEW_QUESTION'|'CAPTURING'|'SOLVING'|'APPLYING'|'PAUSED'|'ERROR'|'STOPPING';
export class Watcher {
 state:State='IDLE'; generation=0; completed=new Set<string>(); acceptedEvents=new Set<string>(); lastError='';
 private controller?:AbortController; private tail:Promise<void>=Promise.resolve(); private stopped=false;
 constructor(public adapter:Adapter,private solver:Solver,private report:(state:State,detail?:string)=>void=()=>{}){}
 async start(){await this.adapter.installManualTrigger(e=>this.event(e));this.set('IDLE');}
 private set(s:State,d?:string){this.state=s;this.report(s,d);}
 event(e:Trigger){
  if(this.stopped || this.state==='PAUSED') return;
  if(e.kind==='override'){this.generation++;this.controller?.abort();this.set('IDLE','Manual answer override');return;}
  if(this.acceptedEvents.has(e.eventId)) return;
  this.acceptedEvents.add(e.eventId);this.controller?.abort();const generation=++this.generation;
  const controller=this.controller=new AbortController();
  // Serialize cycles even when the solver ignores cancellation. It cannot overlap another solve.
  this.tail=this.tail.catch(()=>{}).then(()=>this.cycle(e,generation,controller.signal));
 }
 private async cycle(e:Trigger,generation:number,signal:AbortSignal){
  const current=()=>{signal.throwIfAborted();if(generation!==this.generation) throw Error('Obsolete generation');};
  try{
   current();this.set('WAITING_FOR_NEW_QUESTION');await this.adapter.waitForQuestionReady(e.baseline,signal);current();
   this.set('CAPTURING');const q=await this.adapter.captureQuestion(e.eventId,generation);current();
   if(this.completed.has(q.questionId)){this.set('IDLE','Question already completed');return;}
   this.set('SOLVING');const raw=await this.solver(q,signal);current();
   const answer=validateAnswer(raw,q);
   if(await this.adapter.getQuestionIdentity()!==q.questionId){this.set('IDLE','Page moved; result discarded');return;}
   current();if(answer.status==='needs_input'){this.set('PAUSED',answer.uncertainty??'Question needs input');return;}
   this.set('APPLYING');await this.adapter.applyAnswer(q,answer,signal);current();
   if(!await this.adapter.verifyAnswer(answer))throw Error('Choice selection was not verified');
   this.completed.add(q.questionId);this.set('IDLE');
  }catch(error){if(signal.aborted || generation!==this.generation)return;this.lastError=(error as Error).message;this.set('ERROR',this.lastError);}
 }
 pause(){this.generation++;this.controller?.abort();this.set('PAUSED');}
 resume(){if(!this.stopped)this.set('IDLE');}
 async stop(){this.stopped=true;this.generation++;this.controller?.abort();this.set('STOPPING');await this.tail;await this.adapter.dispose();}
 async settled(){await this.tail;}
}
export function mockSolver(delay=25):Solver{return async(q,signal)=>{
 await new Promise<void>((resolve,reject)=>{const t=setTimeout(resolve,delay);signal.addEventListener('abort',()=>{clearTimeout(t);reject(Error('Cancelled'));},{once:true});});
 return {questionId:q.questionId,status:'answered',selectedChoiceIds:q.selectionMode==='multiple'?['a','c']:['b'],explanation:'Deterministic demo fixture; no AI inference.',uncertainty:null};
};}
