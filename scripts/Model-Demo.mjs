import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {config,root} from '../src/bridge.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const [peer='codex',model,effort='medium']=process.argv.slice(2);
if(!['claude','codex'].includes(peer)||!model)throw Error('Usage: node scripts/Model-Demo.mjs claude|codex <model-id> [effort]');
const cfg=await config();const client=new Client({name:'model-selection-demo',version:'1'});
const transport=new StdioClientTransport({command:cfg.node||process.execPath,args:[path.join(root,'src/server.mjs'),`--peer=${peer}`],env:{...process.env}});
try {
  await client.connect(transport);const before=await fs.readFile(path.join(root,'demo/bug.js'));
  const response=await client.callTool({name:`${peer}_discuss`,arguments:{action:'start',cwd:root,files:['demo/bug.js'],include_diff:false,
    max_rounds:1,model,effort,objective:'验证模型参数：host 发言由演示脚本提供。讨论 average([]) 的最小修复，回复一小段即可。',
    host_message:'空数组平均值为 NaN；我建议抛出 RangeError。请指出需要验证的一个调用方影响，不修改文件。'}},undefined,{timeout:320000});
  const result=JSON.parse(response.content[0].text);
  if(!(await fs.readFile(path.join(root,'demo/bug.js'))).equals(before))throw Error('Demo source changed');
  await fs.mkdir(path.join(root,'.local'),{recursive:true});
  await fs.writeFile(path.join(root,`.local/model-selection-${peer}.json`),JSON.stringify({...result,source_unchanged:true},null,2));
  console.log(JSON.stringify({session_id:result.session_id,peer_options:result.peer_options,record:result.record,status:result.status,stop_reason:result.stop_reason,source_unchanged:true},null,2));
  if(response.isError||result.stop_reason==='peer-error')process.exitCode=1;
} finally {await client.close();}
