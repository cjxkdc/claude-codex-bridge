import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const label=speaker=>speaker==='codex'?'Codex':speaker==='claude'?'Claude Code':speaker;
function block(text) {
  const runs=String(text).match(/`+/g)||[];
  const fence='`'.repeat(Math.max(3,...runs.map(run=>run.length+1)));
  return `${fence}text\n${text}\n${fence}`;
}
export function renderTranscript(s) {
  const host=label(s.host);
  const lines=['# Claude ↔ Codex 讨论记录','',
    `- 会话：${s.session_id}`,`- 发起方：${host}`,`- 对方：${label(s.peer)}`,
    `- 开始时间（UTC）：${s.created_at}`,`- 更新时间（UTC）：${s.updated_at}`,
    `- 轮数：${s.rounds_used} / ${s.max_rounds}`,`- 状态：${s.status}`,
    `- 结束原因：${s.stop_reason||'尚未结束'}`,'',
    '记录包含双方实际发送的发言，不包含模型内部思考、整个 host 对话或完整输入快照。单条 peer 回复超过 20,000 字符时会截断并结束讨论。','',
    '## 讨论目标','',block(s.objective),'','## 工作目录','',block(s.cwd),''];
  for(const turn of s.transcript) {
    const speaker=turn.speaker==='host'?host:label(turn.speaker);
    lines.push(`## 第 ${turn.round} 轮 · ${speaker}${turn.kind==='conclusion'?' · 结论':turn.kind==='error'?' · 错误':''}`,'',
      `时间（UTC）：${turn.timestamp}`, '',block(turn.text),'');
    if(turn.truncated)lines.push('此回复超过长度限制，以上为保存的截断内容。','');
  }
  return lines.join('\n');
}
async function atomicWrite(file,content) {
  const temporary=`${file}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary,content,{encoding:'utf8',flag:'wx'});
    await fs.rename(temporary,file);
  } finally {await fs.unlink(temporary).catch(e=>{if(e.code!=='ENOENT')throw e;});}
}
export function createTranscriptWriter(directory) {
  const target=path.resolve(directory);
  return async discussion=>{
    // Session IDs are bridge-generated UUIDs, never arbitrary output paths.
    if(!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(discussion.session_id))throw Error('Invalid transcript session ID');
    const stem=`${new Date(discussion.created_at).toISOString().slice(0,10)}_${discussion.session_id}`;
    const record={save_status:'saved',markdown_path:path.join(target,`${stem}.md`),json_path:path.join(target,`${stem}.json`)};
    const snapshot={schema_version:1,...discussion,record};
    await fs.mkdir(target,{recursive:true});
    await atomicWrite(record.json_path,JSON.stringify(snapshot,null,2)+'\n');
    await atomicWrite(record.markdown_path,renderTranscript(snapshot));
    return record;
  };
}
