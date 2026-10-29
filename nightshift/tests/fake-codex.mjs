#!/usr/bin/env node
import {writeFileSync} from 'node:fs';
const args=process.argv.slice(2);
if(args[0]==='app-server'){
 let input='';process.stdin.on('data',chunk=>{input+=chunk;let n;while((n=input.indexOf('\n'))>=0){const line=input.slice(0,n);input=input.slice(n+1);const m=JSON.parse(line);if(m.id){let result={};if(m.method==='account/read')result={account:{type:'chatgpt',email:'test@example.com'}};if(m.method==='model/list')result={data:[{id:'fixture',model:'fixture-model',displayName:'Fixture',supportedReasoningEfforts:[{reasoningEffort:'low'}],inputModalities:['text','image']}],nextCursor:null};process.stdout.write(JSON.stringify({id:m.id,result})+'\n');}}});
}else{
 let input='';process.stdin.on('data',c=>input+=c);process.stdin.on('end',()=>{
  const q=JSON.parse(input.slice(input.lastIndexOf('\n')+1));
  const get=k=>args[args.indexOf(k)+1];const configs=args.flatMap((v,i)=>v==='-c'?[args[i+1]]:[]);
  if(get('-m')!=='fixture-model'||!configs.includes('model_reasoning_effort="low"')||!args.includes('--output-schema')||!args.includes('--ignore-user-config')||!configs.includes('features.shell_tool=false')||process.env.CODEX_HOME!==process.env.FIXTURE_HOME)process.exit(9);
  if(q.images.length&&(!args.includes('--image')||get('--image')!==q.images[0].localPath))process.exit(10);
  if(q.text==='timeout')return setTimeout(()=>process.exit(4),10000);
  writeFileSync(get('--output-last-message'),JSON.stringify({questionId:q.questionId,status:'answered',selectedChoiceIds:['b'],explanation:'fixture',uncertainty:null}));
 });
}
