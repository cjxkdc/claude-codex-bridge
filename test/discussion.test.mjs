import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createDiscussions} from '../src/discussion.mjs';
const start={peer:'claude',action:'start',objective:'Debug empty-array average',host_message:'I suspect division by zero',cwd:'C:/project',max_rounds:3};
test('three simulated exchanges pass prior reasoning and hard-stop without extra CLI calls',async()=>{
 const calls=[];const discuss=createDiscussions(async input=>{calls.push(input);return {result:`peer answer ${calls.length}`};});
 const a=await discuss(start);assert.equal(a.rounds_used,1);assert.equal(a.rounds_remaining,2);assert.equal(a.status,'open');
 const b=await discuss({peer:'claude',action:'continue',session_id:a.session_id,host_message:'Confirmed 0/0; should throw RangeError'});
 assert.equal(b.rounds_used,2);assert.match(calls[1].context,/peer answer 1/);assert.match(calls[1].context,/Confirmed 0\/0/);assert.equal(calls[1].mode,'discuss');
 const c=await discuss({peer:'claude',action:'continue',session_id:a.session_id,host_message:'Caller expects an error; final plan?' });
 assert.equal(c.status,'closed');assert.equal(c.stop_reason,'round-limit');assert.equal(c.transcript.length,6);assert.match(calls[2].request,/FINAL ROUND/);
 await assert.rejects(discuss({peer:'claude',action:'continue',session_id:a.session_id,host_message:'more'}),/closed/);assert.equal(calls.length,3);
});
test('immutable budget and peer identity; early finish costs no call',async()=>{
 let calls=0;const discuss=createDiscussions(async()=>{calls++;return {result:'agreed'};});const a=await discuss(start);
 await assert.rejects(discuss({peer:'claude',action:'continue',session_id:a.session_id,host_message:'x',max_rounds:10}),/immutable/);
 await assert.rejects(discuss({peer:'codex',action:'continue',session_id:a.session_id,host_message:'x'}),/Unknown/);
 const b=await discuss({peer:'claude',action:'finish',session_id:a.session_id,host_message:'Proceed with the fix'});
 assert.equal(b.stop_reason,'host-finished');assert.equal(calls,1);const c=await discuss({peer:'claude',action:'status',session_id:a.session_id});assert.equal(c.status,'closed');assert.equal(calls,1);
});
test('failed peer attempt preserves transcript and closes without automatic retry',async()=>{
 let calls=0;const discuss=createDiscussions(async()=>{calls++;throw Error('login required');});const a=await discuss(start);
 assert.equal(a.stop_reason,'peer-error');assert.equal(a.rounds_used,1);assert.equal(a.transcript[1].kind,'error');assert.match(a.transcript[1].text,/login/);assert.equal(calls,1);
});
test('invalid budgets rejected before calls; recursion guard also covers discussions',async()=>{
 let calls=0;const discuss=createDiscussions(async()=>{calls++;return {result:'x'};});
 for(const n of [0,21,1.5,'3'])await assert.rejects(discuss({...start,max_rounds:n}),/max_rounds/);
 process.env.AGENT_PEER_DEPTH='1';try{await assert.rejects(discuss(start),/Recursive/);}finally{delete process.env.AGENT_PEER_DEPTH;}assert.equal(calls,0);
});
test('same-session concurrent call cannot consume another round',async()=>{
 let release;let calls=0;const discuss=createDiscussions(async()=>{calls++;if(calls>1)await new Promise(r=>release=r);return {result:'response'};});
 const a=await discuss(start);const continuation={peer:'claude',action:'continue',session_id:a.session_id,host_message:'respond'};
 const pending=discuss(continuation);await assert.rejects(discuss(continuation),/in flight/);release();const b=await pending;assert.equal(b.rounds_used,2);assert.equal(calls,2);
});
test('session expiry and large peer replies stop gracefully',async()=>{
 let time=0;const discuss=createDiscussions(async()=>({result:'x'.repeat(20001)}),{now:()=>time});const a=await discuss(start);
 assert.equal(a.stop_reason,'peer-message-limit');assert.equal(a.transcript[1].truncated,true);time=3600001;
 await assert.rejects(discuss({peer:'claude',action:'status',session_id:a.session_id}),/expired/);
});
