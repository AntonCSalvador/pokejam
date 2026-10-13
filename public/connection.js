export function connectGame({onMessage,onStatus}){
 const socket=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/ws`);
 socket.addEventListener('open',()=>onStatus('open'));
 socket.addEventListener('message',e=>{try{onMessage(JSON.parse(e.data));}catch(err){console.error('Unable to process game message',err);onStatus('error');}});
 socket.addEventListener('close',()=>onStatus('closed'));
 socket.addEventListener('error',()=>onStatus('error'));
 return {send(message){if(socket.readyState===WebSocket.OPEN)socket.send(JSON.stringify(message));},close(){socket.close();}};
}
