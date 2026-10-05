import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {register,timeoutConfig} from '../scripts/register.mjs';
import {root} from '../src/bridge.mjs';
test('timeout edit is idempotent and preserves unrelated MCP sections',()=>{
 const original='model = "x"\n[mcp_servers.other]\ntool_timeout_sec = 42\n[mcp_servers.claude-peer]\ncommand = "node"\n[mcp_servers.claude-peer.env]\nHOME = "test"\n[mcp_servers.third]\nurl = "url"\n';
 const edited=timeoutConfig(original);assert.match(edited,/claude-peer\]\ntool_timeout_sec = 360/);assert.match(edited,/other\]\ntool_timeout_sec = 42/);assert(edited.includes('[mcp_servers.claude-peer.env]\nHOME = "test"'));assert.equal(timeoutConfig(edited),edited);
});
test('registration preserves private config, passes JSON as one argument and installs skills',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'bridge-install-'));const profile=path.join(dir,'profile');const source=path.join(dir,'agent-peer-bridge');
 try{
  await fs.mkdir(path.join(profile,'.codex'),{recursive:true});await fs.mkdir(path.join(source,'.local'),{recursive:true});
  await fs.cp(path.join(root,'skills'),path.join(source,'skills'),{recursive:true});
  const original='model = "keep"\n[mcp_servers.other]\ncommand = "keep"\n';await fs.writeFile(path.join(profile,'.codex/config.toml'),original);await fs.writeFile(path.join(profile,'.claude.json'),'private config');
  const calls=[];const cfg={profile,codex:'codex.exe',claude:'claude.exe',node:'C:/space path/node.exe'};
  const run=(exe,args)=>{calls.push({exe,args});if(args[1]==='get')return {status:1,stdout:'',stderr:''};if(exe==='codex.exe'&&args[1]==='add'){const file=path.join(profile,'.codex/config.toml');return {status:0,stdout:'',stderr:'',...{}};}return {status:0,stdout:'',stderr:''};};
  // Mock CLI writing only its own MCP table; exercise the filesystem registration path.
  await fs.appendFile(path.join(profile,'.codex/config.toml'),'[mcp_servers.claude-peer]\ncommand = "node"\n');
  await register(cfg,source,run);
  assert((await fs.readFile(path.join(profile,'.codex/config.toml'),'utf8')).startsWith(original));
  assert((await fs.readdir(path.join(profile,'.codex'))).some(n=>n.includes('peer-backup')));
  assert((await fs.readFile(path.join(profile,'.codex/skills/claude-discuss/SKILL.md'),'utf8')).includes('agent-peer-bridge'));
  const jsonCall=calls.find(c=>c.args[1]==='add-json');const entry=JSON.parse(jsonCall.args.at(-1));assert.equal(entry.command,cfg.node);assert.equal(entry.args[1],'--peer=codex');
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
