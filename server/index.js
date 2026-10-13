import http from 'node:http';
import {readFile,realpath} from 'node:fs/promises';
import {resolve,extname,sep} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {WebSocketServer,WebSocket} from 'ws';
import {createRooms} from './rooms.js';
const root=fileURLToPath(new URL('../public/',import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.png':'image/png','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
export async function startServer({port=0,host='127.0.0.1',now=Date.now}={}){
 const rooms=createRooms({now});const publicRoot=await realpath(root);
 const server=http.createServer(async(req,res)=>{
  try{
   if(req.method!=='GET'&&req.method!=='HEAD'){res.writeHead(405);res.end();return;}
   const name=decodeURIComponent(req.url.split('?')[0]);
   const path=resolve(publicRoot,'.'+(name==='/'?'/index.html':name));
   if(!path.startsWith(publicRoot+sep)||name.includes('\\')||name.includes('\0')){res.writeHead(403);res.end();return;}
   const type=types[extname(path)];if(!type){res.writeHead(404);res.end();return;}
   const actual=await realpath(path);if(!actual.startsWith(publicRoot+sep)){res.writeHead(403);res.end();return;}
   const body=await readFile(actual);res.writeHead(200,{'Content-Type':type,'X-Content-Type-Options':'nosniff','Cache-Control':'no-cache','Content-Security-Policy':"default-src 'self'; img-src 'self'; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?undefined:body);
  }catch(err){res.writeHead(err instanceof URIError?400:err.code==='ENOENT'?404:500);res.end('Unable to load this resource.');}
 });
 const wss=new WebSocketServer({noServer:true,maxPayload:4096});
 server.on('upgrade',(req,socket,head)=>{
  let allowed=false;try{const origin=new URL(req.headers.origin);allowed=['http:','https:'].includes(origin.protocol)&&origin.host===req.headers.host;}catch{}
  if(!allowed||req.url!=='/ws'||wss.clients.size>=96){socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');return;}
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws));
 });
 wss.on('connection',ws=>{
  ws.lastPong=now();ws.joined=false;ws.opened=now();
  const cid=rooms.connect(message=>{
   if(ws.readyState!==WebSocket.OPEN)return;
   if(message.type==='welcome')ws.joined=true;
   if(ws.bufferedAmount>512*1024){ws.close(1013,'Connection too slow');return;}
   ws.send(JSON.stringify(message));if(message.code==='SESSION_REPLACED')ws.close(1008,'Session replaced');
  });
  ws.on('pong',()=>ws.lastPong=now());ws.on('error',()=>{});
  ws.on('message',data=>{try{rooms.receive(cid,JSON.parse(data.toString()));}catch{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:'error',code:'BAD_MESSAGE',message:'Invalid room request.'}));}});
  ws.on('close',()=>rooms.disconnect(cid));
 });
 let last=performance.now(),accumulator=0;
 const timer=setInterval(()=>{const current=performance.now();accumulator+=Math.min(100,current-last);last=current;
  while(accumulator>=1000/60){rooms.tick();accumulator-=1000/60;}
 },8);
 const heartbeat=setInterval(()=>{for(const ws of wss.clients){if(now()-ws.lastPong>=5000||(!ws.joined&&now()-ws.opened>=10000)){ws.terminate();continue;}ws.ping();}},1000);
 await new Promise((ok,no)=>{server.once('error',no);server.listen(port,host,ok);});
 const address=server.address();return {url:`http://${host==='0.0.0.0'?'127.0.0.1':host}:${address.port}`,close:()=>new Promise(done=>{clearInterval(timer);clearInterval(heartbeat);for(const ws of wss.clients)ws.terminate();wss.close();server.close(done);server.closeAllConnections();})};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 const app=await startServer({port:Number(process.env.PORT)||3000,host:process.env.HOST||'127.0.0.1'});console.log(`PokéJam ready at ${app.url}`);
 for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await app.close();process.exit(0);});
}
