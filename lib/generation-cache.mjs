export class GenerationCache {
  entries=new Map;
  constructor({max=100,ttlMs=15*60*1000}={}){this.max=max;this.ttlMs=ttlMs}
  get(key,now=Date.now()){const value=this.entries.get(key);if(!value)return null;if(value.expires<=now){this.entries.delete(key);return null}this.entries.delete(key);this.entries.set(key,value);return structuredClone(value.data)}
  set(key,data,now=Date.now()){this.entries.delete(key);this.entries.set(key,{expires:now+this.ttlMs,data:structuredClone(data)});while(this.entries.size>this.max)this.entries.delete(this.entries.keys().next().value)}
}
export async function requestKey(model,body){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(model+JSON.stringify(body)));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')}
