import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {root} from '../src/bridge.mjs';
const peer=process.argv[2];
if(!['claude','codex'].includes(peer))throw Error('Usage: node scripts/Edit-Demo.mjs claude|codex');
const local=path.join(root,'.local');await fs.mkdir(local,{recursive:true});
const project=await fs.mkdtemp(path.join(local,'edit-demo-'+peer+'-'));
await fs.copyFile(path.join(root,'demo/bug.js'),path.join(project,'bug.js'));
const client=new Client({name:'edit-demo',version:'1'});
try {
  await client.connect(new StdioClientTransport({command:process.execPath,args:[path.join(root,'src/server.mjs'),'--peer='+peer],env:process.env}));
  const answer=await client.callTool({name:peer+'_discuss',arguments:{
    objective:'Fix average([]) to throw RangeError instead of returning NaN, keep all other behavior. Create note.txt with one short sentence explaining the fix.',
    host_message:'The empty-array division returns NaN. I authorize updating bug.js and creating note.txt only. Add an explicit empty-array guard; return complete file contents. Do not run commands.',
    cwd:project,max_rounds:1,include_diff:false,access:'edit',edit_files:['bug.js','note.txt'],timeout_ms:300000
  }},undefined,{timeout:360000});
  const result=JSON.parse(answer.content[0].text);await fs.writeFile(path.join(local,'edit-demo-'+peer+'.json'),JSON.stringify({project,result},null,2));
  assert.equal(answer.isError,false,JSON.stringify(result));
  const edit=result.transcript.at(-1).edit_result;assert.equal(edit.status,'applied',JSON.stringify(edit));assert.equal(edit.changes.length,2);
  assert.match(await fs.readFile(path.join(project,'bug.js'),'utf8'),/RangeError/);assert((await fs.readFile(path.join(project,'note.txt'),'utf8')).trim());
  console.log(JSON.stringify({peer,status:edit.status,project,changes:edit.changes,record:result.record,code:await fs.readFile(path.join(project,'bug.js'),'utf8')},null,2));
}finally{await client.close();}
