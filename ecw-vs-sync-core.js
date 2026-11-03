/* Three-way merge; never resolves a concurrent edit to the same value silently. */
(function(root){'use strict';
const eq=(a,b)=>JSON.stringify(sort(a))===JSON.stringify(sort(b));
function sort(x){if(Array.isArray(x))return x.map(sort);if(x&&typeof x==='object'){const o={};Object.keys(x).sort().forEach(k=>o[k]=sort(x[k]));return o}return x}
function merge(base,local,remote){let conflicts=[];
 function walk(b,l,r,path){if(eq(l,r))return l;if(eq(l,b))return r;if(eq(r,b))return l;
  if(typeof b==='string'&&typeof l==='string'&&typeof r==='string'){try{return JSON.stringify(walk(JSON.parse(b),JSON.parse(l),JSON.parse(r),path))}catch{}}
  const obj=x=>x&&typeof x==='object'&&!Array.isArray(x);
  if(obj(l)&&obj(r)&&(obj(b)||b===undefined)){const out={};for(const k of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){const v=walk(b?.[k],l[k],r[k],path+'.'+k);if(v!==undefined)out[k]=v}return out}
  if(Array.isArray(b)&&Array.isArray(l)&&Array.isArray(r)){
   const key=x=>x&&typeof x==='object'?(x.id!==undefined?'id:'+x.id:x.mobileId?'mobile:'+x.mobileId:x.key!==undefined?'key:'+JSON.stringify(x.key):null):null;
   if([...b,...l,...r].every(x=>key(x)!==null)&&[b,l,r].every(a=>new Set(a.map(key)).size===a.length)){
    const maps=[b,l,r].map(a=>new Map(a.map(x=>[key(x),x]))),out=[];
    const common=b.map(key).filter(k=>maps[1].has(k)&&maps[2].has(k)),lo=l.map(key).filter(k=>common.includes(k)),ro=r.map(key).filter(k=>common.includes(k));
    const lm=!eq(common,lo),rm=!eq(common,ro);if(lm&&rm&&!eq(lo,ro))conflicts.push(path+'.order');
    const order=!lm&&rm?[...r.map(key),...l.map(key)]:[...l.map(key),...r.map(key)];
    for(const k of new Set([...order,...b.map(key)])){const v=walk(maps[0].get(k),maps[1].get(k),maps[2].get(k),path+'['+k+']');if(v!==undefined)out.push(v)}return out;
   }
   if(eq(l.slice(0,b.length),b)&&eq(r.slice(0,b.length),b)){return [...b,...l.slice(b.length),...r.slice(b.length).filter(x=>!l.slice(b.length).some(y=>eq(x,y)))]}
   // Fixed report sections have no IDs; merge their fields by position.
   if(b.length===l.length&&b.length===r.length&&b.every(x=>obj(x)&&typeof x.title==='string'&&Array.isArray(x.items)))return b.map((x,i)=>walk(x,l[i],r[i],path+'['+i+']'));
  }
  conflicts.push(path);return l;
 }
 const backup=walk(base,local,remote,'backup');return {backup,conflicts};
}
const api={eq,merge};root.ECWMeetingSyncCore=api;if(typeof module!=='undefined')module.exports=api;
})(typeof window==='undefined'?globalThis:window);
