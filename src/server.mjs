import {McpServer} from '@modelcontextprotocol/sdk/server/mcp.js';
import {StdioServerTransport} from '@modelcontextprotocol/sdk/server/stdio.js';
import {z} from 'zod';
import {invoke} from './bridge.mjs';
import {discuss} from './discussion.mjs';
import {effortLevels,modelPattern} from './models.mjs';
const selectionSchema=peer=>({model:z.string().regex(modelPattern).optional().describe('Peer CLI model ID or alias; omit for CLI defaults. Use auto/default to reset.'),
  effort:z.enum([...effortLevels[peer],'auto','default']).optional().describe('Peer reasoning effort. Availability depends on the model; omit for CLI defaults. These settings affect the peer, not the host conversation.')});
const server=new McpServer({name:'agent-peer-bridge',version:'0.5.0'});
const selected=process.argv.find(a=>a.startsWith('--peer='))?.slice(7);
if(selected&&!['claude','codex'].includes(selected))throw Error('Invalid peer filter');
for(const peer of selected?[selected]:['claude','codex']) for(const mode of ['review','ask','explain','plan-review']) {
  server.tool(`${peer}_${mode.replace('-','_')}`,`Ask local logged-in ${peer} for independent ${mode}. Read-only snapshot; returns results to this conversation. Supply relative files and/or context. Optional model/effort select the peer for this call.`,{cwd:z.string(),request:z.string().default(''),files:z.array(z.string()).max(20).default([]),context:z.string().default(''),include_diff:z.boolean().default(true),timeout_ms:z.number().int().min(1000).max(300000).default(180000),...selectionSchema(peer)},{readOnlyHint:true,destructiveHint:false,openWorldHint:true},async input=>{
    try {const result=await invoke({...input,peer,mode});return {content:[{type:'text',text:JSON.stringify(result)}]};}
    catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}
  });
}
for(const peer of selected?[selected]:['claude','codex']) {
  server.tool(`${peer}_discuss`,`For "Codex你和CC讨论一下，最大讨论轮数x", "和Claude讨论", "和Codex讨论" and joint build/design/debug requests: bounded multi-round collaboration with local ${peer}. The current conversation is the host speaker. One round = host contribution + peer response. Start once with objective, host_message, cwd and max_rounds (1..20, default 3); continue with the returned session_id and your response/new evidence. Finish early or inspect status without CLI calls. Never restart to evade the user's round cap. Default access is read-only. Only with explicit user authorization set access=edit and edit_files to a minimal fixed list of relative paths. Peer-proposed create/update contents are checked and applied by the bridge; no shell or deletion permission. Check edit_result and inspect/test changes before continuing. Access and editable scope cannot increase mid-session.`,{
    action:z.enum(['start','continue','finish','status']).default('start'),session_id:z.string().optional(),
    objective:z.string().max(10000).optional(),host_message:z.string().max(20000).optional(),
    max_rounds:z.number().int().min(1).max(20).optional(),cwd:z.string().optional(),
    files:z.array(z.string()).max(20).optional(),context:z.string().max(200000).optional(),
    access:z.enum(['read-only','edit']).optional().describe('Default read-only. Use edit only when the user explicitly authorizes peer modifications; requires edit_files.'),
    edit_files:z.array(z.string()).min(1).max(20).optional().describe('Fixed allowlist of relative files the peer may create/update. Supply only for explicitly authorized edit discussions.'),
    include_diff:z.boolean().optional(),timeout_ms:z.number().int().min(1000).max(300000).optional(),...selectionSchema(peer)
  },{readOnlyHint:false,destructiveHint:true,openWorldHint:true},async input=>{
    try {const result=await discuss({...input,peer});return {isError:['peer-error','edit-failed'].includes(result.stop_reason),content:[{type:'text',text:JSON.stringify(result)}]};}
    catch(e){return {isError:true,content:[{type:'text',text:e.message}]};}
  });
}
await server.connect(new StdioServerTransport());
