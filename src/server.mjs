import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {invoke} from './bridge.mjs';
import {discuss} from './discussion.mjs';
const server=new McpServer({name:'agent-peer-bridge',version:'0.3.1'});
const selected=process.argv.find(a=>a.startsWith('--peer='))?.slice(7);
if(selected&&!['claude','codex'].includes(selected))throw Error('Invalid peer filter');
for(const peer of selected?[selected]:['claude','codex']) for(const mode of ['review','ask','explain','plan-review']) {
  server.tool(`${peer}_${mode.replace('-','_')}`,`Ask local logged-in ${peer} for independent ${mode}. Read-only snapshot; returns results to this conversation. Supply relative files and/or context.`,{cwd:z.string(),request:z.string().default(''),files:z.array(z.string()).max(20).default([]),context:z.string().default(''),include_diff:z.boolean().default(true),timeout_ms:z.number().int().min(1000).max(300000).default(180000)},{readOnlyHint:true,destructiveHint:false,openWorldHint:true},async input=>{
    try {const result=await invoke({...input,peer,mode});return {content:[{type:'text',text:JSON.stringify(result)}]};}
    catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}
  });
}
for(const peer of selected?[selected]:['claude','codex']) {
  server.tool(`${peer}_discuss`,`For "Codex你和CC讨论一下，最大讨论轮数x", "和Claude讨论", "和Codex讨论" and joint build/design/debug requests: bounded multi-round collaboration with local ${peer}. The current conversation is the host speaker. One round = host contribution + peer response. Start once with objective, host_message, cwd and max_rounds (1..20, default 3); continue with the returned session_id and your response/new evidence. Finish early or inspect status without CLI calls. Never restart to evade the user's round cap. Peer is read-only; the host performs authorized implementation/tests.`,{
    action:z.enum(['start','continue','finish','status']).default('start'),session_id:z.string().optional(),
    objective:z.string().max(10000).optional(),host_message:z.string().max(20000).optional(),
    max_rounds:z.number().int().min(1).max(20).optional(),cwd:z.string().optional(),
    files:z.array(z.string()).max(20).optional(),context:z.string().max(200000).optional(),
    include_diff:z.boolean().optional(),timeout_ms:z.number().int().min(1000).max(300000).optional()
  },{readOnlyHint:false,destructiveHint:false,openWorldHint:true},async input=>{
    try {const result=await discuss({...input,peer});return {isError:result.stop_reason==='peer-error',content:[{type:'text',text:JSON.stringify(result)}]};}
    catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}
  });
}
await server.connect(new StdioServerTransport());
