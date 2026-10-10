const limit = 2 * 1024 * 1024;
function notice(message) {
  let el = document.getElementById('network-notice');
  if (!el) {
    el = document.createElement('div'); el.id = 'network-notice'; el.setAttribute('role','status');
    el.style.cssText = 'position:fixed;top:4px;left:4px;right:4px;z-index:10000;padding:8px;background:#7f1d1d;color:white;font:13px sans-serif;white-space:normal';
    document.body.append(el);
  }
  el.textContent = message;
}
function wake(state) { for (const done of state.waiters.splice(0)) done(); }
function fail(state,error) { state.error=error; state.ended=true; wake(state); notice(error); }
export default {
  async Java_pl_zb3_freej2me_bridge_network_NetworkBridge_open(lib,host,port,secure) {
    const s={queue:[],size:0,waiters:[],ended:false,error:null};
    const url=new URL('/socket',location.href); url.protocol=location.protocol==='https:'?'wss:':'ws:';
    url.search=new URLSearchParams({host,port:String(port),secure:secure?'1':'0'});
    s.ws=new WebSocket(url); s.ws.binaryType='arraybuffer';
    let finish;
    const ready=new Promise(resolve => {finish=resolve;});
    const timer=setTimeout(()=>{fail(s,'Kết nối máy chủ game quá thời gian.');s.ws.close();finish();},15000);
    s.ws.onmessage=event=>{
      if(typeof event.data==='string') {
        try { const info=JSON.parse(event.data); if(info.type==='ready'){document.getElementById('network-notice')?.remove();clearTimeout(timer);finish();} else if(info.type==='error'){fail(s,info.message);clearTimeout(timer);finish();} } catch {fail(s,'Phản hồi mạng không hợp lệ.');finish();}
      } else {
        const bytes=new Uint8Array(event.data);
        if(s.size+bytes.length>limit) {fail(s,'Bộ đệm mạng đầy.');s.ws.close();return;}
        s.queue.push(bytes); s.size+=bytes.length; wake(s);
      }
    };
    s.ws.onerror=()=>{fail(s,'Không mở được cầu nối WebSocket tới '+host+':'+port+'.');clearTimeout(timer);finish();};
    s.ws.onclose=()=>{s.ended=true;clearTimeout(timer);wake(s);finish();};
    await ready;
    if(s.ended && !s.error) s.error='Máy chủ đóng kết nối.';
    return s;
  },
  async Java_pl_zb3_freej2me_bridge_network_NetworkBridge_read(lib,s,bytes,off,len) {
    while(!s.size && !s.ended) await new Promise(resolve=>s.waiters.push(resolve));
    if(!s.size) return s.error ? -2 : -1;
    let count=0;
    while(s.queue.length && count<len) {
      const chunk=s.queue[0], n=Math.min(chunk.length,len-count);
      bytes.set(chunk.subarray(0,n),off+count); count+=n; s.size-=n;
      if(n===chunk.length) s.queue.shift(); else s.queue[0]=chunk.subarray(n);
    }
    return count;
  },
  async Java_pl_zb3_freej2me_bridge_network_NetworkBridge_write(lib,s,bytes,off,len) {
    while(s.ws.bufferedAmount>limit && !s.ended) await new Promise(resolve=>setTimeout(resolve,10));
    if(s.ended || s.ws.readyState!==WebSocket.OPEN) return false;
    try {s.ws.send(new Uint8Array(bytes.buffer,bytes.byteOffset+off,len));return true;} catch {fail(s,'Không gửi được dữ liệu game.');return false;}
  },
  async Java_pl_zb3_freej2me_bridge_network_NetworkBridge_available(lib,s) {return s.size;},
  async Java_pl_zb3_freej2me_bridge_network_NetworkBridge_close(lib,s) {s.ended=true;s.ws.close();wake(s);},
  async Java_pl_zb3_freej2me_bridge_network_NetworkBridge_error(lib,s) {return s.error || null;},
  async Java_pl_zb3_freej2me_bridge_network_NetworkBridge_request(lib,url,method,pairs,body) {
    const headers={}; for(let i=0;i<pairs.length;i+=2) headers[pairs[i]]=pairs[i+1];
    try {
      const response=await fetch('/http',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url,method,headers,body:Array.from(body, x=>x&255)}),signal:AbortSignal.timeout(20000)});
      const result=await response.json();
      if(!response.ok) throw new Error(result.error || 'HTTP game bị từ chối.');
      return {status:result.status,headers:result.headers,bytes:new Int8Array(Uint8Array.from(atob(result.body),c=>c.charCodeAt(0)).buffer)};
    } catch(error) {
      let destination='HTTP'; try {destination=new URL(url).host;} catch {}
      notice(destination+': '+error.message);return {status:0,error:error.message};
    }
  },
  async Java_pl_zb3_freej2me_bridge_network_NetworkBridge_status(lib,r) {return r.status;},
  async Java_pl_zb3_freej2me_bridge_network_NetworkBridge_header(lib,r,name) {return r.headers?.[name.toLowerCase()] ?? null;},
  async Java_pl_zb3_freej2me_bridge_network_NetworkBridge_headerName(lib,r,index) {return Object.keys(r.headers||{})[index] ?? null;},
  async Java_pl_zb3_freej2me_bridge_network_NetworkBridge_body(lib,r) {return r.bytes;}
};
