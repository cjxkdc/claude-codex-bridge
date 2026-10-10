import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {discoverChats,findChats,matchChats,prepareAttachments,resumeArgs,sendToChat} from '../src/chats.mjs';

async function fixture(peer='codex'){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bridge-chat-test-'));const source=path.join(dir,'source');await fs.mkdir(source);await fs.writeFile(path.join(source,'文件.txt'),'HANDOFF_TEST 中文 $(echo no)');
 const id=randomUUID(),file=path.join(dir,id+'.jsonl');
 const data=peer==='codex'?[{type:'session_meta',payload:{id,cwd:source,source:'cli'}},{type:'event_msg',payload:{type:'task_started'}},{type:'event_msg',payload:{type:'task_complete'}}]:[{type:'user',sessionId:id,cwd:source,timestamp:'2026-10-10T01:00:00Z',message:{content:'Hello'}},{type:'assistant',sessionId:id,timestamp:'2026-10-10T01:00:01Z',message:{stop_reason:'end_turn',content:[]}},{type:'custom-title',sessionId:id,customTitle:'搭建双向 Claude Codex 审核桥'}];
 await fs.writeFile(file,data.map(x=>JSON.stringify(x)).join('\n')+'\n');
 const target={id,file,cwd:source,title:'搭建双向 Claude Codex 审核桥',updated_at:'2026-10-10T01:00:00Z'};
 const deps={storageRoot:dir,cfg:{profile:dir},discover:async()=>({chats:[target],warnings:[]})};
 const selection=await findChats({peer,query:target.title},deps);
 const input={peer,selection_token:selection.candidates[0].selection_token,cwd:source,files:['文件.txt'],message:'请收下'};
 return {dir,source,id,file,target,deps,input,cleanup:()=>fs.rm(dir,{recursive:true,force:true})};
}
test('name matching normalizes punctuation/case and never silently picks fuzzy or duplicate names',()=>{
 const a={id:randomUUID(),title:'搭建双向 Claude Codex 审核桥',updated_at:'2026-10-10'},b={id:randomUUID(),title:'别的项目',updated_at:'2026-10-09'};
 assert.equal(matchChats([a,b],'搭建双向 claude—codex审核桥').status,'ready');
 assert.equal(matchChats([a,b],'双向审核桥').status,'needs_confirmation');
 assert.equal(matchChats([a,{...a,id:randomUUID()}],a.title).status,'needs_confirmation');
 assert.equal(matchChats([a,b],b.id).matches[0].id,b.id);
 assert.equal(matchChats([a,b],'ZZZZZZZZZZZZ').status,'not_found');
});
test('Windows project filters accept namespaced paths and different path casing', {skip:process.platform!=='win32'},async()=>{
 const f=await fixture();try{const r=await findChats({peer:'codex',query:f.target.title,project:f.source},{...f.deps,discover:async()=>({chats:[{...f.target,cwd:path.toNamespacedPath(f.source).toUpperCase()}],warnings:[]})});assert.equal(r.status,'ready');}finally{await f.cleanup();}
});
test('discovery reads native titles and IDs while excluding archived and nested agent sessions',async()=>{
 const f=await fixture('claude');try{
  const chome=path.join(f.dir,'.claude'),project=path.join(chome,'projects','test-project');await fs.mkdir(project,{recursive:true});await fs.copyFile(f.file,path.join(project,f.id+'.jsonl'));
  await fs.mkdir(path.join(project,'subagents'));await fs.writeFile(path.join(project,'subagents','nested.jsonl'),'{}');
  const cc=await discoverChats('claude',{profile:f.dir});assert.equal(cc.chats.length,1);assert.equal(cc.chats[0].title,f.target.title);assert.equal(cc.chats[0].active,false);
  const cxhome=path.join(f.dir,'.codex'),cxid=randomUUID(),cxfile=path.join(cxhome,'sessions','rollout-'+cxid+'.jsonl');await fs.mkdir(path.dirname(cxfile),{recursive:true});await fs.writeFile(cxfile,[{type:'session_meta',payload:{id:cxid,cwd:f.source,source:'cli'}},{type:'event_msg',payload:{type:'task_complete'}}].map(x=>JSON.stringify(x)).join('\n')+'\n');
  await fs.writeFile(path.join(cxhome,'session_index.jsonl'),JSON.stringify({id:cxid,thread_name:'Old title'})+'\n'+JSON.stringify({id:cxid,thread_name:'New title'})+'\n');
  const cx=await discoverChats('codex',{profile:f.dir});assert.equal(cx.chats.length,1);assert.equal(cx.chats[0].title,'New title');
  let DatabaseSync;try{({DatabaseSync}=await import('node:sqlite'));}catch{return;}
  const db=new DatabaseSync(path.join(cxhome,'state_5.sqlite'));db.exec('CREATE TABLE threads(id TEXT,title TEXT,cwd TEXT,rollout_path TEXT,archived INTEGER,source TEXT)');const insert=db.prepare('INSERT INTO threads VALUES(?,?,?,?,?,?)');insert.run(cxid,'DB title',f.source,path.toNamespacedPath(cxfile),0,'cli');insert.run(randomUUID(),'Archived',f.source,cxfile,1,'cli');insert.run(randomUUID(),'Subagent',f.source,cxfile,0,'subAgent');db.close();
  assert.equal((await discoverChats('codex',{profile:f.dir})).chats.length,1);
 }finally{await f.cleanup();}
});
test('ambiguity requires an explicit user choice before any copying or CLI call',async()=>{
 const f=await fixture();try{const selection=await findChats({peer:'codex',query:'双向审核桥'},f.deps);let calls=0;const input={...f.input,selection_token:selection.candidates[0].selection_token};const result=await sendToChat(input,{...f.deps,run:async()=>{calls++;}});assert.equal(result.status,'needs_confirmation');assert.equal(calls,0);await assert.rejects(fs.stat(path.join(f.dir,'.local/chat-deliveries',input.selection_token)),{code:'ENOENT'});}finally{await f.cleanup();}
});
test('both peers resume the selected native ID, deliver exact bytes and return a durable replayable receipt',async()=>{
 for(const peer of ['codex','claude']){const f=await fixture(peer);try{
  let calls=0,prompt,args;const run=async(exe,a,p,options)=>{calls++;args=a;prompt=p;assert.equal(options.cwd,f.source);return peer==='claude'?JSON.stringify({session_id:f.id,result:'收到 文件.txt'}):JSON.stringify({type:'thread.started',thread_id:f.id})+'\n'+JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'收到 文件.txt'}});};
  const r=await sendToChat(f.input,{...f.deps,run});assert.equal(r.status,'received');assert.equal(r.target.session_id,f.id);assert(args.includes(f.id));assert(!args.includes('--ephemeral'));assert(!args.includes('--no-session-persistence'));assert(prompt.includes('HANDOFF_TEST 中文 $(echo no)'));
  assert.equal(await fs.readFile(r.files[0].snapshot_path,'utf8'),await fs.readFile(path.join(f.source,'文件.txt'),'utf8'));assert.equal(r.files[0].content_mode,'inline-utf8');assert((await fs.readFile(r.record.markdown_path,'utf8')).includes('收到 文件.txt'));
  const replay=await sendToChat(f.input,{...f.deps,run});assert.equal(replay.replayed,true);assert.equal(calls,1);
  await assert.rejects(sendToChat({...f.input,message:'different payload'},{...f.deps,run}),/already used/);
 }finally{await f.cleanup();}}
});
test('busy native turns block delivery and allow retry when they finish',async()=>{
 const f=await fixture();try{await fs.appendFile(f.file,JSON.stringify({type:'event_msg',payload:{type:'task_started'}})+'\n');let calls=0;const run=async()=>{calls++;return '';};const r=await sendToChat(f.input,{...f.deps,run});assert.equal(r.status,'target_busy');assert.equal(calls,0);await assert.rejects(fs.stat(path.join(f.dir,'.local/chat-deliveries',f.input.selection_token)),{code:'ENOENT'});}finally{await f.cleanup();}
});
test('expired selections, another peer, renamed chats and recursion cannot send',async()=>{
 const f=await fixture();try{
  const selectionFile=path.join(f.dir,'.local/chat-selections',f.input.selection_token+'.json');const ticket=JSON.parse(await fs.readFile(selectionFile,'utf8'));await fs.writeFile(selectionFile,JSON.stringify({...ticket,expires_at:'2000-01-01'}));await assert.rejects(sendToChat(f.input,f.deps),/expired/);
  await fs.writeFile(selectionFile,JSON.stringify(ticket));await assert.rejects(sendToChat({...f.input,peer:'claude'},f.deps),/another peer/);
  const changed=await sendToChat(f.input,{...f.deps,discover:async()=>({chats:[{...f.target,title:'Renamed'}]})});assert.equal(changed.status,'target_changed');
  process.env.AGENT_PEER_DEPTH='1';try{await assert.rejects(findChats({peer:'codex',query:'anything'},f.deps),/Recursive/);await assert.rejects(sendToChat(f.input,f.deps),/Recursive/);}finally{delete process.env.AGENT_PEER_DEPTH;}
 }finally{await f.cleanup();}
});
test('failure or a mismatched resumed ID is unconfirmed and is never retried automatically',async()=>{
 const f=await fixture();try{let calls=0;const run=async()=>{calls++;throw Error('simulated timeout after possible delivery');};const r=await sendToChat(f.input,{...f.deps,run});assert.equal(r.status,'unconfirmed');assert((await fs.readFile(r.record.json_path,'utf8')).includes('simulated timeout'));assert.equal((await sendToChat(f.input,{...f.deps,run})).replayed,true);assert.equal(calls,1);}finally{await f.cleanup();}
 const g=await fixture('claude');try{const r=await sendToChat(g.input,{...g.deps,run:async()=>JSON.stringify({session_id:randomUUID(),result:'received'})});assert.equal(r.status,'unconfirmed');assert.match(r.error,/requested session ID/);}finally{await g.cleanup();}
});
test('binary and large files are copied without inventing inline content',async()=>{
 const f=await fixture();try{await fs.writeFile(path.join(f.source,'binary.pdf'),Buffer.from([0,255,1,2]));await fs.writeFile(path.join(f.source,'large.txt'),'x'.repeat(100001));const list=await prepareAttachments(f.source,['binary.pdf','large.txt'],path.join(f.dir,'copies'));assert(list.every(a=>a.text===null&&a.content_mode==='local-file-reference'));assert.deepEqual(await fs.readFile(list[0].snapshot_path),Buffer.from([0,255,1,2]));}finally{await f.cleanup();}
});
test('whole batch is validated before copies; traversal, secrets, duplicates and links are refused',async()=>{
 const f=await fixture();try{await fs.writeFile(path.join(f.source,'.env'),'secret');await fs.writeFile(path.join(f.dir,'outside'),'outside');for(const files of [['文件.txt','.env'],['../outside'],['文件.txt','文件.txt']]){const destination=path.join(f.dir,randomUUID());await assert.rejects(prepareAttachments(f.source,files,destination));await assert.rejects(fs.stat(destination),{code:'ENOENT'});}await fs.link(path.join(f.dir,'outside'),path.join(f.source,'link.txt'));await assert.rejects(prepareAttachments(f.source,['link.txt'],path.join(f.dir,'link-copy')),/hard links/);}finally{await f.cleanup();}
});
test('simultaneous different selections for one target cannot resume it twice',async()=>{
 const f=await fixture();try{const second=await findChats({peer:'codex',query:f.target.title},f.deps);let entered,finish;const gate=new Promise(r=>entered=r),done=new Promise(r=>finish=r);const run=async()=>{entered();await done;return JSON.stringify({type:'thread.started',thread_id:f.id})+'\n'+JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'ok'}});};const first=sendToChat(f.input,{...f.deps,run});await gate;await assert.rejects(sendToChat({...f.input,selection_token:second.candidates[0].selection_token},{...f.deps,run}),/another bridge delivery/);finish();assert.equal((await first).status,'received');}finally{await f.cleanup();}
});
test('resumed invocation keeps tools disabled and uses stdin instead of shell interpolation',()=>{
 const id=randomUUID();const c=resumeArgs('codex',id,{model:'gpt-6.1-sol',effort:'high'});assert(c.includes('read-only'));assert(c.includes('shell_tool'));assert.equal(c.at(-1),'-');assert(c.includes('resume'));const a=resumeArgs('claude',id,{model:'sonnet'});assert.equal(a[a.indexOf('--tools')+1],'');assert(a.includes('--strict-mcp-config'));assert(a.includes('--resume'));assert.throws(()=>resumeArgs('codex','--last'),/Invalid/);
});
