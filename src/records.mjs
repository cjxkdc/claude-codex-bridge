import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

const label=speaker=>speaker==='codex'?'Codex':speaker==='claude'?'Claude Code':speaker;
const stopLabels={'round-limit':'达到轮数上限','host-finished':'发起方结束讨论','peer-error':'对方调用失败','edit-failed':'修改未能写入',
  'peer-message-limit':'对方回复超出长度上限','history-limit':'讨论内容超出长度上限'};
const editLabels={applied:'已写入','no-changes':'没有修改',rejected:'已拒绝，未写入',conflict:'文件冲突，未写入',failed:'写入失败',partial:'部分写入'};
const collapseHost=800;
export function fenced(text,info='text') {
  const runs=String(text).match(/`+/g)||[];
  const fence='`'.repeat(Math.max(3,...runs.map(run=>run.length+1)));
  return `${fence}${info}\n${text}\n${fence}`;
}
const pad=n=>String(n).padStart(2,'0');
export function localTime(iso,{date=true}={}) {
  const d=new Date(iso);if(Number.isNaN(d.getTime()))return String(iso||'');
  const time=`${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  return date?`${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${time}`:time;
}
function zone(iso) {
  const offset=-new Date(iso).getTimezoneOffset(),abs=Math.abs(offset);
  return `UTC${offset<0?'-':'+'}${pad(Math.floor(abs/60))}:${pad(abs%60)}`;
}
// CommonMark does not close **bold** after CJK punctuation when text follows (**结论。**然后).
// Such pairs become <strong> so the record renders as the peer intended.
const punct=c=>/[\p{P}\p{S}\u0001]/u.test(c),space=c=>!c||/\s/u.test(c);
function strong(line) {
  const parts=line.split('**');if(parts.length<3||parts.length%2===0)return line;
  let out=parts[0];
  for(let i=1;i<parts.length;i+=2) {
    const before=out.at(-1),inner=parts[i],after=parts[i+1][0];
    const opens=!space(inner[0])&&(!punct(inner[0])||space(before)||punct(before));
    const closes=!space(inner.at(-1))&&(!punct(inner.at(-1))||space(after)||punct(after));
    out+=(opens&&closes?`**${inner}**`:`<strong>${inner}</strong>`)+parts[i+1];
  }
  return out;
}
// Show raw HTML literally except inside code spans, so peer text cannot open or close record elements.
function escapeHtml(line) {
  const parts=line.split(/(`+)/),spans=[];let out='';
  for(let i=0;i<parts.length;i++) {
    if(i%2===0){out+=parts[i].replace(/<(?=[A-Za-z/!?])/g,'&lt;');continue;}
    const close=parts.findIndex((part,j)=>j>i&&j%2===1&&part===parts[i]);
    if(close<0){out+=parts[i];continue;}
    out+=`\u0001${spans.push(parts.slice(i,close+1).join(''))-1}\u0001`;i=close;
  }
  return strong(out).replace(/\u0001(\d+)\u0001/g,(_,n)=>spans[n]);
}
// Render exchanged text as Markdown without letting it reshape the record: headings sit below the
// record's own levels, setext underlines become rules, raw HTML is literal and unclosed fences are closed.
export function contain(text,{headingOffset=3}={}) {
  const out=[];let fence=null;
  for(const line of String(text).replace(/\r\n?/g,'\n').split('\n')) {
    if(fence) {
      out.push(line);
      const close=line.match(/^ {0,3}(`{3,}|~{3,})\s*$/);
      if(close&&close[1][0]===fence[0]&&close[1].length>=fence.length)fence=null;
      continue;
    }
    const open=line.match(/^ {0,3}(`{3,}|~{3,})(.*)$/);
    if(open&&!(open[1][0]==='`'&&open[2].includes('`'))){fence=open[1];out.push(line);continue;}
    if(/^ {0,3}(=+|-+)\s*$/.test(line)&&out.length&&out.at(-1).trim())out.push('');
    out.push(escapeHtml(line.replace(/^( {0,3})(#{1,6})(?=\s|$)/,(_,indent,marks)=>indent+'#'.repeat(Math.min(6,marks.length+headingOffset)))));
  }
  if(fence)out.push(fence);
  return out.join('\n');
}
const quote=text=>contain(text).split('\n').map(line=>line?'> '+line:'>').join('\n');
const cell=text=>String(text).replace(/\|/g,'\\|').replace(/[\r\n]+/g,' ');
function settings(options,reported) {
  const parts=[`模型 ${options?.model||'CLI 默认'}`,`思考强度 ${options?.effort||'CLI 默认'}`];
  return parts.join(' · ')+'（请求值）'+(reported?.length?` · CLI 报告使用 ${reported.join(', ')}`:'');
}
export function renderEditResult(r) {
  if(!r)return '';
  const lines=[`**修改结果：${editLabels[r.status]||r.status}**（\`${r.status}\`）${r.backup_path?` · 备份：\`${r.backup_path}\``:''}`];
  if(r.error)lines.push('',`错误：${escapeHtml(cell(r.error))}`);
  if(r.rollback_errors?.length)lines.push('','未能回滚：',...r.rollback_errors.map(e=>`- ${escapeHtml(cell(e))}`));
  if(r.changes?.length) {
    lines.push('','| 文件 | 操作 | 新增行 | 删除行 |','| --- | --- | ---: | ---: |',
      ...r.changes.map(c=>`| \`${cell(c.path)}\` | ${c.operation==='create'?'新建':'修改'} | ${c.added??'—'} | ${c.removed??'—'} |`));
    const diffs=r.changes.filter(c=>c.diff).map(c=>c.diff).join('\n');
    if(diffs)lines.push('','<details>','<summary>查看 diff</summary>','',fenced(diffs,'diff'),'','</details>');
  }
  return lines.join('\n');
}
function turnBody(turn) {
  if(turn.kind==='error')return fenced(turn.text);
  const body=[contain(turn.text)];
  if(turn.truncated)body.push('','*此回复超过 20,000 字符，以上为截断后保存的内容。*');
  if(turn.edit_result)body.push('',renderEditResult(turn.edit_result));
  return body.join('\n');
}
function closingTurn(s) {
  const turns=s.transcript||[];
  const conclusion=turns.findLast(t=>t.kind==='conclusion');
  if(conclusion)return {turn:conclusion,title:'结论',speaker:label(s.host)};
  const last=turns.at(-1);
  if(s.status!=='closed'||!last||last.speaker==='host')return null;
  return last.kind==='error'?{turn:last,title:'结束原因',speaker:'对方调用失败'}:{turn:last,title:'最后一轮回复',speaker:label(last.speaker)};
}
export function renderTranscript(s) {
  const host=label(s.host),peer=label(s.peer),closing=closingTurn(s);
  const status=s.status==='closed'?`已结束 · ${stopLabels[s.stop_reason]||s.stop_reason||'—'}`:'进行中';
  const access=s.access==='edit'?`可修改 ${s.edit_files.map(f=>`\`${f}\``).join('、')}`:'只读';
  const sameDay=localTime(s.updated_at).slice(0,10)===localTime(s.created_at).slice(0,10);
  const lines=[`# ${host} ↔ ${peer} 讨论记录`,'',quote(s.objective),'',
    `- **状态**：${status}（${s.rounds_used}/${s.max_rounds} 轮）`,
    `- **双方**：${host} 发起，${peer} 回应`,
    `- **${peer} 设置**：${settings(s.peer_options)}`,
    `- **权限**：${access}`,
    `- **工作目录**：\`${s.cwd}\``,
    `- **时间**：${localTime(s.created_at)} – ${localTime(s.updated_at,{date:!sameDay})}（${zone(s.created_at)}）`,
    `- **会话**：\`${s.session_id}\``,''];
  if(closing)lines.push(`## ${closing.title} · ${closing.speaker}`,'',turnBody(closing.turn),'');
  if(s.transcript?.some(t=>t.kind!=='conclusion'))lines.push('## 讨论过程','');
  for(const turn of s.transcript||[]) {
    if(turn.kind==='conclusion')continue;
    const speaker=turn.speaker==='host'?host:label(turn.speaker);
    const meta=[localTime(turn.timestamp,{date:false})];
    if(turn.peer_options)meta.push(settings(turn.peer_options,turn.reported_models));
    lines.push(`### 第 ${turn.round} 轮 · ${speaker}${turn.kind==='error'?' · 错误':''}`,'',`*${meta.join(' · ')}*`,'');
    if(closing?.turn===turn)lines.push(`*内容见上方「${closing.title}」。*`,'');
    else if(turn.speaker==='host'&&turn.text.length>collapseHost)lines.push('<details>',`<summary>展开发言（${turn.text.length} 字）</summary>`,'',turnBody(turn),'','</details>','');
    else lines.push(turnBody(turn),'');
  }
  lines.push('---','',`*记录包含双方实际发送的发言，不包含模型内部思考、完整的主对话或输入快照。时间为本机时间（${zone(s.created_at)}）。*`);
  return lines.join('\n')+'\n';
}
// Tool output for the host: only the newest exchange plus what it needs to continue.
export function renderDiscussionUpdate(v) {
  const peer=label(v.peer),last=v.transcript.at(-1),lines=[];
  if(last&&last.speaker!=='host') {
    lines.push(`### ${peer} · 第 ${last.round}/${v.max_rounds} 轮${last.kind==='error'?' · 调用失败':''}`,'',`*${settings(last.peer_options,last.reported_models)}*`,'');
    lines.push(last.kind==='error'?fenced(last.text):contain(last.text));
    if(last.truncated)lines.push('','*回复超过 20,000 字符，已截断并结束讨论。*');
    if(last.edit_result)lines.push('',renderEditResult(last.edit_result));
  } else if(last?.kind==='conclusion')lines.push('### 讨论已结束','',contain(last.text));
  else lines.push(`### 讨论${v.status==='closed'?'已结束':'进行中'}`);
  const status=v.status==='open'?`open（剩余 ${v.rounds_remaining} 轮）`:`closed · stop_reason: ${v.stop_reason}（${stopLabels[v.stop_reason]||'—'}）`;
  const record=v.record?.save_status==='saved'?`\`${v.record.markdown_path}\``:v.record?`保存失败：${v.record.error}`:'未保存';
  lines.push('','---','',`- session_id: \`${v.session_id}\``,`- status: ${status}`,`- access: ${v.access==='edit'?'edit · '+v.edit_files.join(', '):'read-only'}`,
    `- record.markdown_path: ${record}`,`- next_action: ${v.next_action}`,'- 完整 transcript：用 action=status 获取。');
  return lines.join('\n');
}
export function renderPeerResult(r) {
  const lines=[`### ${label(r.peer)} · ${r.mode}（只读快照）`,''];
  if(r.requested)lines.push(`*${settings(r.requested,r.reported_models)}*`,'');
  lines.push(contain(r.result));
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
