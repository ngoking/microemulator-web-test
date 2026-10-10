import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import net from 'node:net';
import {WebSocket} from 'ws';
import {createGateway,publicIPv4} from './server.mjs';

test('blocks private, loopback, carrier NAT and non-IPv4 addresses',()=>{
  for(const ip of ['127.0.0.1','10.1.2.3','172.16.0.1','192.168.0.1','169.254.169.254','100.64.0.1','::1','::ffff:127.0.0.1','0.0.0.0','224.0.0.1','198.18.0.1']) assert.equal(publicIPv4(ip),false,ip);
  assert.equal(publicIPv4('8.8.8.8'),true);
});
test('binary TCP relay accepts approved names and DNS-matching IPv4 aliases',async()=>{
  const echo=net.createServer(s=>s.on('data',bytes=>s.end(bytes)));
  echo.listen(0,'127.0.0.1');await once(echo,'listening');
  const gateway=createGateway({targets:['game.example:14445'],resolve:async()=>[{address:'8.8.8.8',family:4}],dial:()=>net.createConnection({host:'127.0.0.1',port:echo.address().port})});
  gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
  const host=`127.0.0.1:${gateway.address().port}`;
  try {
    for(const target of ['game.example','8.8.8.8']) {
    const ws=new WebSocket(`ws://${host}/socket?host=${target}&port=14445`,{origin:`http://${host}`});
    const messages=[];ws.on('message',(data,binary)=>messages.push({data,binary}));
    await once(ws,'message');assert.equal(JSON.parse(messages[0].data).type,'ready');
    const packet=Buffer.from([0,128,255,1,0,34]);
    const received=once(ws,'message');const closed=once(ws,'close');ws.send(packet);
    const [bytes,binary]=await received;assert.equal(binary,true);assert.deepEqual(bytes,packet);await closed;
    }
  } finally {await new Promise(r=>gateway.close(r));await new Promise(r=>echo.close(r));}
});
test('rejects wrong origins, unapproved game targets and DNS resolving privately',async()=>{
  let dialed=false;
  const gateway=createGateway({targets:['game.example:14445'],resolve:async()=>[{address:'127.0.0.1',family:4}],dial:()=>{dialed=true;throw new Error('must not dial');}});
  gateway.listen(0,'127.0.0.1');await once(gateway,'listening');const host=`127.0.0.1:${gateway.address().port}`;
  async function rejected(target,origin,status) {
    const ws=new WebSocket(`ws://${host}/socket?${target}`,{origin});
    const response=await new Promise((resolve,reject)=>{ws.once('unexpected-response',(req,res)=>{resolve(res.statusCode);res.resume();req.destroy();});ws.once('open',()=>reject(new Error('accepted forbidden socket')));ws.on('error',()=>{});});
    assert.equal(response,status);
  }
  try {
    await rejected('host=game.example&port=14445','http://evil.example',403);
    await rejected('host=other.example&port=14445',`http://${host}`,403);
    await rejected('host=game.example&port=14445',`http://${host}`,502);
    await rejected('host=8.8.8.8&port=14445',`http://${host}`,403);
    await rejected('host=127.0.0.1&port=14445',`http://${host}`,403);
    assert.equal(dialed,false);
  } finally {await new Promise(r=>gateway.close(r));}
});

test('rejects public IPv4 addresses outside approved DNS and ports',async()=>{
  let dialed=false;
  const gateway=createGateway({targets:['game.example:14445'],resolve:async()=>[{address:'8.8.8.8',family:4}],dial:()=>{dialed=true;throw new Error('must not dial');}});
  gateway.listen(0,'127.0.0.1');await once(gateway,'listening');const host=`127.0.0.1:${gateway.address().port}`;
  try {
    for(const query of ['host=8.8.4.4&port=14445','host=8.8.8.8&port=14446']) {
      const ws=new WebSocket(`ws://${host}/socket?${query}`,{origin:`http://${host}`});
      const status=await new Promise((resolve,reject)=>{ws.once('unexpected-response',(req,res)=>{resolve(res.statusCode);res.resume();req.destroy();});ws.once('open',()=>reject(new Error('accepted forbidden IP')));ws.on('error',()=>{});});
      assert.equal(status,403);
    }
    assert.equal(dialed,false);
  } finally {await new Promise(r=>gateway.close(r));}
});
