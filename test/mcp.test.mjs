import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {root} from '../src/bridge.mjs';
import path from 'node:path';
test('MCP initialize, tool discovery, call error, peer filter and recursion guard',async()=>{
 const transport=new StdioClientTransport({command:process.execPath,args:[path.join(root,'src/server.mjs'),'--peer=codex'],env:{...process.env,AGENT_PEER_DEPTH:'1'}});
 const client=new Client({name:'bridge-tests',version:'1'});
 try{await client.connect(transport);const listed=await client.listTools();assert.equal(listed.tools.length,7);assert(listed.tools.every(t=>t.name.startsWith('codex_')));assert(listed.tools.filter(t=>!['codex_discuss','codex_send_to_chat'].includes(t.name)).every(t=>t.annotations.readOnlyHint));assert.equal(listed.tools.find(t=>t.name==='codex_discuss').annotations.readOnlyHint,false);const discussion=listed.tools.find(t=>t.name==='codex_discuss');assert.equal(discussion.annotations.destructiveHint,true);assert.deepEqual(discussion.inputSchema.properties.access.enum,['read-only','edit']);assert.equal(discussion.inputSchema.properties.edit_files.minItems,1);assert.deepEqual(discussion.inputSchema.properties.format.enum,['markdown','json']);const r=await client.callTool({name:'codex_review',arguments:{cwd:root}});assert.equal(r.isError,true);assert.match(r.content[0].text,/Recursive/);const d=await client.callTool({name:'codex_discuss',arguments:{objective:'debug',host_message:'hypothesis',cwd:root,max_rounds:2}});assert.equal(d.isError,true);assert.match(d.content[0].text,/Recursive/);}finally{await client.close();}
});
