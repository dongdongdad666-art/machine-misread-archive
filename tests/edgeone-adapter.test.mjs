// @vitest-environment node
import {describe,it,expect} from 'vitest';
import {adapt} from '../server/edgeone.mjs';

describe('EdgeOne request adapter',()=>{
 it.each(['json','text','stream','request'])('preserves %s request bodies and overrides spoofed quota identity',async kind=>{
  const payload={consent:true,image:{mimeType:'image/png',base64:'fixture'}};
  const headers={'content-type':'application/json','x-vercel-forwarded-for':'spoof','x-forwarded-for':'spoof','x-real-ip':'spoof'};
  const body=kind==='json'?payload:kind==='stream'?new Blob([JSON.stringify(payload)]).stream():JSON.stringify(payload);
  const request=kind==='request'?new Request('https://site.test/api/analyze',{method:'POST',headers,body}):{url:'https://site.test/api/analyze',method:'POST',headers,body};
  const response=await adapt({fetch:async(req,env)=>Response.json({body:await req.json(),ip:req.headers.get('x-forwarded-for'),vercel:req.headers.get('x-vercel-forwarded-for'),key:env.DASHSCOPE_API_KEY})})({request,clientIp:'203.0.113.7',env:{DASHSCOPE_API_KEY:'fixture-only'}});
  expect(await response.json()).toEqual({body:payload,ip:'203.0.113.7',vercel:null,key:'fixture-only'});expect(response.headers.get('cache-control')).toBe('no-store');
 });
 it('does not trust caller-supplied forwarding headers when platform IP is absent',async()=>{
  const res=await adapt({fetch:async req=>Response.json({ip:req.headers.get('x-forwarded-for'),real:req.headers.get('x-real-ip')})})({request:new Request('https://site.test/api/gap',{headers:{'x-forwarded-for':'spoof','x-real-ip':'spoof'}})});
  expect(await res.json()).toEqual({ip:null,real:null});
 });
 it('keeps deployment environments isolated across concurrent requests',async()=>{
  const before=process.env.DASHSCOPE_API_KEY;
  const handle=adapt({fetch:async(_,env)=>{await new Promise(r=>setTimeout(r,5));return Response.json({key:env.DASHSCOPE_API_KEY});}});
  const results=await Promise.all(['one','two'].map(async key=>(await handle({request:new Request('https://site.test/api/gap'),env:{DASHSCOPE_API_KEY:key}})).json()));
  expect(results).toEqual([{key:'one'},{key:'two'}]);expect(process.env.DASHSCOPE_API_KEY).toBe(before);
 });
});
