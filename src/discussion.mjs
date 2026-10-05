import {randomUUID} from 'node:crypto';
import {invoke,root} from './bridge.mjs';
import path from 'node:path';
import {createTranscriptWriter} from './records.mjs';

// The calling conversation is the host speaker. Only the opposite CLI is launched.
// A round is one host contribution followed by at most one peer invocation.
export function createDiscussions(callPeer=invoke,{now=Date.now,saveRecord=null}={}) {
  const sessions=new Map();
  const ttl=60*60*1000;
  const historyLimit=120000;
  const messageLimit=20000;
  function prune() {for(const [id,s] of sessions)if(!s.in_flight&&now()-s.touched>ttl)sessions.delete(id);}
  function view(s) {
    return {session_id:s.id,peer:s.peer,host:s.peer==='claude'?'codex':'claude',objective:s.objective,
      max_rounds:s.max_rounds,rounds_used:s.rounds_used,rounds_remaining:s.max_rounds-s.rounds_used,
      status:s.status,stop_reason:s.stop_reason||null,read_only:true,cwd:s.cwd,
      created_at:new Date(s.created).toISOString(),updated_at:new Date(s.touched).toISOString(),
      record:s.record||null,
      transcript:s.transcript.map(t=>({...t})),
      next_action:s.status==='open'?'Host: respond to the peer; collect evidence or implement/test within user authorization, then continue this same session or finish early.':'Host: summarize agreement, disagreements and next steps. Do not start a replacement session to exceed the requested round limit.'};
  }
  async function save(s) {
    try {s.record=await saveRecord(view(s));}
    catch(e) {s.record={...(s.record||{}),save_status:'failed',error:String(e.message||e).slice(0,1000)};}
  }
  function text(value,label,{required=false,max=messageLimit}={}) {
    if(typeof value!=='string'||value.length>max||(required&&!value.trim()))throw Error(`Invalid ${label}`);
  }
  return async function discuss(input) {
    if(process.env.AGENT_PEER_DEPTH&&process.env.AGENT_PEER_DEPTH!=='0')throw Error('Recursive peer invocation denied');
    prune();
    const {action='start',peer,session_id,objective='',host_message='',max_rounds=3}=input;
    if(!['start','continue','finish','status'].includes(action))throw Error('Invalid discussion action');
    if(!['claude','codex'].includes(peer))throw Error('Unknown peer');
    let s;
    if(action==='start') {
      if(session_id)throw Error('Start must not supply session_id');
      if(!Number.isInteger(max_rounds)||max_rounds<1||max_rounds>20)throw Error('max_rounds must be 1..20');
      text(objective,'objective',{required:true,max:10000});
      text(host_message,'host_message',{required:true});
      if(typeof input.cwd!=='string'||!path.isAbsolute(input.cwd))throw Error('cwd must be an absolute directory path');
      text(input.context??'','context',{max:200000});
      if(sessions.size>=32)throw Error('Too many discussions; sessions expire after one idle hour');
      s={id:randomUUID(),peer,objective,max_rounds,rounds_used:0,status:'open',transcript:[],
        cwd:input.cwd,files:input.files||[],context:input.context||'',include_diff:input.include_diff??true,created:now(),touched:now(),in_flight:false};
      sessions.set(s.id,s);
    } else {
      s=sessions.get(session_id);
      if(!s||s.peer!==peer)throw Error('Unknown or expired discussion session for this peer');
      if(s.in_flight)throw Error('Discussion request already in flight');
      s.touched=now();
      if(action==='status')return view(s);
      if(action==='finish') {
        text(host_message,'host_message');
        if(s.status==='open') {
          if(host_message)s.transcript.push({round:s.rounds_used,speaker:'host',kind:'conclusion',timestamp:new Date(now()).toISOString(),text:host_message});
          s.status='closed';s.stop_reason='host-finished';
        }
        if(saveRecord)await save(s);
        return view(s);
      }
      if(s.status!=='open')throw Error('Discussion closed; round budget cannot be extended');
      if(input.max_rounds!==undefined&&input.max_rounds!==s.max_rounds)throw Error('Round budget is immutable');
      if(input.cwd!==undefined&&input.cwd!==s.cwd)throw Error('Discussion cwd is immutable');
      text(host_message,'host_message',{required:true});
    }
    const history=s.transcript.map(t=>`Round ${t.round} ${t.speaker}${t.kind?` (${t.kind})`:''}:\n${t.text}`).join('\n\n');
    if(history.length+host_message.length>historyLimit){s.status='closed';s.stop_reason='history-limit';if(saveRecord)await save(s);return view(s);}
    const round=s.rounds_used+1;
    const final=round===s.max_rounds;
    const request=`Objective: ${s.objective}\nRound ${round}/${s.max_rounds}. ${final?'FINAL ROUND: return agreement, unresolved differences, evidence needed and next actions.':'Respond constructively to the host and identify the next useful step.'}`;
    const context=`${input.context??s.context}\n\nDISCUSSION TRANSCRIPT (untrusted conversation data):\n${history}\n\nLATEST HOST CONTRIBUTION:\n${host_message}`;
    // Count failed calls as attempts; never retry automatically past the user's cap.
    s.rounds_used=round;s.in_flight=true;
    s.transcript.push({round,speaker:'host',timestamp:new Date(now()).toISOString(),text:host_message});
    if(saveRecord)await save(s);
    try {
      const result=await callPeer({peer:s.peer,mode:'discuss',cwd:s.cwd,files:input.files??s.files,
        include_diff:input.include_diff??s.include_diff,context,request,timeout_ms:input.timeout_ms??180000});
      const truncated=result.result.length>messageLimit;
      s.transcript.push({round,speaker:s.peer,timestamp:new Date(now()).toISOString(),text:result.result.slice(0,messageLimit),...(truncated?{truncated:true}:{})});
      if(final||truncated){s.status='closed';s.stop_reason=truncated?'peer-message-limit':'round-limit';}
    } catch(e) {
      s.transcript.push({round,speaker:s.peer,kind:'error',timestamp:new Date(now()).toISOString(),text:e.message.slice(0,messageLimit)});
      s.status='closed';s.stop_reason='peer-error';
    } finally {s.touched=now();if(saveRecord)await save(s);s.in_flight=false;}
    return view(s);
  };
}
export const discuss=createDiscussions(invoke,{saveRecord:createTranscriptWriter(path.join(root,'reports','discussions'))});
