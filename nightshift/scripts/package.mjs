import {readdir,mkdir,readFile,writeFile,cp,rm,chmod} from 'node:fs/promises';
import path from 'node:path';import {createHash} from 'node:crypto';import {spawnSync} from 'node:child_process';
const root=process.cwd(),dist=path.join(root,'dist'),out=path.join(dist,'Nightshift');
await mkdir(dist,{recursive:true});await rm(out,{recursive:true,force:true});await mkdir(out);
// Explicit distribution allowlist: no arbitrary USB files, auth, profiles or developer caches.
for(const entry of ['START.cmd','Start-Lab.ps1','README.md','package.json','package-lock.json','tsconfig.json','config','plugins','tasks','runtime','tests','scripts','docs','vendor','build'])await cp(path.join(root,entry),path.join(out,entry),{recursive:true,filter:p=>!p.endsWith('.local.json')&&!p.includes('node_modules')&&!p.endsWith('.log')});
const entries=[];async function walk(dir){for(const e of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name))){const p=path.join(dir,e.name);if(e.isSymbolicLink())throw Error('Symlink forbidden in package');if(e.isDirectory())await walk(p);else{const relative=path.relative(out,p).split(path.sep).join('/');entries.push({path:relative,sha256:createHash('sha256').update(await readFile(p)).digest('hex')});}}}
await walk(out);await writeFile(path.join(out,'manifest.json'),JSON.stringify(entries,null,2)+'\n');
const zip=path.join(dist,'Nightshift.zip');await rm(zip,{force:true});const result=spawnSync('python3',['-c',`import pathlib,zipfile,sys\nroot=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED) as z:\n for p in sorted(root.rglob('*')):\n  if p.is_file(): z.write(p,p.relative_to(root.parent))`,out,zip],{stdio:'inherit'});if(result.status!==0)throw Error('ZIP packaging failed');
await writeFile(zip+'.sha256',createHash('sha256').update(await readFile(zip)).digest('hex')+'  Nightshift.zip\n');console.log(`Packaged ${entries.length} hashed files: ${zip}`);
