import {test} from 'node:test';
import assert from 'node:assert/strict';
import {unifiedDiff} from '../src/diff.mjs';
import {contain,renderDiscussionUpdate,renderPeerResult,renderTranscript} from '../src/records.mjs';
import {createDiscussions} from '../src/discussion.mjs';
const start={peer:'codex',objective:'Debug 空数组',host_message:'初步判断',cwd:'C:/project',max_rounds:2};
test('peer Markdown renders but cannot reshape the record',()=>{
  const text=contain('# 方案\n正文 <details> 与 `<b>` 保留\nSetext\n---\n```js\n<div>\n# 不是标题');
  assert.match(text,/^#### 方案$/m);assert.match(text,/正文 &lt;details> 与 `<b>` 保留/);
  assert.match(text,/^Setext\n\n---$/m);assert.match(text,/```js\n<div>\n# 不是标题\n```$/);
  assert.equal(contain('**A. 先验证。**按文档 **ok** 与 按**`x`**按'),'<strong>A. 先验证。</strong>按文档 **ok** 与 按<strong>`x`</strong>按');
  assert.equal(contain('**未配对 与 `**`'),'**未配对 与 `**`');
  assert.equal(contain('###### 深层'),'###### 深层');assert.equal(contain('~~~~\nx'),'~~~~\nx\n~~~~');
});
test('unified diff reports hunks, counts, creation and missing final newline',()=>{
  const before=Array.from({length:20},(_,i)=>`line ${i+1}`).join('\n')+'\n';
  const after=before.replace('line 2\n','line two\n').replace('line 18\n','line 18\nline 18b\n');
  const r=unifiedDiff(before,after,{path:'a.txt'});
  assert.deepEqual([r.added,r.removed],[2,1]);assert.equal(r.diff.match(/^@@/gm).length,2);
  assert.match(r.diff,/^@@ -1,5 \+1,5 @@\n line 1\n-line 2\n\+line two\n line 3$/m);
  assert.match(unifiedDiff(null,'a\nb',{path:'n.txt'}).diff,/^--- \/dev\/null\n\+\+\+ b\/n\.txt\n@@ -0,0 \+1,2 @@\n\+a\n\+b\n\\ No newline at end of file$/);
  assert.equal(unifiedDiff('same\n','same\n').diff,'');
  const big=unifiedDiff('a\n'.repeat(50),'b\n'.repeat(50),{maxCells:10,maxChars:60});assert.deepEqual([big.added,big.removed],[50,50]);assert.match(big.diff,/diff truncated$/);
});
test('tool output shows only the newest exchange with continuation details',async()=>{
  const discuss=createDiscussions(async i=>({result:`## 回复 ${i.request.slice(0,8)}\n建议先验证调用方`,reported_models:['gpt-x']}));
  const first=await discuss(start);const update=renderDiscussionUpdate(first);
  assert.match(update,/^### Codex · 第 1\/2 轮/);assert.match(update,/^##### 回复/m);assert.match(update,/CLI 报告使用 gpt-x/);
  assert(update.includes('session_id: `'+first.session_id+'`'));assert.match(update,/status: open（剩余 1 轮）/);assert(!update.includes('初步判断'));
  const final=await discuss({peer:'codex',action:'finish',session_id:first.session_id,host_message:'采用方案 A'});
  assert.match(renderDiscussionUpdate(final),/### 讨论已结束\n\n采用方案 A[\s\S]*stop_reason: host-finished/);
  const transcript=renderTranscript(final);
  assert.match(transcript,/^# Claude Code ↔ Codex 讨论记录\n\n> Debug 空数组/);assert.match(transcript,/## 结论 · Claude Code\n\n采用方案 A/);
  assert.match(transcript,/### 第 1 轮 · Codex/);assert(!transcript.includes('```text'));
});
test('long host messages collapse and peer errors stay verbatim',async()=>{
  const failed=createDiscussions(async()=>{throw Error('login <required>');});
  const r=await failed({...start,host_message:'证据'.repeat(500)});const md=renderTranscript(r);
  assert.match(md,/<summary>展开发言（1000 字）<\/summary>/);assert.match(md,/## 结束原因 · 对方调用失败\n\n```text\nlogin <required>\n```/);
  assert.match(renderDiscussionUpdate(r),/调用失败[\s\S]*stop_reason: peer-error/);
  assert.match(renderPeerResult({peer:'claude',mode:'review',requested:{model:null,effort:'high'},result:'# 结论\nok'}),/^### Claude Code · review（只读快照）\n\n\*模型 CLI 默认 · 思考强度 high（请求值）\*\n\n#### 结论/);
});
