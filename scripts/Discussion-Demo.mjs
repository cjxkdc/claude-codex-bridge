import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {config,root} from '../src/bridge.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const peer=process.argv[2]||'codex';if(!['claude','codex'].includes(peer))throw Error('Invalid peer');
const cfg=await config();const client=new Client({name:'discussion-demo',version:'1'});
const transport=new StdioClientTransport({command:cfg.node||process.execPath,args:[path.join(root,'src/server.mjs'),`--peer=${peer}`],env:{...process.env}});
async function turn(input){const r=await client.callTool({name:`${peer}_discuss`,arguments:input},undefined,{timeout:320000});const data=JSON.parse(r.content[0].text);console.log(JSON.stringify(data,null,2));return data;}
try {
 await client.connect(transport);const before=await fs.readFile(path.join(root,'demo/bug.js'));
 const first=await turn({action:'start',cwd:root,files:['demo/bug.js'],include_diff:false,max_rounds:2,objective:'Debug average([]) 返回 NaN；确定修复方案与测试，不修改文件。',host_message:'我怀疑根因是空数组时 0/0。我的方案是抛出 RangeError，但想讨论输入契约与调用方影响。请回应这个方案。'});
 let final=first;
 if(first.status==='open')final=await turn({action:'continue',session_id:first.session_id,host_message:'我倾向于显式拒绝空数组；当前缺少调用方证据，不应承诺兼容性。请根据上一轮意见收敛到最小修复及测试清单，保留需要验证的事项。'});
 const after=await fs.readFile(path.join(root,'demo/bug.js'));if(!before.equals(after))throw Error('Demo source changed');
 await fs.writeFile(path.join(root,`demo/${peer}-discussion.json`),JSON.stringify({...final,source_unchanged:true},null,2));
 if(final.stop_reason==='peer-error')process.exitCode=1;
 else if(final.rounds_used!==2||final.status!=='closed')throw Error('Round cap was not enforced');
} finally {await client.close();}
