import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {normalizeAccess,prepareEdits,applyEdits,validateEditResponse,editSchema} from '../src/edits.mjs';
import {argsFor,parseEditResponse,invoke} from '../src/bridge.mjs';
import {createDiscussions} from '../src/discussion.mjs';
import {createTranscriptWriter} from '../src/records.mjs';
async function fixture(run) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bridge-edits-'));
  try{const cwd=path.join(dir,'project'),backup_directory=path.join(dir,'backups');await fs.mkdir(cwd);await fs.writeFile(path.join(cwd,'file.js'),'original\n');await run({dir,cwd,backup_directory});}
  finally{if(!path.resolve(dir).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Unsafe cleanup');await fs.rm(dir,{recursive:true,force:true});}
}

test('empty edit output is a no-op without backups',async()=>fixture(async({cwd})=>{
  const s=await prepareEdits({cwd,edit_files:['file.js']});
  const r=await applyEdits(s,{reply:'already correct',edits:[]});
  assert.equal(r.status,'no-changes');assert.deepEqual(r.changes,[]);assert.equal(await fs.readFile(path.join(cwd,'file.js'),'utf8'),'original\n');
}));
test('rollback preserves an external change and reports partial application',async()=>fixture(async({cwd,backup_directory})=>{
  const s=await prepareEdits({cwd,edit_files:['file.js','new.txt']});let writes=0;
  const r=await applyEdits(s,{reply:'fix',edits:[{path:'file.js',content:'peer'},{path:'new.txt',content:'new'}]},{backup_directory,writeFile:async(base,name,content)=>{
    if(++writes===2){await fs.writeFile(path.join(base,'file.js'),'external edit');throw Error('disk failure');}
    await fs.writeFile(path.join(base,name),content);
  }});
  assert.equal(r.status,'partial');assert.equal(r.rolled_back,false);assert.equal(r.changes[0].path,'file.js');assert.match(r.rollback_errors[0],/preserved/);
  assert.equal(await fs.readFile(path.join(cwd,'file.js'),'utf8'),'external edit');
}));

test('edit access requires explicit authorization and a valid bounded scope',async()=>{
  assert.equal(normalizeAccess().access,'read-only');
  for(const input of [{access:'edit'},{edit_files:['file.js']},{access:'bypass'},{access:'edit',edit_files:['../outside']},{access:'edit',edit_files:['.env']},{access:'edit',edit_files:['.codex/config.toml']},{access:'edit',edit_files:['AGENTS.md']},{access:'edit',edit_files:['file.js','file.js']}])assert.throws(()=>normalizeAccess(input));
  await assert.rejects(invoke({peer:'codex',mode:'review',cwd:os.tmpdir(),access:'edit',edit_files:['file.js']}),/only available/);
});
test('approved modifications and new files are applied and backed up',async()=>fixture(async({cwd,backup_directory})=>{
  await fs.writeFile(path.join(cwd,'manifest.json'),'{}\n');
  const session=await prepareEdits({cwd,edit_files:['file.js','nested/new.txt','manifest.json']});
  const result=await applyEdits(session,{reply:'fix',edits:[{path:'file.js',content:'fixed\n'},{path:'nested/new.txt',content:'新文件\n'},{path:'manifest.json',content:'{"fixed":true}\n'}]},{backup_directory});
  assert.equal(result.status,'applied');assert.equal(result.changes.length,3);
  assert.deepEqual([result.changes[0].added,result.changes[0].removed],[1,1]);assert.match(result.changes[0].diff,/^-original$/m);assert.match(result.changes[0].diff,/^\+fixed$/m);
  assert.match(result.changes[1].diff,/^--- \/dev\/null\n\+\+\+ b\/nested\/new\.txt\n@@ -0,0 \+1,1 @@/);
  assert.equal(await fs.readFile(path.join(cwd,'file.js'),'utf8'),'fixed\n');
  assert.equal(await fs.readFile(path.join(cwd,'nested/new.txt'),'utf8'),'新文件\n');
  assert.equal(await fs.readFile(path.join(result.backup_path,'files/file.js'),'utf8'),'original\n');
  const manifest=JSON.parse(await fs.readFile(path.join(result.backup_path,'manifest.json'),'utf8'));
  assert.equal(manifest[1].before_sha256,null);assert.match(manifest[0].after_sha256,/^[a-f0-9]{64}$/);
}));
test('unauthorized, duplicate, binary and oversized outputs do not cause any writes',async()=>fixture(async({cwd,backup_directory})=>{
  const session=await prepareEdits({cwd,edit_files:['file.js']});
  for(const extra of [{path:'other.js',content:'bad'},{path:'../outside',content:'bad'},{path:'.env',content:'bad'},{path:'file.js',content:'bad'}]){
    const r=await applyEdits(session,{reply:'fix',edits:[{path:'file.js',content:'changed'},extra]},{backup_directory});assert.equal(r.status,'rejected');assert.equal(await fs.readFile(path.join(cwd,'file.js'),'utf8'),'original\n');
  }
  assert.throws(()=>validateEditResponse({reply:'x',edits:[{path:'x',content:'汉'.repeat(40000)}]}),/limits/);
  assert.throws(()=>validateEditResponse({reply:'x',edits:[{path:'x',content:'\0'}]}),/content/);
}));
test('host changes and new-file collisions reject the whole batch',async()=>fixture(async({cwd,backup_directory})=>{
  const session=await prepareEdits({cwd,edit_files:['file.js','new.txt']});await fs.writeFile(path.join(cwd,'new.txt'),'host version');
  const r=await applyEdits(session,{reply:'fix',edits:[{path:'file.js',content:'peer version'},{path:'new.txt',content:'peer new'}]},{backup_directory});
  assert.equal(r.status,'conflict');assert.deepEqual(r.changes,[]);assert.equal(await fs.readFile(path.join(cwd,'file.js'),'utf8'),'original\n');assert.equal(await fs.readFile(path.join(cwd,'new.txt'),'utf8'),'host version');
}));
test('junctions and hard links cannot redirect the editable scope',async()=>fixture(async({dir,cwd})=>{
  const outside=path.join(dir,'outside');await fs.mkdir(outside);await fs.writeFile(path.join(outside,'secret.txt'),'keep');
  await fs.symlink(outside,path.join(cwd,'linked'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(prepareEdits({cwd,edit_files:['linked/secret.txt']}),/links|junctions/);
  await fs.link(path.join(outside,'secret.txt'),path.join(cwd,'hard.txt'));await assert.rejects(prepareEdits({cwd,edit_files:['hard.txt']}),/single-linked/);
  assert.equal(await fs.readFile(path.join(outside,'secret.txt'),'utf8'),'keep');
}));
test('backup failure prevents writes; mid-batch failure rolls back prior changes',async()=>fixture(async({dir,cwd,backup_directory})=>{
  const s=await prepareEdits({cwd,edit_files:['file.js','new.txt']}),response={reply:'fix',edits:[{path:'file.js',content:'changed'},{path:'new.txt',content:'new'}]};
  const unavailable=path.join(dir,'not-a-directory');await fs.writeFile(unavailable,'x');
  const failed=await applyEdits(s,response,{backup_directory:unavailable});assert.equal(failed.status,'failed');assert.equal(await fs.readFile(path.join(cwd,'file.js'),'utf8'),'original\n');
  let writes=0;const interrupted=await applyEdits(s,response,{backup_directory,writeFile:async(base,name,content)=>{if(++writes===2)throw Error('simulated disk failure');await fs.writeFile(path.join(base,name),content);}});
  assert.equal(interrupted.status,'failed');assert.equal(interrupted.rolled_back,true);assert.equal(await fs.readFile(path.join(cwd,'file.js'),'utf8'),'original\n');assert(!(await fs.readdir(cwd)).includes('new.txt'));
}));
test('both structured CLI formats work without native workspace or shell access',()=>{
  const v={reply:'fixed',edits:[{path:'file.js',content:'updated'}]};
  assert.deepEqual(parseEditResponse('claude',JSON.stringify({structured_output:v,modelUsage:{opus:{}}})),{...v,reported_models:['opus']});
  assert.equal(parseEditResponse('codex',JSON.stringify({type:'item.completed',item:{type:'agent_message',text:JSON.stringify(v)}})).reply,'fixed');
  const cx=argsFor('codex',{}, {schema:editSchema,schema_path:'C:/temp/schema.json'});assert(cx.includes('--output-schema'));assert(cx.includes('read-only'));assert(cx.includes('shell_tool'));
  const cc=argsFor('claude',{}, {schema:editSchema});assert(cc.includes('--json-schema'));assert.equal(cc[cc.indexOf('--tools')+1],'');
});
test('permissions cannot escalate or widen; changes and conflicts are recorded',async()=>fixture(async({cwd,dir})=>{
  const calls=[],saveRecord=createTranscriptWriter(path.join(dir,'records'));
  const discuss=createDiscussions(async i=>{calls.push(i);return {result:'answer',edit_result:{status:'applied',changes:[{path:'file.js',operation:'modify'}]}};},{saveRecord});
  const base={peer:'claude',objective:'fix',host_message:'evidence',cwd,max_rounds:3},readonly=await discuss(base);
  await assert.rejects(discuss({peer:'claude',action:'continue',session_id:readonly.session_id,host_message:'x',access:'edit',edit_files:['file.js']}),/immutable/);
  const first=await discuss({...base,access:'edit',edit_files:['file.js']});assert.equal(first.read_only,false);assert.equal(calls.at(-1).access,'edit');
  await assert.rejects(discuss({peer:'claude',action:'continue',session_id:first.session_id,host_message:'x',edit_files:['file.js','new.js']}),/immutable/);
  const md=await fs.readFile(first.record.markdown_path,'utf8');assert.match(md,/\*\*权限\*\*：可修改 `file\.js`/);assert.match(md,/修改结果：已写入/);assert.match(md,/\| `file\.js` \| 修改 \|/);
  const failing=createDiscussions(async()=>({result:'proposed',edit_result:{status:'conflict',changes:[],error:'host changed'}}));
  const result=await failing({...base,access:'edit',edit_files:['file.js']});assert.equal(result.stop_reason,'edit-failed');assert.equal(result.rounds_used,1);assert.equal(result.transcript.at(-1).edit_result.status,'conflict');
}));
