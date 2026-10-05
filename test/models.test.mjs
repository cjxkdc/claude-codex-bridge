import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {argsFor,childEnv,invoke,parseResponse,root} from '../src/bridge.mjs';
import {normalizeOptions} from '../src/models.mjs';
import {createDiscussions} from '../src/discussion.mjs';
import {createTranscriptWriter} from '../src/records.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
const initial={peer:'claude',objective:'Debug',host_message:'initial evidence',cwd:path.resolve('demo'),max_rounds:3,model:'claude-opus-5-5',effort:'high'};
test('explicit model and effort reach both CLI argument lists without weakening isolation',()=>{
  const cc=argsFor('claude',{model:'claude-opus-5-5',effort:'max'});
  assert.equal(cc[cc.indexOf('--model')+1],'claude-opus-5-5');assert.equal(cc[cc.indexOf('--effort')+1],'max');
  assert(cc.includes('--restricted'));assert.equal(cc[cc.indexOf('--tools')+1],'');
  const cx=argsFor('codex',{model:'gpt-6.1-sol',effort:'xhigh'});
  assert.equal(cx[cx.indexOf('--model')+1],'gpt-6.1-sol');assert(cx.includes('model_reasoning_effort="xhigh"'));
  assert.equal(cx.at(-1),'-');assert(cx.includes('read-only'));assert(cx.includes('forced_login_method="chatgpt"'));
  for(const peer of ['claude','codex'])assert.deepEqual(argsFor(peer,{model:'default',effort:'auto'}),argsFor(peer));
  const source={CLAUDE_CODE_EFFORT_LEVEL:'low',claude_code_effort_level:'medium',ANTHROPIC_API_KEY:'private',PATH:'keep'};
  assert.equal(childEnv(source).CLAUDE_CODE_EFFORT_LEVEL,'low');
  const explicit=childEnv(source,{peer:'claude',effort:'high'});
  assert.equal(explicit.CLAUDE_CODE_EFFORT_LEVEL,undefined);assert.equal(explicit.claude_code_effort_level,undefined);
  assert.equal(explicit.ANTHROPIC_API_KEY,undefined);assert.equal(explicit.PATH,'keep');assert.equal(source.CLAUDE_CODE_EFFORT_LEVEL,'low');
});
test('invalid options cannot inject CLI flags or reach a peer process',async()=>{
  for(const model of ['--dangerously-skip-permissions','opus --tools Bash','x\n-c','x"',{},null]) {
    assert.throws(()=>normalizeOptions('claude',{model}),/Invalid model/);
    await assert.rejects(invoke({peer:'codex',model}),/Invalid model/);
  }
  assert.throws(()=>normalizeOptions('claude',{effort:'ultra'}),/Invalid claude effort/);
  assert.throws(()=>normalizeOptions('codex',{effort:'high"\nforced_login_method="api'}),/Invalid/);
  assert.deepEqual(normalizeOptions('codex',{model:'gpt-6-astra',effort:'ultra'}),{model:'gpt-6-astra',effort:'ultra'});
});
test('a discussion remembers selection and an explicit change/reset keeps the round cap',async()=>{
  const calls=[];const discuss=createDiscussions(async input=>{calls.push(input);return {result:'reply',reported_models:['provider-reported-model']};});
  const first=await discuss(initial);
  await assert.rejects(discuss({peer:'claude',action:'continue',session_id:first.session_id,host_message:'x',effort:'ultra'}),/Invalid/);
  const second=await discuss({peer:'claude',action:'continue',session_id:first.session_id,host_message:'new evidence'});
  const third=await discuss({peer:'claude',action:'continue',session_id:first.session_id,host_message:'converge',model:'sonnet',effort:'default'});
  assert.deepEqual(calls.map(c=>[c.model,c.effort]),[['claude-opus-5-5','high'],['claude-opus-5-5','high'],['sonnet',undefined]]);
  assert.deepEqual(second.peer_options,first.peer_options);assert.equal(third.rounds_used,3);assert.equal(third.stop_reason,'round-limit');
  assert.deepEqual(third.peer_options,{model:'sonnet',effort:null});assert.equal(third.transcript[1].peer_options.model,'claude-opus-5-5');
  assert.equal(third.transcript[5].peer_options.model,'sonnet');assert.deepEqual(third.transcript[1].reported_models,['provider-reported-model']);
  assert.equal(calls.length,3);
});
test('saved records retain per-round requested settings and CLI reported model names',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'bridge-models-'));
  try {
    const discuss=createDiscussions(async()=>({result:'reply',reported_models:['claude-opus-5-5']}),{saveRecord:createTranscriptWriter(directory)});
    const first=await discuss(initial);
    const final=await discuss({peer:'claude',action:'continue',session_id:first.session_id,host_message:'switch',model:'sonnet',effort:'medium'});
    const stored=JSON.parse(await fs.readFile(final.record.json_path,'utf8'));
    assert.equal(stored.transcript[1].peer_options.effort,'high');assert.equal(stored.transcript[3].peer_options.effort,'medium');
    const md=await fs.readFile(final.record.markdown_path,'utf8');
    assert(md.includes('请求模型：claude-opus-5-5；请求思考强度：high'));assert(md.includes('请求模型：sonnet；请求思考强度：medium'));
    assert(md.includes('CLI 报告的使用模型'));assert.equal(stored.peer_options.model,'sonnet');
  } finally {
    if(!path.resolve(directory).startsWith(path.resolve(os.tmpdir())+path.sep))throw Error('Cleanup path escapes temp');
    await fs.rm(directory,{recursive:true,force:true});
  }
});
test('response metadata does not pretend a requested model or effort was reported',()=>{
  const cc=parseResponse('claude',JSON.stringify({result:'ok',modelUsage:{'claude-opus-5-5':{inputTokens:10}}}));
  assert.deepEqual(cc,{result:'ok',reported_models:['claude-opus-5-5']});
  const cx=parseResponse('codex',JSON.stringify({type:'item.completed',item:{type:'agent_message',text:'ok'}}));
  assert.equal(cx.reported_models,null);assert.equal(cx.reported_effort,undefined);
});
test('both MCP surfaces advertise peer model and their own supported effort levels',async()=>{
  for(const peer of ['claude','codex']) {
    const client=new Client({name:'model-options-tests',version:'1'});
    const transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'src/server.mjs'),`--peer=${peer}`],env:{...process.env,AGENT_PEER_DEPTH:'1'}});
    try {
      await client.connect(transport);const list=await client.listTools();
      for(const tool of list.tools) {
        assert(tool.inputSchema.properties.model);assert(tool.inputSchema.properties.effort.enum.includes('high'));
        assert.equal(tool.inputSchema.properties.effort.enum.includes('ultra'),peer==='codex');
      }
    } finally {await client.close();}
  }
});
