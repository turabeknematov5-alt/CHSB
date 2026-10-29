import {spawn,type ChildProcessWithoutNullStreams} from 'node:child_process';
import {createInterface} from 'node:readline';
export type Model={id:string;model:string;displayName:string;hidden?:boolean;supportedReasoningEfforts:{reasoningEffort:string}[];inputModalities?:string[];isDefault?:boolean};
export class CatalogClient{
 child:ChildProcessWithoutNullStreams;private seq=0;private pending=new Map<number,{resolve:(v:any)=>void;reject:(e:Error)=>void;timer:NodeJS.Timeout}>();
 constructor(exe:string,home:string){this.child=spawn(exe,['app-server'],{env:{...process.env,CODEX_HOME:home},stdio:'pipe',windowsHide:true});
 this.child.stderr.resume();createInterface({input:this.child.stdout}).on('line',line=>{try{const m=JSON.parse(line);const p=this.pending.get(m.id);if(p){clearTimeout(p.timer);this.pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}catch{}});
 this.child.on('error',e=>this.fail(e));this.child.on('exit',()=>this.fail(Error('Codex app-server exited')));}
 private fail(e:Error){for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(e);}this.pending.clear();}
 request(method:string,params:unknown):Promise<any>{const id=++this.seq;return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.pending.delete(id);reject(Error('Codex metadata deadline: '+method));this.close();},30000);this.pending.set(id,{resolve,reject,timer});this.child.stdin.write(JSON.stringify({id,method,params})+'\n');});}
 async init(){await this.request('initialize',{clientInfo:{name:'nightshift',title:'Nightshift',version:'0.1.0'},capabilities:null});this.child.stdin.write(JSON.stringify({method:'initialized',params:{}})+'\n');}
 async account(){return this.request('account/read',{refreshToken:false});}
 async models(){let cursor:string|null=null;const models:Model[]=[];do{const r=await this.request('model/list',{cursor,limit:100,includeHidden:false});models.push(...r.data);cursor=r.nextCursor??null;}while(cursor);return models.filter(m=>!m.hidden);}
 close(){this.child.kill();this.fail(Error('Metadata client closed'));}
}
export function verifyAccount(account:any,allowed:string){if(account?.type!=='chatgpt')throw Error('A ChatGPT subscription login is required; API billing is not a fallback');if(!account.email)return false;if(account.email.toLowerCase()!==allowed.toLowerCase())throw Error('Authenticated email differs from selected allowlisted identity');return true;}
export function resolveEffort(model:Model,wanted:string){const efforts=model.supportedReasoningEfforts.map(e=>e.reasoningEffort);if(wanted==='lowest'){const order=['none','minimal','low','medium','high','xhigh'];const choice=order.find(e=>efforts.includes(e));if(choice)return choice;}if(efforts.includes(wanted))return wanted;throw Error('Model does not support requested reasoning effort');}
