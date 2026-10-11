import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {collect} from '../src/bridge.mjs';
import {createDiscussions} from '../src/discussion.mjs';
import {renderTranscript} from '../src/records.mjs';
async function folder(run) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bridge-topic-'));
  try {await run(dir);} finally {await fs.rm(dir,{recursive:true,force:true});}
}
const git=(dir,...args)=>execFileSync('git',['-c','user.email=t@t','-c','user.name=t','-c','core.autocrlf=false',...args],{cwd:dir,stdio:'pipe'});
test('topics without local files need no cwd, and files still need one',async()=>{
  assert.equal(await collect({context:'今天吃什么'}),'今天吃什么');
  await assert.rejects(collect({files:['a.txt']}),/Files require cwd/);
  await assert.rejects(collect({cwd:'relative'}),/absolute/);
});
test('a plain folder works with the default include_diff',async()=>folder(async dir=>{
  await fs.writeFile(path.join(dir,'note.txt'),'hello');const warnings=[];
  assert.equal(await collect({cwd:dir,files:['note.txt']},warnings),'\nFILE note.txt\nhello');assert.deepEqual(warnings,[]);
}));
test('repository diffs are included, truncated when oversized, and failures become warnings',async()=>folder(async dir=>{
  git(dir,'init','-q');await fs.writeFile(path.join(dir,'a.txt'),'one\n');git(dir,'add','.');git(dir,'commit','-qm','x');
  await fs.writeFile(path.join(dir,'a.txt'),'two\n');
  let warnings=[];assert.match(await collect({cwd:dir},warnings),/UNSTAGED DIFF\n[\s\S]*\+two/);assert.deepEqual(warnings,[]);
  await fs.writeFile(path.join(dir,'a.txt'),'changed line of text\n'.repeat(12000));
  const text=await collect({cwd:dir},warnings);assert(text.length<=200000);assert.match(text,/\[diff truncated\]$/);assert.match(warnings[0],/截断/);
  const saved=process.env.GIT_CONFIG_PARAMETERS;process.env.GIT_CONFIG_PARAMETERS='not valid';
  try {warnings=[];assert.equal(await collect({cwd:dir,context:'ctx'},warnings),'ctx');assert.match(warnings[0],/未附带 git diff/);}
  finally {if(saved===undefined)delete process.env.GIT_CONFIG_PARAMETERS;else process.env.GIT_CONFIG_PARAMETERS=saved;}
  // An ownership check that rejects every repository stands in for a folder owned by another user.
  const config=path.join(dir,'safe.gitconfig');await fs.writeFile(config,'[safe]\n\tdirectory =\n');
  const saveGlobal=process.env.GIT_CONFIG_GLOBAL,saveTest=process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER;
  process.env.GIT_CONFIG_GLOBAL=config;process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER='1';
  try {warnings=[];assert.equal(await collect({cwd:dir,context:'ctx'},warnings),'ctx');assert.match(warnings[0],/所有者不是当前用户/);}
  finally {
    if(saveGlobal===undefined)delete process.env.GIT_CONFIG_GLOBAL;else process.env.GIT_CONFIG_GLOBAL=saveGlobal;
    if(saveTest===undefined)delete process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER;else process.env.GIT_TEST_ASSUME_DIFFERENT_OWNER=saveTest;
  }
}));
test('discussions start without cwd, but edit access still requires one',async()=>{
  const calls=[];const discuss=createDiscussions(async input=>{calls.push(input);return {result:'建议吃面',warnings:['示例说明']};});
  const r=await discuss({peer:'codex',objective:'今天吃什么',host_message:'中午想吃清淡一点',max_rounds:1});
  assert.equal(calls[0].cwd,null);assert.equal(r.cwd,null);assert.deepEqual(r.transcript[1].warnings,['示例说明']);
  const md=renderTranscript(r);assert.match(md,/\*\*工作目录\*\*：无/);assert.match(md,/\*说明：示例说明\*/);
  await assert.rejects(discuss({peer:'codex',objective:'改文件',host_message:'x',access:'edit',edit_files:['a.txt']}),/requires cwd/);
});
