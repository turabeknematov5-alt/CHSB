import {readFile,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline/promises';
import {CatalogClient,verifyAccount,resolveEffort,type Model} from './catalog.js';
const [exe,home,email,output]=process.argv.slice(2);const client=new CatalogClient(exe,home);const terminal=createInterface({input:process.stdin,output:process.stdout});
try{
 await client.init();const result=await client.account();
 if(!verifyAccount(result.account,email)){if(await terminal.question(`CLI cannot expose a verifiable email. Confirm you signed in as ${email} by typing that exact email: `)!==email)throw Error('Account confirmation declined');console.log('Account allowlist is user-confirmed, not technically verified.');}
 const models=await client.models();if(!models.length)throw Error('No account models available');
 const cfg=JSON.parse(await readFile('config/models.json','utf8'));
 cfg.presets.forEach((p:any,i:number)=>console.log(`${i+1}. ${p.label} / cleanup: ${p.cleanup}`));
 const preset=cfg.presets[Number(await terminal.question('Preset number: '))-1];if(!preset)throw Error('Invalid preset');
 const wanted=models.filter(m=>preset.desiredNames.some((n:string)=>n.toLowerCase()===m.displayName.toLowerCase()));
 let choices:Model[]=wanted;
 if(preset.requireExplicitModelChoice||!wanted.length){if(!wanted.length&&!preset.requireExplicitModelChoice)console.log('Requested display model is unavailable. Choose an explicit alternative or cancel. No silent substitution.');choices=models;}
 choices.forEach((m,i)=>console.log(`${i+1}. ${m.displayName} [${m.model}] efforts=${m.supportedReasoningEfforts.map(e=>e.reasoningEffort).join(',')}`));
 const model=choices[Number(await terminal.question('Explicit model choice (blank cancels): '))-1];if(!model)throw Error('No model selected');const effort=resolveEffort(model,preset.effort);
 console.log(`Effective model: ${model.model}; reasoning: ${effort}. Subscription allowances apply; no API billing fallback.`);
 await writeFile(output,JSON.stringify({account:email,identityVerified:!!result.account.email,preset:preset.label,model:model.model,effort,images:model.inputModalities?.includes('image')??false,cleanup:preset.cleanup},null,2));
} catch(e){console.error((e as Error).message);process.exitCode=1;}finally{client.close();terminal.close();}
