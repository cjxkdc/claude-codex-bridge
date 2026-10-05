import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {root,config} from '../src/bridge.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
const peer=process.argv[2]||'codex';
if(!['claude','codex'].includes(peer))throw Error('Invalid peer');
const cfg=await config();
const transport=new StdioClientTransport({command:cfg.node||process.execPath,args:[path.join(root,'src/server.mjs'),`--peer=${peer}`],env:{...process.env}});
const client=new Client({name:'peer-demo',version:'1'});
try {
 await client.connect(transport);
 const names=(await client.listTools()).tools.map(t=>t.name);
 const before=await fs.readFile(path.join(root,'demo/bug.js'));
 const result=await client.callTool({name:`${peer}_review`,arguments:{cwd:root,files:['demo/bug.js'],include_diff:false,request:'请审核这段代码，指出边界条件问题。只返回建议。'}},undefined,{timeout:320000});
 const after=await fs.readFile(path.join(root,'demo/bug.js'));
 if(!before.equals(after))throw Error('Demo source changed');
 const report={peer,tools:names,source_unchanged:true,...result};
 await fs.writeFile(path.join(root,`demo/${peer}-result.json`),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report,null,2));
 if(result.isError)process.exitCode=1;
} finally {await client.close();}
