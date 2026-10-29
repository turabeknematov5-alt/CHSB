import {readdir,readFile} from 'node:fs/promises';
import path from 'node:path';
export async function discover(root:string,capabilities:string[]){const tasks=[];for(const d of await readdir(path.join(root,'tasks'),{withFileTypes:true})){if(!d.isDirectory())continue;const m=JSON.parse(await readFile(path.join(root,'tasks',d.name,'task.json'),'utf8'));const missing=m.requires.filter((c:string)=>!capabilities.includes(c));tasks.push({...m,folder:d.name,compatible:missing.length===0,missing});}return tasks;}
