import express from 'express';
import {WebSocketServer, WebSocket} from 'ws';
import http from 'node:http';
import net from 'node:net';
import tls from 'node:tls';
import dns from 'node:dns/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.dirname(fileURLToPath(import.meta.url));
const defaults=Array.from({length:11},(_,i)=>`dragon${i+1}.teamobi.com:14445`).concat(['dragon15.teamobi.com:14445','dragon10.teamobi.com:14446','dragon10.teamobi.com:14447','dragonwar.teamobi.com:20000','dragon.indonaga.com:14445','dragon.indonaga.com:14446']);
const httpHosts=new Set(['ngocrongonline.com','www.ngocrongonline.com','dragonball.indonaga.com','world.teamobi.com']);
export function publicIPv4(ip) {
  if(net.isIP(ip)!==4) return false;
  const [a,b,c]=ip.split('.').map(Number);
  return !(a===0 || a===10 || a===127 || a>=224 || (a===100&&b>=64&&b<=127) || (a===169&&b===254) || (a===172&&b>=16&&b<=31) || (a===192&&(b===168 || (b===0&&c<=2))) || (a===198&&(b===18 || b===19 || (b===51&&c===100))) || (a===203&&b===0&&c===113));
}
export function createGateway({webRoot=process.env.WEB_ROOT || path.join(root,'web'),targets=defaults,resolve=dns.lookup,dial=options=>options.secure ? tls.connect(options) : net.createConnection(options)}={}) {
  const allowed=new Set(targets), app=express(), server=http.createServer(app);
  const wsServer=new WebSocketServer({noServer:true,maxPayload:1024*1024,perMessageDeflate:false});
  let active=0;
  function sameOrigin(req) {return req.headers.origin && (()=>{try{return new URL(req.headers.origin).host===req.headers.host;}catch{return false;}})();}
  async function address(host) {
    const entries=await resolve(host,{all:true,family:4});
    if(!entries.length || entries.some(item=>!publicIPv4(item.address))) throw new Error('Địa chỉ máy chủ bị từ chối.');
    return entries[0].address;
  }
  async function socketAddress(host,port) {
    if(allowed.has(`${host}:${port}`)) return address(host);
    if(!publicIPv4(host)) return null;
    // Some clients replace the approved domain with its resolved IPv4 address.
    // Accept only addresses currently returned by DNS for an approved endpoint.
    const candidates=[...allowed].filter(target=>target.endsWith(`:${port}`)).map(target=>target.slice(0,target.lastIndexOf(':')));
    const checks=await Promise.allSettled(candidates.map(async name=>{
      const entries=await resolve(name,{all:true,family:4});
      return entries.length && entries.every(entry=>publicIPv4(entry.address)) && entries.some(entry=>entry.address===host);
    }));
    return checks.some(check=>check.status==='fulfilled' && check.value) ? host : null;
  }
  app.disable('x-powered-by');
  app.get('/healthz',(req,res)=>res.json({ok:true,network:true}));
  app.post('/http',express.json({limit:'512kb'}),async(req,res)=>{
    try {
      if(!sameOrigin(req)) return res.status(403).json({error:'Origin bị từ chối.'});
      const url=new URL(req.body.url), method=req.body.method;
      if(!['http:','https:'].includes(url.protocol) || url.username || url.password || url.port || !httpHosts.has(url.hostname) || !['GET','POST','HEAD'].includes(method)) return res.status(403).json({error:'Trang HTTP này chưa được cho phép.'});
      const ip=await address(url.hostname), requestHeaders={};
      for(const [key,value] of Object.entries(req.body.headers||{})) if(/^(accept|content-type|user-agent)$/i.test(key)) requestHeaders[key]=String(value);
      requestHeaders.host=url.host;
      const transport=url.protocol==='https:' ? await import('node:https') : http;
      const outbound=transport.request(url,{method,headers:requestHeaders,lookup:(host,options,callback)=>options.all?callback(null,[{address:ip,family:4}]):callback(null,ip,4)},reply=>{
        let size=0;const chunks=[];
        reply.on('data',data=>{size+=data.length;if(size>2*1024*1024){outbound.destroy(new Error('HTTP response too large'));return;}chunks.push(data);});
        reply.on('end',()=>res.json({status:reply.statusCode,headers:reply.headers,body:Buffer.concat(chunks).toString('base64')}));
        reply.on('error',()=>{if(!res.headersSent)res.status(502).json({error:'HTTP game đóng kết nối.'});});
      });
      outbound.setTimeout(15000,()=>outbound.destroy(new Error('HTTP timeout')));
      outbound.on('error',()=>{if(!res.headersSent)res.status(502).json({error:'Không kết nối được trang HTTP game.'});});
      if(method==='POST') outbound.write(Buffer.from(req.body.body||[]));
      outbound.end();
    } catch {if(!res.headersSent)res.status(502).json({error:'HTTP game không khả dụng.'});}
  });
  app.get('/run',(req,res)=>res.sendFile(path.join(webRoot,'run.html')));
  app.use(express.static(webRoot,{setHeaders(res,p){if(/\.(html|js|jar)$/.test(p)) res.setHeader('Cache-Control','no-cache');}}));
  server.on('upgrade',async(req,socket,head)=>{
    try {
      const url=new URL(req.url,'http://local'), host=url.searchParams.get('host')?.toLowerCase(), port=Number(url.searchParams.get('port'));
      if(url.pathname!=='/socket' || !sameOrigin(req) || !Number.isInteger(port) || port<1 || port>65535 || (!allowed.has(`${host}:${port}`) && !publicIPv4(host))) {socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
      if(active>=8){socket.end('HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n');return;}
      const ip=await socketAddress(host,port);
      if(!ip){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
      if(socket.destroyed) return;
      wsServer.handleUpgrade(req,socket,head,ws=>{
        active++; let done=false;
        const secure=url.searchParams.get('secure')==='1';
        const tcp=dial({host:ip,port,secure,servername:host,rejectUnauthorized:true});
        const timer=setTimeout(()=>tcp.destroy(new Error('connect timeout')),10000);
        function cleanup(){if(done)return;done=true;active--;clearTimeout(timer);clearInterval(heartbeat);tcp.destroy();}
        let alive=true;
        const heartbeat=setInterval(()=>{if(!alive){ws.terminate();return;}alive=false;ws.ping();},25000);
        ws.on('pong',()=>{alive=true;});
        tcp.on(secure?'secureConnect':'connect',()=>{clearTimeout(timer);tcp.setNoDelay(true);tcp.setKeepAlive(true,30000);ws.send(JSON.stringify({type:'ready'}));});
        tcp.on('data',data=>{if(ws.readyState!==WebSocket.OPEN)return;if(ws.bufferedAmount>2*1024*1024){tcp.destroy(new Error('buffer limit'));return;}ws.send(data);});
        tcp.on('error',()=>{if(ws.readyState===WebSocket.OPEN){ws.send(JSON.stringify({type:'error',message:'Không kết nối được máy chủ game.'}));ws.close(1011,'Game server unavailable');}});
        tcp.on('end',()=>{if(ws.readyState===WebSocket.OPEN)ws.close(1000,'Game server closed');});
        tcp.on('close',()=>{cleanup();if(ws.readyState===WebSocket.OPEN)ws.close();});
        ws.on('message',(data,binary)=>{if(!binary){ws.close(1003,'Binary only');return;}if(tcp.writableLength>2*1024*1024){ws.close(1009,'Buffer limit');return;}tcp.write(data);});
        ws.on('close',cleanup);ws.on('error',cleanup);
      });
    } catch {if(!socket.destroyed)socket.end('HTTP/1.1 502 Bad Gateway\r\nConnection: close\r\n\r\n');}
  });
  server.on('close',()=>{for(const ws of wsServer.clients)ws.terminate();wsServer.close();});
  return server;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) createGateway().listen(Number(process.env.PORT||10000),'0.0.0.0',()=>console.log('J2ME web ready'));
