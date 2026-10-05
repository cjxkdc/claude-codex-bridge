import {config,invoke,argsFor} from './bridge.mjs';
import {spawnSync} from 'node:child_process';
const [command,arg]=process.argv.slice(2);
if(command==='doctor') {const cfg=await config();for(const peer of ['claude','codex']){const exe=cfg[peer]||peer;const r=spawnSync(exe,['--version'],{encoding:'utf8',windowsHide:true});console.log(peer,exe,(r.stdout||r.stderr||r.error?.message).trim());console.log('peer arguments:',argsFor(peer));}}
else if(command==='call'){const input=JSON.parse(arg);console.log(JSON.stringify(await invoke(input),null,2));}
else {console.error('Usage: node src/cli.mjs doctor | call <JSON>');process.exitCode=1;}
