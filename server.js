const http=require('http'),fs=require('fs'),path=require('path'),{WebSocketServer}=require('ws');
const server=http.createServer((q,r)=>{r.writeHead(200,{'content-type':'text/html; charset=utf-8'});r.end(fs.readFileSync(path.join(__dirname,'index.html')))});
const wss=new WebSocketServer({server});const rooms={};
const val=c=>c<52?c>>2:13+c-52;
function analyze(cs){const n=cs.length;if(!n)return null;const v=cs.map(val).sort((a,b)=>a-b);
 if(n==1)return{t:'single',n,r:v[0]};
 if(v[n-1]<13&&v.every(x=>x==v[0])&&n<=4)return{t:n==4?'bomb':n==2?'pair':'triple',n,r:v[0]};
 if(n>=3&&v[n-1]<=11&&v.every((x,i)=>x==v[0]+i))return{t:'straight',n,r:v[n-1]};return null}
const beats=(a,t)=>!t||(a.t=='bomb'&&t.t!='bomb')||(a.t==t.t&&a.n==t.n&&a.r>t.r);
const active=(s,i)=>!s.finished.includes(i);
function advance(s){const n=s.players.length;
 const others=s.players.map((_,i)=>i).filter(i=>active(s,i)&&i!=s.table.by);
 if(others.every(i=>s.passed.includes(i))){let i=s.table.by;while(!active(s,i))i=(i+1)%n;s.turn=i;s.table=null;s.passed=[];s.log+=' · new round'}
 else{let i=(s.turn+1)%n;while(!active(s,i)||s.passed.includes(i))i=(i+1)%n;s.turn=i}}
function send(s){s.players.forEach((p,i)=>{if(!p.ws||p.ws.readyState!=1)return;
 p.ws.send(JSON.stringify({t:'state',code:s.code,phase:s.phase,me:i,turn:s.turn,table:s.table,log:s.log,hand:p.hand,
  players:s.players.map((q,j)=>({name:q.name,n:q.hand.length,out:s.finished.includes(j),passed:s.passed.includes(j),rank:s.finished.indexOf(j)+1}))}))})}
const err=(ws,m)=>ws.readyState==1&&ws.send(JSON.stringify({t:'err',m}));
wss.on('connection',ws=>{let s=null,p=null;
 ws.on('message',raw=>{let m;try{m=JSON.parse(raw)}catch{return}
  if(m.t=='join'){const code=String(m.code||'').toUpperCase().replace(/[^A-Z]/g,'').slice(0,4),name=String(m.name||'').slice(0,14).trim();
   if(code.length!=4||!name||!m.pid)return err(ws,'Enter a name and a 4-letter code');
   s=rooms[code]=rooms[code]||{code,players:[],phase:'lobby',turn:0,table:null,passed:[],finished:[],log:''};
   p=s.players.find(q=>q.id==m.pid);
   if(p){p.ws=ws}else{if(s.phase!='lobby'){s=null;return err(ws,'Game already in progress')}
    if(s.players.length>=4){s=null;return err(ws,'Room is full')}
    p={id:m.pid,name,ws,hand:[]};s.players.push(p)}
   return send(s)}
  if(!s||!p)return;const me=s.players.indexOf(p);
  if(m.t=='start'&&me==0&&s.phase=='lobby'&&s.players.length>1){const n=s.players.length;const d=[...Array(n<4?54:52).keys()];
   for(let i=d.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[d[i],d[j]]=[d[j],d[i]]}
   const k=d.length/n;s.players.forEach((q,i)=>q.hand=d.slice(i*k,(i+1)*k).sort((a,b)=>val(a)-val(b)||a-b));
   s.turn=s.players.findIndex(q=>q.hand.includes(1));s.table=null;s.passed=[];s.finished=[];s.phase='play';s.log=s.players[s.turn].name+' has 3♥ and leads'}
  else if(m.t=='again'&&me==0&&s.phase=='over'){s.phase='lobby';s.table=null;s.finished=[];s.passed=[];s.log='';s.players.forEach(q=>q.hand=[])}
  else if(s.phase=='play'&&s.turn==me&&m.t=='pass'){if(!s.table)return err(ws,'You must lead');s.passed.push(me);s.log=p.name+' passed';advance(s)}
  else if(s.phase=='play'&&s.turn==me&&m.t=='play'){const cs=[...new Set(m.cards)];
   if(!cs.length||!cs.every(c=>p.hand.includes(c)))return err(ws,'Invalid cards');
   const a=analyze(cs);if(!a)return err(ws,'Not a valid combination');if(!beats(a,s.table&&s.table.a))return err(ws,'That does not beat the table');
   p.hand=p.hand.filter(c=>!cs.includes(c));s.table={cards:cs.sort((x,y)=>val(x)-val(y)),a,by:me};s.log=p.name+' played '+a.t;
   if(!p.hand.length){s.finished.push(me);s.log+=' and is out (#'+s.finished.length+')'}
   const left=s.players.map((_,i)=>i).filter(i=>active(s,i));
   if(left.length<=1){if(left.length)s.finished.push(left[0]);s.phase='over'}else advance(s)}
  send(s)});
 ws.on('close',()=>{if(p)p.ws=null;if(s&&s.players.every(q=>!q.ws))setTimeout(()=>{if(s.players.every(q=>!q.ws))delete rooms[s.code]},36e5)})});
server.listen(process.env.PORT||3000,()=>console.log('Murlan on port '+(process.env.PORT||3000)));
