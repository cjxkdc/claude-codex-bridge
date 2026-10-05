export const effortLevels={
  claude:['low','medium','high','xhigh','max'],
  codex:['none','minimal','low','medium','high','xhigh','max','ultra']
};
export const modelPattern=/^[a-zA-Z0-9][a-zA-Z0-9._:/+\[\]-]{0,159}$/;
export function normalizeOptions(peer,{model,effort}={}) {
  if(!effortLevels[peer])throw Error('Unknown peer');
  if(model!==undefined&&(typeof model!=='string'||!modelPattern.test(model)))throw Error('Invalid model: use a CLI model ID or alias, without spaces or flags');
  if(effort!==undefined&&(typeof effort!=='string'||!([...effortLevels[peer],'auto','default'].includes(effort))))throw Error(`Invalid ${peer} effort; choose ${effortLevels[peer].join(', ')}, or auto/default`);
  return {model:model===undefined||['auto','default'].includes(model)?null:model,
    effort:effort===undefined||['auto','default'].includes(effort)?null:effort};
}
export function selectionArgs(peer,options={}) {
  const {model,effort}=normalizeOptions(peer,options);
  return [...(model?['--model',model]:[]),...(effort?(peer==='claude'?['--effort',effort]:['-c',`model_reasoning_effort=${JSON.stringify(effort)}`]):[])];
}
