from pathlib import Path
from urllib.request import urlretrieve
from zipfile import ZipFile, ZIP_DEFLATED
import argparse, subprocess, hashlib, shutil

root=Path(__file__).resolve().parent
cache=root/'build'; cache.mkdir(exist_ok=True)
web=root/'web'; (web/'source').mkdir(parents=True,exist_ok=True)
for name in ['index.html','app.js','network.js']: shutil.copy(root/name,web/name)
parser=argparse.ArgumentParser(); parser.add_argument('--ecj'); args=parser.parse_args()

def artifact(name, suffix=''):
    filename=f'{name}-2.0.4{suffix}.jar'
    target=cache/filename
    if not target.exists():
        urlretrieve(f'https://repo.maven.apache.org/maven2/org/microemu/{name}/2.0.4/{filename}',target)
    return target

main=artifact('microemulator')
assert hashlib.sha256(main.read_bytes()).hexdigest()=='dbd5f3eb8365d3e839d6a203149e0e3776fc1a0585e16ac1fc23f76c9fcae1c6'
jars=[main]+[artifact(n) for n in ['microemu-device-resizable','microemu-nokiaui','microemu-siemensapi','microemu-jsr-75','microemu-jsr-120','microemu-jsr-135']]
sources=artifact('microemulator','-sources')
with ZipFile(sources) as source:
    connector=source.read('org/microemu/microedition/io/ConnectorImpl.java').decode()
marker='private Connection openSecure(String name, int mode, boolean timeouts) throws IOException {'
assert connector.count(marker)==1
connector=connector.replace(marker,marker+'''
        if (name.startsWith("socket://") || name.startsWith("ssl://")) return new javax.microedition.io.SocketConnectionImpl(name);
        if (name.startsWith("http://") || name.startsWith("https://")) return new javax.microedition.io.HttpConnectionImpl(name);
''')
patched=cache/'ConnectorImpl.java'; patched.write_text(connector,encoding='utf-8')
classes=cache/'classes'; classes.mkdir(exist_ok=True)
javafiles=[root/n for n in ['BrowserMain.java','NetworkBridge.java','SocketConnectionImpl.java','HttpConnectionImpl.java']]+[patched]
compiler=['java','-jar',args.ecj,'-1.8','-proc:none'] if args.ecj else ['javac','--release','8']
subprocess.run(compiler+['-encoding','UTF-8','-cp',str(main),'-d',str(classes)]+list(map(str,javafiles)),check=True)
with ZipFile(web/'microemulator-web.jar','w',ZIP_DEFLATED) as output:
    entries={}
    for jar in jars:
        with ZipFile(jar) as source:
            for name in source.namelist():
                if not name.endswith('/') and not name.upper().startswith('META-INF/'):
                    entries.setdefault(name,source.read(name))
    for file in classes.rglob('*.class'): entries[file.relative_to(classes).as_posix()]=file.read_bytes()
    for name,data in entries.items(): output.writestr(name,data)

probe=cache/'probe'; probe.mkdir(exist_ok=True)
subprocess.run(compiler+['-encoding','UTF-8','-cp',str(main),'-d',str(probe),str(root/'ProbeMidlet.java')],check=True)
with ZipFile(web/'probe.jar','w',ZIP_DEFLATED) as output:
    output.writestr('META-INF/MANIFEST.MF','Manifest-Version: 1.0\r\nMIDlet-Name: Browser Test\r\nMIDlet-Version: 1.0\r\nMIDlet-Vendor: Local\r\nMIDlet-1: Browser Test,,ProbeMidlet\r\nMicroEdition-Configuration: CLDC-1.1\r\nMicroEdition-Profile: MIDP-2.0\r\n\r\n')
    for file in probe.glob('*.class'): output.write(file,file.name)
for file in javafiles+[root/'build.py',root/'LICENSE']: shutil.copy(file,web/'source'/file.name)
shutil.copy(sources,web/'source'/'microemulator-2.0.4-sources.jar')
for jar in jars: shutil.copy(jar,web/'source'/jar.name)
links=''.join('<li><a href="'+p.name+'">'+p.name+'</a></li>' for p in sorted((web/'source').iterdir()) if p.name!='index.html')
(web/'source'/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Corresponding source and original dependencies</title><h1>Source and dependencies</h1><ul>'+links+'</ul>',encoding='utf-8')
print('Built MicroEmulator browser runtime and probe MIDlet')
