// Line-based unified diff for edit records. Exact LCS on the changed middle; a middle larger
// than maxCells falls back to remove-all/add-all so a huge rewrite cannot stall the bridge.
const noEol='\u0000';
function split(text) {
  if(text===null||text==='')return [];
  const lines=text.split('\n');
  if(lines.at(-1)==='')lines.pop();else lines[lines.length-1]+=noEol;
  return lines;
}
function operations(a,b,maxCells) {
  let start=0;while(start<a.length&&start<b.length&&a[start]===b[start])start++;
  let endA=a.length,endB=b.length;while(endA>start&&endB>start&&a[endA-1]===b[endB-1]){endA--;endB--;}
  const result=a.slice(0,start).map(line=>[' ',line]);
  const x=a.slice(start,endA),y=b.slice(start,endB),n=x.length,m=y.length;
  if(n*m>maxCells)result.push(...x.map(line=>['-',line]),...y.map(line=>['+',line]));
  else {
    const w=m+1,table=new Uint32Array((n+1)*w);
    for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)table[i*w+j]=x[i]===y[j]?table[(i+1)*w+j+1]+1:Math.max(table[(i+1)*w+j],table[i*w+j+1]);
    let i=0,j=0;
    while(i<n||j<m) {
      if(i<n&&j<m&&x[i]===y[j]){result.push([' ',x[i]]);i++;j++;}
      else if(i<n&&(j===m||table[(i+1)*w+j]>=table[i*w+j+1]))result.push(['-',x[i++]]);
      else result.push(['+',y[j++]]);
    }
  }
  result.push(...a.slice(endA).map(line=>[' ',line]));
  return result;
}
export function unifiedDiff(before,after,{path:name='file',context=3,maxChars=12000,maxCells=4e6}={}) {
  const ops=operations(split(before),split(after),maxCells);
  const added=ops.filter(o=>o[0]==='+').length,removed=ops.filter(o=>o[0]==='-').length;
  if(!added&&!removed)return {added,removed,diff:''};
  let oldLine=1,newLine=1;
  const rows=ops.map(([type,text])=>{const row={type,text,oldLine,newLine};if(type!=='+')oldLine++;if(type!=='-')newLine++;return row;});
  const changed=rows.flatMap((row,i)=>row.type===' '?[]:[i]);
  const out=[`--- ${before===null?'/dev/null':'a/'+name}`,`+++ b/${name}`];
  for(let k=0;k<changed.length;k++) {
    const first=changed[k];
    while(k+1<changed.length&&changed[k+1]-changed[k]<=2*context+1)k++;
    const hunk=rows.slice(Math.max(0,first-context),Math.min(rows.length,changed[k]+context+1));
    const oldCount=hunk.filter(r=>r.type!=='+').length,newCount=hunk.filter(r=>r.type!=='-').length;
    out.push(`@@ -${oldCount?hunk.find(r=>r.type!=='+').oldLine:hunk[0].oldLine-1},${oldCount} +${newCount?hunk.find(r=>r.type!=='-').newLine:hunk[0].newLine-1},${newCount} @@`);
    for(const r of hunk) {
      out.push(r.type+r.text.replace(noEol,'').replace(/\r$/,''));
      if(r.text.endsWith(noEol))out.push('\\ No newline at end of file');
    }
  }
  let diff=out.join('\n');
  if(diff.length>maxChars)diff=diff.slice(0,maxChars).replace(/\n[^\n]*$/,'')+'\n… diff truncated';
  return {added,removed,diff};
}
