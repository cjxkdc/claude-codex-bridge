import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createDiscussions} from '../src/discussion.mjs';
import {createTranscriptWriter} from '../src/records.mjs';
const start={peer:'claude',objective:'Debug 空数组',host_message:'我的初步判断\n````\n<script>example</script>',cwd:path.resolve('demo'),max_rounds:2};
async function withRecords(run) {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'bridge-records-'));
  try {await run(directory,createTranscriptWriter(directory));}
  finally {
    if(!path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Cleanup path escapes temporary directory');
    await fs.rm(directory,{recursive:true,force:true});
  }
}
test('records save before a peer call and update both formats with all rounds',async()=>withRecords(async(directory,saveRecord)=>{
  let calls=0;
  const discuss=createDiscussions(async()=>{
    const file=(await fs.readdir(directory)).find(name=>name.endsWith('.json'));
    const pending=JSON.parse(await fs.readFile(path.join(directory,file),'utf8'));
    assert.equal(pending.transcript.at(-1).speaker,'host');assert.equal(pending.rounds_used,++calls);
    return {result:`回复 ${calls}\n\`\`\`js\nconst value=0;\n\`\`\``};
  },{saveRecord});
  const first=await discuss(start);
  assert.equal(first.record.save_status,'saved');
  const second=await discuss({peer:'claude',action:'continue',session_id:first.session_id,host_message:'已经验证，请收敛方案'});
  assert.equal(second.record.markdown_path,first.record.markdown_path);
  const stored=JSON.parse(await fs.readFile(second.record.json_path,'utf8'));
  assert.equal(stored.schema_version,1);assert.equal(stored.status,'closed');assert.equal(stored.transcript.length,4);
  assert.deepEqual(stored.transcript,second.transcript);
  const markdown=await fs.readFile(second.record.markdown_path,'utf8');
  assert(markdown.includes('第 1 轮 · Codex'));assert(markdown.includes('第 2 轮 · Claude Code'));
  assert(markdown.includes(start.host_message+'\n````\n'));assert(markdown.includes('## 最后一轮回复 · Claude Code\n\n回复 2'));
  assert(markdown.includes('*内容见上方「最后一轮回复」。*'));assert(markdown.includes('```js\nconst value=0;\n```'));
  assert.equal((await fs.readdir(directory)).length,2);assert.equal(calls,2);
}));
test('error and early-finish records remain readable after expiry or restart',async()=>withRecords(async(directory,saveRecord)=>{
  let time=0;
  const failed=createDiscussions(async()=>{throw Error('subscription login required');},{saveRecord,now:()=>time});
  const error=await failed(start);
  const storedError=JSON.parse(await fs.readFile(error.record.json_path,'utf8'));
  assert.equal(storedError.stop_reason,'peer-error');assert.equal(storedError.transcript[1].kind,'error');
  const working=createDiscussions(async()=>({result:'同意，请验证输入契约'}),{saveRecord,now:()=>time});
  const first=await working(start);
  const final=await working({peer:'claude',action:'finish',session_id:first.session_id,host_message:'决定先验证调用方'});
  const before=await fs.readFile(final.record.json_path,'utf8');assert.equal(JSON.parse(before).transcript.at(-1).kind,'conclusion');
  time=3600001;
  await assert.rejects(working({peer:'claude',action:'status',session_id:first.session_id}),/expired/);
  const restarted=createDiscussions(async()=>({result:'unused'}),{saveRecord});
  await assert.rejects(restarted({peer:'claude',action:'status',session_id:first.session_id}),/Unknown/);
  assert.equal(await fs.readFile(final.record.json_path,'utf8'),before);assert.equal((await fs.readdir(directory)).length,4);
}));
test('a disk-write failure is visible without dropping replies or extending the budget',async()=>{
  let calls=0;
  const discuss=createDiscussions(async()=>{calls++;return {result:'实际回复'};},{saveRecord:async()=>{throw Error('EACCES: output directory is read-only');}});
  const result=await discuss({...start,max_rounds:1});
  assert.equal(result.status,'closed');assert.equal(result.stop_reason,'round-limit');assert.equal(calls,1);
  assert.equal(result.transcript[1].text,'实际回复');assert.equal(result.record.save_status,'failed');assert.match(result.record.error,/EACCES/);
});
test('record filenames cannot be redirected by a supplied session ID',async()=>withRecords(async(directory,saveRecord)=>{
  await assert.rejects(saveRecord({session_id:'../outside',created_at:new Date().toISOString()}),/Invalid/);
  assert.deepEqual(await fs.readdir(directory),[]);
}));
