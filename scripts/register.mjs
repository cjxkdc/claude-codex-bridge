import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {config,root} from '../src/bridge.mjs';
const stamp=()=>new Date().toISOString().replace(/[:.]/g,'-');
async function backup(file){try{await fs.copyFile(file,`${file}.peer-backup-${stamp()}`);}catch(e){if(e.code!=='ENOENT')throw e;}}
export function timeoutConfig(text) {
  return text.replace(/(^\[mcp_servers\.claude-peer\]\r?\n)([\s\S]*?)(?=^\[|$(?![\s\S]))/gm,(_,head,body)=>head+'tool_timeout_sec = 360\n'+body.replace(/^tool_timeout_sec\s*=.*(?:\r?\n|$)/gm,''));
}
export async function register(cfg,sourceRoot=root,run=(exe,args)=>spawnSync(exe,args,{encoding:'utf8',windowsHide:true,shell:false,env:process.env})) {
  const profile=cfg.profile;if(!profile||!path.isAbsolute(profile))throw Error('Profile path missing');
  const codexHome=cfg.codex_home||path.join(profile,'.codex');
  await fs.mkdir(codexHome,{recursive:true});
  const server=path.join(sourceRoot,'src/server.mjs');
  const env={USERPROFILE:profile,HOME:profile,CODEX_HOME:codexHome};
  function execute(exe,args,{optional=false}={}){const r=run(exe,args);if(r.error)throw r.error;if(!optional&&r.status!==0)throw Error(`${path.basename(exe)} failed: ${r.stderr||r.stdout}`);return r;}
  const cx=execute(cfg.codex,['mcp','get','claude-peer','--json'],{optional:true});
  if(cx.status===0&&!/agent-?peer-?bridge/i.test(cx.stdout))throw Error('claude-peer already belongs to another server');
  const cc=execute(cfg.claude,['mcp','get','codex-peer'],{optional:true});
  if(cc.status===0&&!/agent-?peer-?bridge/i.test(cc.stdout))throw Error('codex-peer already belongs to another server');
  const targets=[{file:path.join(codexHome,'skills/claude-discuss/SKILL.md'),source:'skills/claude-discuss/SKILL.md'},
    {file:path.join(profile,'.claude/skills/codex-discuss/SKILL.md'),source:'skills/codex-discuss/SKILL.md'}];
  for(const t of targets){try{const old=await fs.readFile(t.file,'utf8');if(!old.includes('agent-peer-bridge'))throw Error(`Unrelated skill exists: ${t.file}`);}catch(e){if(e.code!=='ENOENT')throw e;}}
  for(const file of [path.join(codexHome,'config.toml'),path.join(profile,'.claude.json')])await backup(file);
  execute(cfg.codex,['mcp','add','claude-peer',...Object.entries(env).flatMap(([k,v])=>['--env',`${k}=${v}`]),'--',cfg.node,server,'--peer=claude']);
  const cfgFile=path.join(codexHome,'config.toml');
  const toml=await fs.readFile(cfgFile,'utf8');await fs.writeFile(cfgFile,timeoutConfig(toml.replace(/^\uFEFF/,'')),'utf8');
  if(cc.status===0)execute(cfg.claude,['mcp','remove','codex-peer','--scope','user']);
  execute(cfg.claude,['mcp','add-json','--scope','user','codex-peer',JSON.stringify({type:'stdio',command:cfg.node,args:[server,'--peer=codex'],env})]);
  for(const t of targets){await fs.mkdir(path.dirname(t.file),{recursive:true});await backup(t.file);await fs.copyFile(path.join(sourceRoot,t.source),t.file);}
  await fs.writeFile(path.join(sourceRoot,'.local/claude-mcp.json'),JSON.stringify({mcpServers:{'codex-peer':{type:'stdio',command:cfg.node,args:[server,'--peer=codex'],env}}},null,2));
  console.log('Registered MCP servers and discussion skills.');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await register(await config());
