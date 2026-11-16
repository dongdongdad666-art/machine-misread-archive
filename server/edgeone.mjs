const environmentNames=['DASHSCOPE_API_KEY','DASHSCOPE_BASE_URL','DASHSCOPE_VISION_MODEL','DASHSCOPE_MODEL_SNAPSHOT','DASHSCOPE_EMBEDDING_MODEL','SUPABASE_URL','SUPABASE_SERVICE_ROLE_KEY','QUOTA_SALT'];

// Platform requests may contain a Web stream or an already parsed JSON body.
// Reconstruct a Web Request without trusting client-supplied proxy identity.
export function adapt(handler){
 return async function onRequest(context){
  const incoming=context.request;
  const headers=new Headers(incoming.headers);
  for(const name of ['x-vercel-forwarded-for','x-forwarded-for','x-real-ip'])headers.delete(name);
  if(typeof context.clientIp==='string'&&context.clientIp.trim())headers.set('x-forwarded-for',context.clientIp.trim());
  const environment={...process.env};
  for(const name of environmentNames)if(typeof context.env?.[name]==='string')environment[name]=context.env[name];
  let request;
  if(incoming instanceof Request){request=new Request(incoming,{headers});}
  else {
   const method=incoming.method||'GET';let body=incoming.body;
   if(body!==undefined&&body!==null&&typeof body==='object'&&!ArrayBuffer.isView(body)&&!(body instanceof ArrayBuffer)&&typeof body.getReader!=='function'&&!(body instanceof Blob))body=JSON.stringify(body);
   headers.delete('content-length');
   request=new Request(incoming.url,{method,headers,...(['GET','HEAD'].includes(method)?{}:{body,duplex:'half'})});
  }
  const response=await handler.fetch(request,environment);
  const responseHeaders=new Headers(response.headers);
  responseHeaders.set('Cache-Control','no-store');responseHeaders.set('X-Content-Type-Options','nosniff');
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:responseHeaders});
 };
}
