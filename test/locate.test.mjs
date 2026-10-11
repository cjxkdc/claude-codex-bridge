import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {locateAll,locatePeer,loginStatus} from '../src/locate.mjs';
import {peerExe} from '../src/bridge.mjs';
async function home(run) {
  const profile=await fs.mkdtemp(path.join(os.tmpdir(),'bridge-locate-'));
  try {await run(profile);} finally {await fs.rm(profile,{recursive:true,force:true});}
}
async function exe(file,mtime) {await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'');if(mtime)await fs.utimes(file,mtime,mtime);return file;}
// A fake CLI runner: help text decides whether a copy is current; login output is per file.
function runner({old=[],logins={}}={}) {
  return (file,args)=>{
    if(args.includes('--help'))return {status:0,stdout:old.includes(file)?'--sandbox':'--ignore-user-config --ignore-rules --safe-mode --restricted --strict-mcp-config',stderr:''};
    if(args[0]==='auth')return {status:0,stdout:JSON.stringify(logins[file]??{loggedIn:true,authMethod:'claude.ai'}),stderr:''};
    return {status:0,stdout:logins[file]??'Logged in using ChatGPT',stderr:''};
  };
}
const options=profile=>({profile,pathDirs:[]});
test('the newest working desktop copy wins and outdated copies are explained',async()=>home(async profile=>{
  const bin=path.join(profile,'AppData','Local','OpenAI','Codex','bin');
  const older=await exe(path.join(bin,'aaa','codex.exe'),new Date('2026-10-01')),newer=await exe(path.join(bin,'bbb','codex.exe'),new Date('2026-10-08'));
  assert.equal((await locatePeer('codex',{...options(profile),runner:runner()})).path,newer);
  const r=await locatePeer('codex',{...options(profile),runner:runner({old:[newer]})});
  assert.equal(r.path,older);assert.match(r.rejected[0].reason,/too old: missing --ignore-user-config, --ignore-rules/);
  const none=await locatePeer('codex',{...options(profile),runner:runner({old:[newer,older]})});
  assert.equal(none.path,null);assert.equal(none.rejected.length,2);
}));
test('npm Codex is found through its native binary; npm-only Claude gets install guidance',async()=>home(async profile=>{
  const npm=path.join(profile,'AppData','Roaming','npm');
  const codex=await exe(path.join(npm,'node_modules','@openai','codex','node_modules','@openai','codex-win32-x64','vendor','x86_64-pc-windows-msvc','bin','codex.exe'));
  await exe(path.join(npm,'node_modules','@anthropic-ai','claude-code','package.json'));
  const report=await locateAll({...options(profile),root:'C:/bridge',runner:runner()});
  assert.equal(report.codex.path,codex);assert.equal(report.claude.path,null);
  assert.match(report.problems[0],/Claude Code CLI with the required options was not found[\s\S]*claude install/);
}));
test('login problems become installer actions with the exact command',async()=>home(async profile=>{
  const claude=await exe(path.join(profile,'.local','bin','claude.exe')),codex=await exe(path.join(profile,'.local','bin','codex.exe'));
  const report=await locateAll({...options(profile),root:'C:/bridge',runner:runner({logins:{[claude]:{loggedIn:true,authMethod:'apiKey'},[codex]:'Not logged in'}})});
  assert.deepEqual(report.problems,[]);assert.equal(report.actions.length,2);
  assert.match(report.actions[0],/API key[\s\S]*Start-Claude\.ps1" auth login/);assert.match(report.actions[1],/not logged in with ChatGPT[\s\S]*codex\.exe" login/);
  assert.deepEqual(loginStatus('codex',codex,()=>({status:0,stdout:'Logged in using an API key - sk-***',stderr:''})),{ok:false,reason:'api-key'});
}));
test('a CLI replaced by a client update is re-found and remembered',async()=>home(async profile=>{
  const file=path.join(profile,'config.json'),current=await exe(path.join(profile,'new','codex.exe'));
  await fs.writeFile(file,JSON.stringify({codex:path.join(profile,'gone','codex.exe'),profile}));
  const cfg=JSON.parse(await fs.readFile(file,'utf8'));
  assert.equal(await peerExe('codex',cfg,{file,locate:async()=>({path:current,rejected:[]})}),current);
  assert.equal(JSON.parse(await fs.readFile(file,'utf8')).codex,current);
  assert.equal(await peerExe('codex',cfg,{file,locate:async()=>{throw Error('not called');}}),current);
  await assert.rejects(peerExe('claude',{claude:path.join(profile,'missing.exe')},{file,locate:async()=>({path:null,rejected:[]})}),/Rerun the bridge installer/);
  assert.equal(await peerExe('claude',{},{file}),'claude');
}));
