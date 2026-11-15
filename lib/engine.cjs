// Generated from index.html by scripts/build.cjs.

'use strict';
// Authoritative, dependency-free simulation shared by the solo game and room host.
(() => {
const TILE=64,W=1920,H=1280,MAX=60;
const CLANS=[
 {name:'Хөх сүлд',color:'#74c5e5',dark:'#254d64',light:'#c0f3fb'},
 {name:'Улаан туг',color:'#d98067',dark:'#753b36',light:'#ffd0a2'},
 {name:'Алтан ураг',color:'#dfbd5f',dark:'#79623b',light:'#ffe9a6'},
 {name:'Хөх чоно',color:'#ba99dd',dark:'#56466f',light:'#e0d1f6'}
];
const MINES=[[9,7,"Алтан жалга"],[15,6,"Хүдэрт хад"],[19,14,"Зэсийн уурхай"],[8,17,"Өндөр хөтөл"],[24,11,"Хар хад"]];
const CAMPS=[
 [4,15,'Хөх сүлд',0],[25,4,'Улаан туг',1],[5,3,'Алтан ураг',2],[25,16,'Хөх чоно',3],
 [7,11,'Хусат булаг',-1],[12,16,'Баян хөтөл',-1],[15,10,'Орхоны гарам',-1],
 [12,4,'Хангайн өртөө',-1],[21,9,'Зүүн хүрээ',-1],[21,14,'Уужим тал',-1],
 [5,7,'Нарсан дэнж',-1],[18,3,'Цагаан овоо',-1],[17,17,'Хөх нуур',-1]
];
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
function random(s){s.seed=(Math.imul(s.seed,1664525)+1013904223)>>>0;return s.seed/4294967296}
function addUnit(s,owner,type,x,y){
 const hero=type==='hero',archer=type==='archer',guard=type==='guard';
 const hp=hero?90:guard?26:archer?34:44;
 const u={id:++s.uid,owner,type,x:clamp(x,10,W-10),y:clamp(y,10,H-10),hp,maxHp:hp,tx:x,ty:y,goal:-1,face:1,cd:random(s)*.5,walk:0,moving:false,hold:false};
 s.units.push(u);return u;
}
function recruitAt(s,owner,type,count,camp){
 const have=s.units.filter(u=>u.owner===owner&&u.hp>0).length;
 const n=Math.min(count,MAX-have);
 for(let i=0;i<n;i++){
  const a=(i/n)*Math.PI*2,rad=42+random(s)*18;
  addUnit(s,owner,type,camp.x+Math.cos(a)*rad,camp.y+46+Math.sin(a)*20);
 }return n;
}
function initExtras(s){
 if(!['easy','normal','hard'].includes(s.difficulty))s.difficulty='normal';
 if(!Array.isArray(s.skillReady)||s.skillReady.length!==4)s.skillReady=Array.from({length:4},()=>({rally:0,volley:0}));
 if(!Array.isArray(s.rallyUntil)||s.rallyUntil.length!==4)s.rallyUntil=[0,0,0,0];
 if(!Array.isArray(s.missions)||s.missions.length!==4)s.missions=[0,0,0,0];
 if(!Array.isArray(s.barrages))s.barrages=[];
 if(!Array.isArray(s.heroControls)||s.heroControls.length!==4)s.heroControls=Array.from({length:4},()=>({active:false,follow:false,dx:0,dy:0,until:0,dashUntil:0,dashReady:0}));
 if(!Array.isArray(s.mines)||s.mines.length!==MINES.length)s.mines=MINES.map((m,i)=>({id:i,x:(m[0]+.5)*TILE,y:(m[1]+.5)*TILE,name:m[2],owner:-1,capture:0,claimant:-2}));
 if(!Array.isArray(s.flags)||s.flags.length!==4)s.flags=CLANS.map((c,i)=>i===0?{primary:'#c62639',accent:'#246bc2',symbol:'soyombo'}:{primary:c.color,accent:c.light,symbol:i===1?'wolf':i===2?'sun':'horse'});
 if(!Array.isArray(s.fortsBuilt)||s.fortsBuilt.length!==4)s.fortsBuilt=[0,0,0,0];
 for(const camp of s.camps){if(!Number.isInteger(camp.fortLevel)){camp.fortLevel=camp.home?1:0;camp.fortHp=camp.home?260:0;camp.repairReady=0}}
 return s;
}
function create(humans=[0],names={},options={}){
 const s={version:1,difficulty:['easy','hard'].includes(options.difficulty)?options.difficulty:'normal',skillReady:Array.from({length:4},()=>({rally:0,volley:0})),rallyUntil:[0,0,0,0],missions:[0,0,0,0],barrages:[],phase:'ready',time:0,seed:74463,uid:0,units:[],camps:[],gold:[0,1,2,3].map(i=>humans.includes(i)?180:150),level:[0,0,0,0],bots:[0,1,2,3].filter(i=>!humans.includes(i)),names:CLANS.map((c,i)=>String(names[i]||c.name).slice(0,18)),kills:[0,0,0,0],incomeClock:0,aiClock:0,aiRecruit:0,winner:null,events:[],seq:0,arrows:[]};
 if(humans.length===1){for(let i=1;i<4;i++)s.gold[i]=s.difficulty==='easy'?110:s.difficulty==='hard'?225:150}
 if(Number.isInteger(options.seed))s.seed=options.seed>>>0;
 s.camps=CAMPS.map((c,i)=>({id:i,x:(c[0]+.5)*TILE,y:(c[1]+.5)*TILE,name:c[2],owner:c[3],home:i<4,capture:0,claimant:-2}));
 for(const camp of s.camps){
  if(camp.owner>=0){addUnit(s,camp.owner,'hero',camp.x,camp.y+64);recruitAt(s,camp.owner,'cavalry',humans.includes(camp.owner)?7:5,camp);recruitAt(s,camp.owner,'archer',humans.includes(camp.owner)?2:1,camp)}
  else for(let i=0;i<2;i++)addUnit(s,-1,'guard',camp.x-23+i*43,camp.y+27);
 }
 return initExtras(s);
}
function event(s,text,kind='note',owner=-1,x=0,y=0){s.events.push({id:++s.seq,text,kind,owner,x,y});if(s.events.length>12)s.events.shift()}
function owned(s,owner){return s.units.filter(u=>u.owner===owner&&u.hp>0)}
function counts(s){return CLANS.map((_,i)=>s.camps.filter(c=>c.owner===i).length)}
function rankTier(rp){const tiers=[[0,'Шинэ дайчин'],[250,'Хүрэл'],[750,'Мөнгөн'],[1500,'Алтан'],[3000,'Хөх чоно'],[6000,'Их хаан']];let tier=tiers[0];for(const t of tiers)if(rp>=t[0])tier=t;return{name:tier[1],floor:tier[0],next:tiers.find(t=>t[0]>rp)?.[0]??null}}
function rankPoints(s,owner=0){const won=s.phase==='ended'&&s.winner===owner,camps=counts(s)[owner],kills=s.kills[owner],forts=s.fortsBuilt?.[owner]||0;return{rp:Math.min(1000,(won?150:20)+(s.difficulty==='hard'?50:0)+camps*12+kills*2+Math.min(20,forts)*15),won,camps,kills,forts,seconds:Math.round(s.time)}}
function rate(s,owner){initExtras(s);return s.camps.reduce((n,c)=>n+(c.owner===owner?(c.home?3:2):0),0)+s.mines.reduce((n,m)=>n+(m.owner===owner?4:0),0)}
function command(s,owner,c){
 if(s.phase!=='playing'||!Number.isInteger(owner)||owner<0||owner>3||!c||typeof c!=='object')return false;
 initExtras(s);
 if(c.type==='fortify'||c.type==='repair'){
  const camp=Number.isInteger(c.camp)?s.camps[c.camp]:null;
  if(!camp||camp.owner!==owner)return false;
  const damaged=camp.fortHp<=0,level=damaged?1:camp.fortLevel+1;
  if(c.type==='fortify'){
   const price=damaged||camp.fortLevel===0?100:160;if(level>2||s.gold[owner]<price)return false;
   s.gold[owner]-=price;camp.fortLevel=level;camp.fortHp=level===2?460:260;s.fortsBuilt[owner]++;
   event(s,'«'+camp.name+'» '+(level===2?'чулуун хэрэмтэй боллоо!':'модон хашаатай боллоо!'),'fort',owner,camp.x,camp.y);return true;
  }
  const maximum=camp.fortLevel===2?460:260;
  if(!camp.fortLevel||camp.fortHp<=0||camp.fortHp>=maximum||camp.repairReady>s.time||s.gold[owner]<40||s.units.some(u=>u.owner>=0&&u.owner!==owner&&dist(u,camp)<165))return false;
  s.gold[owner]-=40;camp.fortHp=maximum;camp.repairReady=s.time+12;event(s,'«'+camp.name+'» хашааг заслаа.','repair',owner,camp.x,camp.y);return true;
 }
 if(c.type==='heroControl'){
  if(typeof c.active!=='boolean'||!Number.isFinite(c.dx)||!Number.isFinite(c.dy)||Math.abs(c.dx)>1||Math.abs(c.dy)>1)return false;
  const hero=owned(s,owner).find(u=>u.type==='hero');if(!hero)return false;
  const control=s.heroControls[owner],length=Math.max(1,Math.hypot(c.dx,c.dy));
  control.active=c.active;control.dx=c.active?c.dx/length:0;control.dy=c.active?c.dy/length:0;control.until=s.time+.4;
  hero.tx=hero.x;hero.ty=hero.y;hero.goal=-1;hero.hold=false;return true;
 }
 if(c.type==='escort'){
  if(typeof c.follow!=='boolean'||!owned(s,owner).some(u=>u.type==='hero'))return false;
  s.heroControls[owner].follow=c.follow;
  if(!c.follow)for(const u of owned(s,owner)){if(u.type!=='hero'){u.tx=u.x;u.ty=u.y;u.goal=-1}}
  return true;
 }
 if(c.type==='dash'){
  const control=s.heroControls[owner];
  if(!control.active||control.dashReady>s.time||!owned(s,owner).some(u=>u.type==='hero'))return false;
  control.dashUntil=s.time+.65;control.dashReady=s.time+8;return true;
 }
 if(c.type==='flag'){
  const f=c.flag||{},validCol=v=>typeof v==='string'&&/^#[0-9a-fA-F]{6}$/.test(v);
  if(!validCol(f.primary)||!validCol(f.accent)||!['soyombo','sun','wolf','horse','star'].includes(f.symbol))return false;
  s.flags[owner]={primary:f.primary,accent:f.accent,symbol:f.symbol};
  if(typeof c.name==='string')s.names[owner]=c.name.replace(/[<>\x00-\x1f]/g,'').trim().slice(0,18)||CLANS[owner].name;
  return true;
 }
 if(c.type==='skill'){
  const ability=c.ability;
  if(ability!=='rally'&&ability!=='volley')return false;
  const cost=ability==='rally'?80:110,cd=ability==='rally'?65:48;
  if(s.gold[owner]<cost||s.skillReady[owner][ability]>s.time)return false;
  if(ability==='volley'&&(!Number.isFinite(c.x)||!Number.isFinite(c.y)||c.x<0||c.x>W||c.y<0||c.y>H))return false;
  s.gold[owner]-=cost;s.skillReady[owner][ability]=s.time+cd;
  if(ability==='rally'){
   s.rallyUntil[owner]=s.time+12;
   const hero=s.units.find(u=>u.owner===owner&&u.type==='hero');
   event(s,CLANS[owner].name+' дайны уухай хадаалаа!','rally',owner,hero?.x||0,hero?.y||0);
  }else{
   const x=clamp(c.x,0,W),y=clamp(c.y,0,H);
   for(const u of s.units){if(u.owner===owner||u.hp<=0||Math.hypot(u.x-x,u.y-y)>92)continue;
    u.hp-=25*(1+(s.level[owner]||0)*.15);
    if(u.hp<=0)s.kills[owner]++;
   }
   for(let i=0;i<14;i++){
    const a=i*Math.PI*2/14,r=24+(i%4)*13,xx=x+Math.cos(a)*r,yy=y+Math.sin(a)*r;
    s.arrows.push({x:xx-78,y:yy-100,tx:xx,ty:yy,life:.3,owner});
   }
   s.barrages.push({x,y,owner,t:1.3});
   event(s,CLANS[owner].name+' суман бороо буулгалаа!','volley',owner,x,y);
  }
  return true;
 }
 if(c.type==='move'||c.type==='stop'){
  if(!Array.isArray(c.ids)||c.ids.length>MAX)return false;
  const ids=new Set(c.ids),us=owned(s,owner).filter(u=>ids.has(u.id));
  if(!us.length)return false;
  if(c.type==='stop'){for(const u of us){u.tx=u.x;u.ty=u.y;u.hold=true;u.goal=-1}return true}
  if(!Number.isFinite(c.x)||!Number.isFinite(c.y))return false;
  const x=clamp(c.x,20,W-20),y=clamp(c.y,20,H-20);
  if(us.some(u=>u.type==='hero')){s.heroControls[owner].active=false;s.heroControls[owner].follow=false}
  const camp=Number.isInteger(c.camp)?s.camps[c.camp]:null;
  const validCamp=camp&&Math.hypot(camp.x-x,camp.y-y)<120?camp:null;
  const columns=Math.ceil(Math.sqrt(us.length));
  for(let i=0;i<us.length;i++){
   const u=us[i],ox=(i%columns-(columns-1)/2)*23,oy=(Math.floor(i/columns)-(Math.ceil(us.length/columns)-1)/2)*23;
   u.tx=clamp(x+ox,16,W-16);u.ty=clamp(y+oy+(validCamp?42:0),16,H-16);u.goal=validCamp?validCamp.id:-1;u.hold=false;
  }return true;
 }
 if(c.type==='recruit'){
  const cost=c.unit==='cavalry'?80:c.unit==='archer'?100:Infinity;
  const camp=s.camps[c.camp];
  if(!camp||camp.owner!==owner||s.gold[owner]<cost||owned(s,owner).length>=MAX)return false;
  const n=recruitAt(s,owner,c.unit,c.unit==='cavalry'?5:4,camp);if(!n)return false;
  s.gold[owner]-=cost;event(s,n+' '+(c.unit==='archer'?'морьт харваач':'морьт цэрэг')+' аянд нэгдлээ.','recruit',owner,camp.x,camp.y);return true;
 }
 if(c.type==='upgrade'){
  const cost=120+s.level[owner]*80;
  if(s.level[owner]>=3||s.gold[owner]<cost)return false;
  s.gold[owner]-=cost;s.level[owner]++;event(s,'Зэвсэг сайжирлаа. Цохилтын хүч +15%.','upgrade',owner);return true;
 }return false;
}
function ai(s){
 for(const owner of s.bots){
  const us=owned(s,owner),mine=s.camps.filter(c=>c.owner===owner);
  if(!us.length||!mine.length)continue;
  const cx=us.reduce((n,u)=>n+u.x,0)/us.length,cy=us.reduce((n,u)=>n+u.y,0)/us.length;
  const threatened=mine.find(c=>s.units.some(u=>u.owner>=0&&u.owner!==owner&&dist(u,c)<145));
  let target=threatened;
  if(!target){
   const candidates=s.camps.filter(c=>c.owner!==owner);
   candidates.sort((a,b)=>{
    const strength=c=>s.units.filter(u=>u.owner===c.owner&&dist(u,c)<130).length;
    return Math.hypot(a.x-cx,a.y-cy)+strength(a)*35-(a.owner<0?90:0)-(Math.hypot(b.x-cx,b.y-cy)+strength(b)*35-(b.owner<0?90:0));
   });target=candidates[0];
  }
  const openMines=s.mines.filter(m=>m.owner!==owner);
  if(openMines.length&&(s.gold[owner]<240||random(s)<.34)){
   const m=openMines.sort((a,b)=>Math.hypot(a.x-cx,a.y-cy)-Math.hypot(b.x-cx,b.y-cy))[0];
   if(m&&(Math.hypot(m.x-cx,m.y-cy)<650||s.gold[owner]<200)){command(s,owner,{type:'move',ids:us.map(u=>u.id),x:m.x,y:m.y});continue}
  }
  if(target)command(s,owner,{type:'move',ids:us.map(u=>u.id),x:target.x,y:target.y,camp:target.id});
 }
}
function tick(s,dt){
 if(s.phase!=='playing')return;
 initExtras(s);dt=clamp(dt,0,.06);s.time+=dt;s.incomeClock+=dt;s.aiClock+=dt;s.aiRecruit+=dt;
 for(const f of s.barrages)f.t-=dt;s.barrages=s.barrages.filter(f=>f.t>0);
 if(s.incomeClock>=1){const secs=Math.floor(s.incomeClock);s.incomeClock-=secs;for(let i=0;i<4;i++)s.gold[i]=Math.min(9999,s.gold[i]+rate(s,i)*secs)}
 if(s.aiClock>(s.difficulty==='easy'?10:s.difficulty==='hard'?5:7)){s.aiClock=0;ai(s)}
 if(s.aiRecruit>(s.difficulty==='easy'?22:s.difficulty==='hard'?12:16)){s.aiRecruit=0;for(const owner of s.bots){const cs=s.camps.filter(c=>c.owner===owner);if(!cs.length)continue;const us=owned(s,owner);let camp=cs[0];if(us.length){const x=us.reduce((n,u)=>n+u.x,0)/us.length,y=us.reduce((n,u)=>n+u.y,0)/us.length;camp=cs.reduce((a,b)=>Math.hypot(a.x-x,a.y-y)<Math.hypot(b.x-x,b.y-y)?a:b)}if(us.length<31)command(s,owner,{type:'recruit',unit:random(s)>.68?'archer':'cavalry',camp:camp.id});if(s.gold[owner]>420)command(s,owner,{type:'upgrade'})}}
 // Spatial buckets keep battles bounded even with four full armies.
 const grid=new Map();
 for(const u of s.units){if(u.hp<=0)continue;const k=Math.floor(u.x/140)+','+Math.floor(u.y/140);if(!grid.has(k))grid.set(k,[]);grid.get(k).push(u)}
 const nearby=(u)=>{const result=[],gx=Math.floor(u.x/140),gy=Math.floor(u.y/140);for(let xx=-1;xx<=1;xx++)for(let yy=-1;yy<=1;yy++)result.push(...(grid.get((gx+xx)+','+(gy+yy))||[]));return result};
 for(const u of s.units){
  if(u.hp<=0)continue;u.cd=Math.max(0,u.cd-dt);let enemy=null,nearest=Infinity;
  for(const v of nearby(u)){if(v.hp<=0||v.owner===u.owner)continue;const d=dist(u,v);if(d<nearest&&d<(u.type==='guard'?110:145)){enemy=v;nearest=d}}
  const control=u.owner>=0?s.heroControls[u.owner]:null,manual=u.type==='hero'&&control?.active;
  if(!manual&&control?.active&&control.follow&&u.type!=='guard'){
   const hero=s.units.find(v=>v.owner===u.owner&&v.type==='hero'&&v.hp>0);
   if(hero){u.tx=clamp(hero.x+((u.id%5)-2)*22,16,W-16);u.ty=clamp(hero.y+48+Math.floor(u.id%15/5)*22,16,H-16);u.hold=false;u.goal=-1}
  }
  let tx=manual?u.x+(control.until>=s.time?control.dx*100:0):u.tx,ty=manual?u.y+(control.until>=s.time?control.dy*100:0):u.ty;
  const range=u.type==='archer'?120:u.type==='hero'?31:26;
  if(enemy){
   if(nearest<=range){if(!manual){tx=u.x;ty=u.y}if(u.cd<=0){const damage=(u.type==='hero'?9:u.type==='archer'?6:u.type==='guard'?4:7)*(1+(s.level[u.owner]||0)*.15)*(u.owner>=0&&s.rallyUntil[u.owner]>s.time?1.25:1);enemy.hp-=damage;u.cd=u.type==='archer'?1.3:.85;u.face=enemy.x>=u.x?1:-1;if(u.type==='archer')s.arrows.push({x:u.x,y:u.y-15,tx:enemy.x,ty:enemy.y-9,life:.3,owner:u.owner});if(enemy.hp<=0&&u.owner>=0)s.kills[u.owner]++}}
   else if(!manual&&!u.hold&&u.type!=='guard'){tx=enemy.x;ty=enemy.y}
  }
  const dx=tx-u.x,dy=ty-u.y,d=Math.hypot(dx,dy);u.moving=d>3;
  if(u.moving){const speed=(u.type==='hero'?80:u.type==='archer'?68:u.type==='guard'?45:78)*(u.owner>=0&&s.rallyUntil[u.owner]>s.time?1.35:1)*(manual&&control.dashUntil>s.time?2.5:1),step=Math.min(d,speed*dt);u.x+=dx/d*step;u.y+=dy/d*step;u.walk+=dt*10;if(Math.abs(dx)>2)u.face=dx>0?1:-1}
  // Slight separation preserves readable formations without pushing holding troops away.
  if(u.moving){for(const v of nearby(u)){if(v.id<=u.id||v.hp<=0)continue;const dx=u.x-v.x,dy=u.y-v.y,d2=dx*dx+dy*dy;if(d2>0&&d2<180){const d=Math.sqrt(d2),push=(13.4-d)*dt*3;u.x+=dx/d*push;u.y+=dy/d*push;v.x-=dx/d*push;v.y-=dy/d*push}}}
  u.x=clamp(u.x,12,W-12);u.y=clamp(u.y,12,H-12);
  // Enemy troops must breach the perimeter before occupying a fortified camp.
  if(u.owner>=0)for(const camp of s.camps){
   if(camp.owner<0||camp.owner===u.owner||camp.fortHp<=0)continue;
   const dx=u.x-camp.x,dy=u.y-camp.y,ellipse=Math.hypot(dx/104,dy/74);
   if(ellipse<1.08){const ratio=1.08/Math.max(.01,ellipse);u.x=clamp(camp.x+(dx||1)*ratio,12,W-12);u.y=clamp(camp.y+dy*ratio,12,H-12)}
   const attackRange=u.type==='archer'?180:135;
   if(dist(u,camp)<=attackRange&&u.cd<=0){camp.fortHp=Math.max(0,camp.fortHp-(u.type==='hero'?12:u.type==='archer'?3:8)*(1+(s.level[u.owner]||0)*.15));u.cd=u.type==='archer'?1.3:.85;if(camp.fortHp===0)event(s,'«'+camp.name+'» хашаа нурлаа!','breach',u.owner,camp.x,camp.y)}
  }
 }
 s.units=s.units.filter(u=>u.hp>0);for(const a of s.arrows)a.life-=dt;s.arrows=s.arrows.filter(a=>a.life>0);
 for(const c of s.camps){
  const near=s.units.filter(u=>dist(u,c)<88),teams=new Set(near.filter(u=>u.owner>=0).map(u=>u.owner));
  const guards=near.some(u=>u.owner===-1),attacker=teams.size===1?[...teams][0]:-2;
  if(attacker>=0&&attacker!==c.owner&&!guards&&c.fortHp<=0){
   if(c.claimant!==attacker){c.claimant=attacker;c.capture=0}c.capture+=dt;
   if(c.capture>=6){c.owner=attacker;c.capture=0;c.claimant=-2;c.fortLevel=1;c.fortHp=260;c.repairReady=0;s.fortsBuilt[attacker]++;s.gold[attacker]+=40;event(s,CLANS[attacker].name+' «'+c.name+'» баазыг эзэлж, хашааллаа.','capture',attacker,c.x,c.y);
    const stages=[2,3,5],bonuses=[70,100,150],level=s.missions[attacker];
    if(level<3&&counts(s)[attacker]>=stages[level]){s.gold[attacker]+=bonuses[level];s.missions[attacker]++;event(s,'Аян даалгавар биеллээ! +'+bonuses[level]+' алт','mission',attacker,c.x,c.y)}
    for(const u of near)if(u.owner===attacker){u.tx=u.x;u.ty=u.y;u.goal=-1}}
  }else{c.capture=Math.max(0,c.capture-dt*.5);if(c.capture===0)c.claimant=-2}
  // A quiet friendly camp slowly heals troops.
  if(teams.size===1&&attacker===c.owner)for(const u of near)if(u.owner===c.owner)u.hp=Math.min(u.maxHp,u.hp+dt*1.3);
 }
 // Capture the mines by stationing soldiers around the mineral site.
 for(const m of s.mines){
  const teams=new Set(s.units.filter(u=>u.owner>=0&&Math.hypot(u.x-m.x,u.y-m.y)<72).map(u=>u.owner));
  const claimant=teams.size===1?[...teams][0]:-2;
  if(claimant>=0&&claimant!==m.owner){
   if(m.claimant!==claimant){m.claimant=claimant;m.capture=0}
   m.capture+=dt;
   if(m.capture>=4){m.owner=claimant;m.capture=0;m.claimant=-2;s.gold[claimant]=Math.min(9999,s.gold[claimant]+55);event(s,s.names[claimant]+' «'+m.name+'» уурхайг эзэллээ. +55 алт, +4 алт/с','mine',claimant,m.x,m.y)}
  }else{m.capture=Math.max(0,m.capture-dt*.35);if(!m.capture)m.claimant=-2}
 }
 const totals=counts(s),winner=totals.findIndex(n=>n>=8),alive=CLANS.map((_,i)=>totals[i]>0||s.units.some(u=>u.owner===i));
 if(winner>=0){s.phase='ended';s.winner=winner}
 else if(alive.filter(Boolean).length===1){s.phase='ended';s.winner=alive.indexOf(true)}
 else if(s.time>=720){const max=Math.max(...totals);const tied=totals.map((n,i)=>n===max?i:-1).filter(i=>i>=0);s.winner=tied.length===1?tied[0]:-1;s.phase='ended'}
}
function snapshot(s){
 initExtras(s);return{version:1,fortsBuilt:s.fortsBuilt,heroControls:s.heroControls,difficulty:s.difficulty,skillReady:s.skillReady,rallyUntil:s.rallyUntil,missions:s.missions,barrages:s.barrages,mines:s.mines,flags:s.flags,phase:s.phase,time:s.time,seed:s.seed,uid:s.uid,gold:s.gold,level:s.level,bots:s.bots,names:s.names,kills:s.kills,winner:s.winner,events:s.events,seq:s.seq,camps:s.camps,units:s.units.map(u=>({...u})),arrows:s.arrows,incomeClock:s.incomeClock,aiClock:s.aiClock,aiRecruit:s.aiRecruit};
}
function valid(s){
 const finite=Number.isFinite,owner=(n,low=-1)=>Number.isInteger(n)&&n>=low&&n<4;
 const four=(a,test)=>Array.isArray(a)&&a.length===4&&a.every(test);
 const timer=n=>finite(n)&&n>=0;
 if(!s||s.version!==1||!['playing','ended','ready'].includes(s.phase)||!timer(s.time)||s.time>721)return false;
 if(!Number.isInteger(s.uid)||s.uid<0||!Number.isInteger(s.seed)||s.seed<0)return false;
 if(!['incomeClock','aiClock','aiRecruit'].every(k=>timer(s[k])))return false;
 if(!four(s.gold,n=>finite(n)&&n>=0)||!four(s.level,n=>Number.isInteger(n)&&n>=0&&n<=3)||!four(s.kills,n=>Number.isInteger(n)&&n>=0))return false;
 if(!four(s.names,n=>typeof n==='string'&&n.length<=18)||!Array.isArray(s.bots)||s.bots.length>4||!s.bots.every(n=>owner(n,0)))return false;
 if(!Array.isArray(s.camps)||s.camps.length!==CAMPS.length||!s.camps.every((c,i)=>c&&c.id===i&&finite(c.x)&&finite(c.y)&&c.x>=0&&c.x<=W&&c.y>=0&&c.y<=H&&timer(c.capture)&&c.capture<=6&&owner(c.owner)&&owner(c.claimant,-2)&&typeof c.name==='string'))return false;
 if(!Array.isArray(s.units)||s.units.length>300||!s.units.every(u=>u&&Number.isInteger(u.id)&&u.id>0&&u.id<=s.uid&&owner(u.owner)&&['hero','cavalry','archer','guard'].includes(u.type)&&finite(u.x)&&finite(u.y)&&u.x>=0&&u.x<=W&&u.y>=0&&u.y<=H&&finite(u.hp)&&u.hp>0&&finite(u.maxHp)&&u.maxHp>0&&u.hp<=u.maxHp&&finite(u.tx)&&finite(u.ty)&&timer(u.cd)&&finite(u.walk)))return false;
 if(new Set(s.units.map(u=>u.id)).size!==s.units.length)return false;
 if(!Array.isArray(s.events)||s.events.length>12||!s.events.every(e=>e&&Number.isInteger(e.id)&&typeof e.text==='string'&&e.text.length<1024&&typeof e.kind==='string'&&owner(e.owner)&&finite(e.x)&&finite(e.y)))return false;
 if(!Array.isArray(s.arrows)||s.arrows.length>300||!s.arrows.every(a=>a&&[a.x,a.y,a.tx,a.ty,a.life].every(finite)&&owner(a.owner)))return false;
 if(s.fortsBuilt!==undefined&&!four(s.fortsBuilt,n=>Number.isInteger(n)&&n>=0))return false;
 if(!s.camps.every(c=>c.fortLevel===undefined||(Number.isInteger(c.fortLevel)&&c.fortLevel>=0&&c.fortLevel<=2&&timer(c.fortHp)&&c.fortHp<=(c.fortLevel===2?460:260)&&timer(c.repairReady))))return false;
 if(s.skillReady!==undefined&&!four(s.skillReady,c=>c&&timer(c.rally)&&timer(c.volley)))return false;
 if(s.rallyUntil!==undefined&&!four(s.rallyUntil,timer))return false;
 if(s.missions!==undefined&&!four(s.missions,n=>Number.isInteger(n)&&n>=0&&n<=3))return false;
 if(s.heroControls!==undefined&&!four(s.heroControls,c=>c&&typeof c.active==='boolean'&&typeof c.follow==='boolean'&&finite(c.dx)&&finite(c.dy)&&Math.abs(c.dx)<=1&&Math.abs(c.dy)<=1&&timer(c.until)&&timer(c.dashUntil)&&timer(c.dashReady)))return false;
 if(s.mines!==undefined&&(!Array.isArray(s.mines)||s.mines.length!==MINES.length||!s.mines.every((m,i)=>m&&m.id===i&&finite(m.x)&&finite(m.y)&&typeof m.name==='string'&&owner(m.owner)&&owner(m.claimant,-2)&&timer(m.capture)&&m.capture<=4)))return false;
 if(s.flags!==undefined&&!four(s.flags,f=>f&&/^#[0-9a-f]{6}$/i.test(f.primary)&&/^#[0-9a-f]{6}$/i.test(f.accent)&&['soyombo','sun','wolf','horse','star'].includes(f.symbol)))return false;
 if(s.barrages!==undefined&&(!Array.isArray(s.barrages)||s.barrages.length>20||!s.barrages.every(b=>b&&finite(b.x)&&finite(b.y)&&timer(b.t)&&owner(b.owner,0))))return false;
 return true;
}

module.exports={TILE,W,H,MAX,CLANS,CAMPS,MINES,create,tick,command,counts,rate,owned,dist,snapshot,valid,initExtras,rankTier,rankPoints};
})();

