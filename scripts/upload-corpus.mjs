// Credentials are accepted on stdin only, never written to disk or logged.
import {readFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
if(process.stdin.isTTY)process.stdin.setRawMode(true);
process.stdout.write('Ready for private corpus upload JSON on stdin.\n');
const rl=createInterface({input:process.stdin,terminal:false});
rl.once('line',async line=>{rl.close();try{const {url,serviceToken,adminToken,path}=JSON.parse(line);const response=await fetch(new URL('/api/corpus',url),{method:'POST',headers:{'Content-Type':'application/json','OAI-Sites-Authorization':`Bearer ${serviceToken}`,'x-rag-admin-token':adminToken},body:await readFile(path,'utf8')});const body=await response.text();console.log(JSON.stringify({status:response.status,result:JSON.parse(body)}));if(!response.ok)process.exitCode=1}catch{console.error('Corpus upload failed');process.exitCode=1}});
