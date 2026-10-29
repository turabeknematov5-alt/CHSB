import http from 'node:http';
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
export async function startDemo(){const html=await readFile(fileURLToPath(new URL('../../../tasks/demo/index.html',import.meta.url)).replace('/build/tasks/','/tasks/'),'utf8').catch(()=>readFile(fileURLToPath(new URL('./index.html',import.meta.url)),'utf8'));
 const server=http.createServer((req,res)=>{if(req.url?.startsWith('/image')){setTimeout(()=>{res.setHeader('Content-Type','image/svg+xml');res.end('<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><text x="4" y="25">2 + 2 = ?</text></svg>');},180);return;}res.setHeader('Content-Type','text/html; charset=utf-8');res.end(html);});
 await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));const a=server.address() as {port:number};return {url:`http://127.0.0.1:${a.port}`,close:()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};}
