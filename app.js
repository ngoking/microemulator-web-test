import networkNatives from './network.js';
const status=document.getElementById('status');
let host,starting=false;
let inputQueue=Promise.resolve();
function javaInput(action){inputQueue=inputQueue.then(action).catch(()=>{status.textContent='Không gửi được thao tác. Thử lại sau khi game tải xong.';});return inputQueue;}
async function start(probe=false){
  if(starting)return;
  const file=document.getElementById('file').files[0];
  if(!probe&&!file){status.textContent='Chọn file JAR trước.';return;}
  if(file&&file.size>30*1024*1024){status.textContent='Bản thử hỗ trợ JAR tối đa 30 MB.';return;}
  starting=true;document.querySelectorAll('#setup button').forEach(b=>b.disabled=true);
  try{
    status.textContent='Đang tải bộ Java...';
    await cheerpjInit({version:8,natives:networkNatives,javaProperties:['user.home=/files/microemu-test']});
    const runtime=await fetch('microemulator-web.jar');if(!runtime.ok)throw new Error('Không tải được giả lập');
    cheerpOSAddStringFile('/str/microemulator-web.jar',new Uint8Array(await runtime.arrayBuffer()));
    const game=probe?await(await fetch('probe.jar')).arrayBuffer():await file.arrayBuffer();
    cheerpOSAddStringFile('/str/game.jar',new Uint8Array(game));
    document.getElementById('setup').hidden=true;document.getElementById('running').hidden=false;
    document.querySelectorAll('#controls button').forEach(button=>button.disabled=true);
    cheerpjCreateDisplay(240,320,document.getElementById('stage'));
    const lib=await cheerpjRunLibrary('/str/microemulator-web.jar');
    const launcher=await lib.local.microemu.BrowserMain;
    status.textContent='Đang mở '+(probe?'bài kiểm tra':file.name)+'...';
    await launcher.launch('/str/game.jar');
    host=launcher;
    document.querySelectorAll('#controls button').forEach(button=>button.disabled=false);
    status.textContent='Đã mở giả lập. Dùng cảm ứng, chuột hoặc các nút bên dưới.';
  }catch(error){status.textContent='Không khởi động được: '+error.message+'. Tải lại trang để thử lại.';}
}
document.getElementById('start').onclick=()=>start();
document.getElementById('probe').onclick=()=>start(true);
document.getElementById('restart').onclick=()=>location.reload();
document.getElementById('choose-jar').onclick=()=>location.reload();
const numbers=document.getElementById('numbers');
for(const char of '123456789*0#'){
  const button=document.createElement('button');button.textContent=char;
  button.dataset.code=String(char.charCodeAt(0));button.dataset.character=String(char.charCodeAt(0));numbers.append(button);
}
for(const button of document.querySelectorAll('[data-code]')){
  let pressed=false;
  button.onpointerdown=e=>{e.preventDefault();if(!host)return;pressed=true;button.setPointerCapture(e.pointerId);javaInput(()=>host.key(Number(button.dataset.code),Number(button.dataset.character||65535),true));};
  const release=()=>{if(!pressed)return;pressed=false;javaInput(()=>host.key(Number(button.dataset.code),Number(button.dataset.character||65535),false));};
  button.onpointerup=release;button.onpointercancel=release;button.onlostpointercapture=release;
}
document.getElementById('backspace').onclick=()=>{if(host)javaInput(async()=>{await host.key(8,8,true);await host.key(8,8,false);});};
const dialog=document.getElementById('text-dialog'),text=document.getElementById('text-value');
document.getElementById('text-button').onclick=()=>{text.value='';dialog.showModal();text.focus();};
document.getElementById('insert').onclick=async()=>{const value=text.value;if(host)await javaInput(()=>host.paste(value));text.value='';dialog.close();};
dialog.onclose=()=>{text.value='';};

// Keep Shift and printable keyboard characters out of the
// emulator's keypad mapping. Scope this to its display, never the HTML dialog.
const stage=document.getElementById('stage');
const typedKeys=new Set();
const stop=e=>{e.preventDefault();e.stopImmediatePropagation();};
stage.addEventListener('keydown',e=>{
  if(!host||e.isComposing||(e.ctrlKey&&!e.altKey)||e.metaKey||e.key.length!==1)return;
  stop(e);typedKeys.add(e.code||e.key);
  javaInput(()=>host.typeText(e.key,e.keyCode||0));
},true);
stage.addEventListener('keyup',e=>{
  const key=e.code||e.key;
  if(!typedKeys.delete(key))return;
  stop(e);
},true);
