import {config,invoke,argsFor,peerExe,root} from './bridge.mjs';
import {locateAll} from './locate.mjs';
import {spawnSync} from 'node:child_process';
const [command,...rest]=process.argv.slice(2);
// Windows PowerShell 5.1 decodes native output with the OEM code page; ASCII-only JSON survives any locale.
const ascii=value=>JSON.stringify(value,null,2).replace(/[\u0080-￿]/g,c=>'\\u'+c.charCodeAt(0).toString(16).padStart(4,'0'));
if(command==='doctor') {const cfg=await config();for(const peer of ['claude','codex']){const exe=await peerExe(peer,cfg);const r=spawnSync(exe,['--version'],{encoding:'utf8',windowsHide:true});console.log(peer,exe,(r.stdout||r.stderr||r.error?.message).trim());console.log('peer arguments:',argsFor(peer));}}
else if(command==='locate') {
  const explicit=Object.fromEntries(rest.map(a=>a.match(/^--(claude|codex)=(.+)$/)).filter(Boolean).map(m=>[m[1],m[2]]));
  console.log(ascii(await locateAll({explicit,root,profile:process.env.USERPROFILE||undefined})));
}
else if(command==='call'){const input=JSON.parse(rest[0]);console.log(JSON.stringify(await invoke(input),null,2));}
else {console.error('Usage: node src/cli.mjs doctor | locate [--claude=PATH] [--codex=PATH] | call <JSON>');process.exitCode=1;}
