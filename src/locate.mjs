import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';

// Flags the bridge relies on; a CLI without them is too old to run peers safely.
export const requiredFlags={codex:{args:['exec','--help'],flags:['--ignore-user-config','--ignore-rules']},
  claude:{args:['--help'],flags:['--safe-mode','--restricted','--strict-mcp-config']}};
const npmPackages={codex:['@openai','codex'],claude:['@anthropic-ai','claude-code']};
// An explicit profile (installer, configured bridge) decides the AppData folders, as the original installer did.
function places({profile,localAppData,appData,pathDirs}={}) {
  const home=profile||os.homedir();
  return {profile:home,localAppData:localAppData||(profile?null:process.env.LOCALAPPDATA)||path.join(home,'AppData','Local'),
    appData:appData||(profile?null:process.env.APPDATA)||path.join(home,'AppData','Roaming'),
    pathDirs:(pathDirs??(process.env.PATH||'').split(path.delimiter)).filter(Boolean)};
}
// Desktop apps keep their CLI in versioned folders that are replaced on update, so a pattern may match
// several copies. npm installs put a .cmd shim on PATH; Codex ships its native binary inside the package.
export function candidatePatterns(peer,options={}) {
  const {profile,localAppData,appData,pathDirs}=places(options);
  const npmDirs=[path.join(appData,'npm'),...pathDirs];
  if(peer==='codex')return [
    [localAppData,'OpenAI','Codex','bin','*','codex.exe'],
    [localAppData,'Programs','OpenAI','Codex','bin','codex.exe'],
    [profile,'.local','bin','codex.exe'],
    ...npmDirs.flatMap(dir=>[[dir,'node_modules','@openai','codex','node_modules','@openai','*','vendor','*','bin','codex.exe'],[dir,'node_modules','@openai','*','vendor','*','bin','codex.exe']]),
    ...pathDirs.map(dir=>[dir,'codex.exe'])];
  if(peer==='claude')return [
    [profile,'.local','bin','claude.exe'],
    [localAppData,'Packages','Claude_pzs8sxrjxfjjc','LocalCache','Roaming','Claude','claude-code','*','*','claude.exe'],
    [appData,'Claude','claude-code','*','*','claude.exe'],
    ...pathDirs.map(dir=>[dir,'claude.exe'])];
  throw Error('Unknown peer');
}
async function expand(segments) {
  let paths=[segments[0]];
  for(const part of segments.slice(1)) {
    const next=[];
    for(const base of paths) {
      if(part!=='*'){next.push(path.join(base,part));continue;}
      try{for(const e of await fs.readdir(base,{withFileTypes:true}))if(e.isDirectory())next.push(path.join(base,e.name));}catch{}
    }
    paths=next;
  }
  const files=[];
  for(const file of paths){try{const st=await fs.stat(file);if(st.isFile())files.push({file,mtime:st.mtimeMs});}catch{}}
  return files;
}
const run=(exe,args,env=process.env)=>spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:20000,env});
export function checkFlags(peer,exe,runner=run) {
  const {args,flags}=requiredFlags[peer],r=runner(exe,args);
  if(r.error)return `cannot start: ${r.error.message}`;
  const help=(r.stdout||'')+(r.stderr||'');
  const missing=flags.filter(flag=>!help.includes(flag));
  return r.status===0&&!missing.length?null:`too old: missing ${missing.join(', ')||'a working --help'}`;
}
async function npmShim(peer,options) {
  const {appData,pathDirs}=places(options);
  for(const dir of [path.join(appData,'npm'),...pathDirs]) {
    try{await fs.access(path.join(dir,'node_modules',...npmPackages[peer],'package.json'));return dir;}catch{}
  }
  return null;
}
// Returns the newest copy that passes the flag check, with reasons for every rejected copy.
export async function locatePeer(peer,{explicit,runner=run,...options}={}) {
  const rejected=[];
  if(explicit) {
    const reason=checkFlags(peer,explicit,runner);
    return reason?{path:null,rejected:[{path:explicit,reason}],npm_only:false}:{path:explicit,rejected,npm_only:false};
  }
  const seen=new Set(),found=[];
  for(const pattern of candidatePatterns(peer,options))for(const c of await expand(pattern)){const key=path.resolve(c.file).toLowerCase();if(!seen.has(key)){seen.add(key);found.push(c);}}
  found.sort((a,b)=>b.mtime-a.mtime);
  for(const c of found) {
    const reason=checkFlags(peer,c.file,runner);
    if(!reason)return {path:c.file,rejected,npm_only:false};
    rejected.push({path:c.file,reason});
  }
  return {path:null,rejected,npm_only:peer==='claude'&&!!(await npmShim(peer,options))};
}
export function loginStatus(peer,exe,runner=run) {
  if(peer==='claude') {
    const r=runner(exe,['auth','status']);
    try{const s=JSON.parse(r.stdout);return s.loggedIn&&['claude.ai','oauth'].includes(s.authMethod)?{ok:true}:{ok:false,reason:s.loggedIn?'api-key':'logged-out'};}
    catch{return {ok:false,reason:'unknown'};}
  }
  const r=runner(exe,['login','status']),text=(r.stdout||'')+(r.stderr||'');
  if(/logged in using chatgpt/i.test(text))return {ok:true};
  return {ok:false,reason:/api key/i.test(text)?'api-key':/not logged in/i.test(text)||r.status!==0?'logged-out':'unknown'};
}
const updateHint={claude:'Update it with "claude update" or by updating the Claude app.',codex:'Update the Codex app, or run "npm install -g @openai/codex@latest".'};
const installHint={claude:'Install Claude Code from https://claude.com/claude-code (native installer or the Claude app).',codex:'Install the official Codex app or CLI from OpenAI and sign in with ChatGPT.'};
// Installer report: problems block installation; actions are follow-up steps for the user.
export async function locateAll({explicit={},root,runner=run,...options}={}) {
  const report={problems:[],actions:[]};
  for(const peer of ['claude','codex']) {
    const name=peer==='claude'?'Claude Code':'Codex';
    const result=await locatePeer(peer,{explicit:explicit[peer],runner,...options});
    report[peer]={path:result.path,rejected:result.rejected};
    if(!result.path) {
      const lines=[`${name} CLI with the required options was not found.`];
      for(const r of result.rejected)lines.push(`  ${r.path}: ${r.reason}`);
      if(result.rejected.some(r=>r.reason.startsWith('too old')))lines.push(`  ${updateHint[peer]}`);
      if(result.npm_only)lines.push('  Claude Code installed through npm was found. Run "claude install" to add the native build, then run this installer again.');
      else if(!result.rejected.length)lines.push(`  ${installHint[peer]}`);
      report.problems.push(lines.join('\n'));
      continue;
    }
    const login=loginStatus(peer,result.path,runner);report[peer].login=login;
    if(login.ok)continue;
    if(peer==='claude')report.actions.push(`Claude CLI is ${login.reason==='api-key'?'using an API key; the bridge needs your Claude subscription':'not logged in with your Claude subscription'} (the Claude app login is separate). Run: powershell -ExecutionPolicy Bypass -File "${path.join(root||'.','scripts','Start-Claude.ps1')}" auth login`);
    else report.actions.push(`Codex CLI is ${login.reason==='api-key'?'using an API key; the bridge needs your ChatGPT account. Run: "'+result.path+'" logout, then':'not logged in with ChatGPT. Sign in inside the Codex app, or run:'} "${result.path}" login`);
  }
  return report;
}
