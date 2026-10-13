(function(){
'use strict';
var BUILD='2026-10-13.1';
var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var REDUCE=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function newId(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36)}

/* ---------- defaults (managers can change skills, responsibilities and the onboarding list in Setup) ---------- */
var DEF_SKILLS=[
 {k:'espresso',n:'Espresso & dialing in',g:'On the bar'},{k:'milk',n:'Milk steaming & latte art',g:'On the bar'},{k:'batch',n:'Batch / filter brew',g:'On the bar'},{k:'pour',n:'Pour-over & manual brew',g:'On the bar'},{k:'speed',n:'Speed on a busy bar',g:'On the bar'},
 {k:'pos',n:'Register / POS',g:'Customers'},{k:'cs',n:'Customer service',g:'Customers'},{k:'diff',n:'Handling difficult customers',g:'Customers'},
 {k:'open',n:'Opening routine',g:'Running the shop'},{k:'close',n:'Closing routine',g:'Running the shop'},{k:'cash',n:'Cash handling & deposits',g:'Running the shop'},{k:'inv',n:'Inventory & ordering',g:'Running the shop'},{k:'clean',n:'Cleaning & machine maintenance',g:'Running the shop'},
 {k:'train',n:'Training new staff',g:'People'}
];
var DEF_RESP=[
 {k:'open',n:'Open the shop & set up the bar',c:'Daily ops',s:['open','espresso'],m:2},
 {k:'close',n:'Close the shop & final clean',c:'Daily ops',s:['close','clean'],m:2},
 {k:'dial',n:'Dial in espresso each morning',c:'Quality',s:['espresso'],m:3},
 {k:'rush',n:'Run the bar during the rush',c:'Daily ops',s:['speed','milk'],m:2},
 {k:'cash',n:'Cash counts & bank deposit',c:'Admin',s:['cash'],m:2},
 {k:'order',n:'Order milk, beans & supplies',c:'Admin',s:['inv'],m:2},
 {k:'maint',n:'Machine cleaning & maintenance log',c:'Quality',s:['clean'],m:2},
 {k:'complaints',n:'Handle complaints & escalations',c:'Service',s:['diff','cs'],m:2},
 {k:'trainer',n:'Train new baristas',c:'People',s:['train'],m:3},
 {k:'lead',n:'Shift lead',c:'People',s:['open','close','train','cs'],m:2}
];
var DEF_ONBOARD=[
 {k:'safety',n:'Safety & hygiene briefing'},{k:'tour',n:'Shop tour & team introductions'},{k:'shadowOpen',n:'Shadowed an opening'},{k:'shadowClose',n:'Shadowed a closing'},
 {k:'espresso',n:'Espresso basics signed off'},{k:'milk',n:'Milk steaming basics signed off'},{k:'pos',n:'Register trained'},{k:'cert',n:'Food hygiene certificate'},{k:'solo',n:'First solo shift'}
];
var COMPS=[
 {k:'quality',n:'Coffee quality & consistency',w:5},{k:'process',n:'Spots problems, thinks in process',w:5},{k:'initiative',n:'Takes initiative & ownership',w:4},
 {k:'comms',n:'Communication & team trust',w:4},{k:'coach',n:'Coaching & teaching others',w:4},{k:'reliable',n:'Reliability & follow-through',w:5},
 {k:'calm',n:'Calm under pressure',w:3},{k:'decide',n:'Decision-making',w:4},{k:'biz',n:'Cost, waste & business awareness',w:3},{k:'feedback',n:'Open to feedback & handles conflict',w:3}
];
var PLAN=[
 ['Map the shop','Shadow opening and closing. Write down every step of a normal day and who does it.','A workflow map of a normal day'],
 ['Watch the rush','Time the peak hours. Note queues, bottlenecks and where orders or drinks wait.','Bottlenecks with times'],
 ['Coffee quality','Review the coffee check log and the recipes. Taste together and find problems that repeat.','Recurring quality problems and proposed standards'],
 ['Stock, waste & ordering','Track waste and shortages for the week and trace what caused them.','Waste and shortage list with likely causes'],
 ['Customers & team','Collect customer feedback and teammates’ frustrations in short conversations.','Top 5 pain points'],
 ['Propose changes','Turn what you saw into one or two ideas each, ranked by impact and effort.','Ranked proposals'],
 ['Pilot','The owner approves one or two changes. The group runs them for a week with one clear measure.','Before and after numbers'],
 ['Present & decide','Present results to the owner, discuss changes to the structure and decide who moves on the head barista track.','Decisions and next steps']
];
var AREAS=['Workflow & bar layout','Menu & recipes','Coffee quality','Ordering & inventory','Waste & cost','Customer flow & service','Training & onboarding','Scheduling & roles','Cleaning & maintenance','Other'];
var ROLES=['Trainee','Barista','Senior barista','Shift lead','Head barista'];
var STATUSES=['Idea','Reviewing','Pilot','Adopted','Rejected'];
var DEF_CFG={techShare:0.4,ready:2.5,dev:2.0};
var PRIVATE=['skills','strengths','grow','goals','notes','nextCheckin','onboarding'];
var TABS=[
 {id:'overview',label:'Today'},{id:'me',label:'Me',need:'me'},{id:'team',label:'Team',count:'team'},{id:'roles',label:'Responsibilities',count:'roles'},
 {id:'checks',label:'Coffee checks',count:'checks'},{id:'lead',label:'Leadership',count:'lead'},{id:'ideas',label:'Ideas',count:'ideas'},
 {id:'access',label:'Access',need:'admin',count:'access'},{id:'setup',label:'Setup',need:'admin'}
];

/* ---------- state ---------- */
var S={people:[],invites:[],signupMode:'invite',lastInvite:null,uid:null,myBarista:null,email:'',started:false,profileFor:null,recovery:false,authMode:'signin',
 baristasRaw:[],baristas:[],staff:{},checks:[],ideas:[],assign:{},plan:{},score:{},settings:{},recipes:[],history:[],certs:[],oneonones:[],
 tab:'overview',openId:null,admin:false,db:false,ckFilter:'all',yn:{checked:null,recipe:null,brew:null},confirm:null,editing:null,fresh:true,queue:[],exporting:false};
var db=null,sb=null,pendTimer=null,peopleTimer=null,profTimer=null,flushing=false;

/* ---------- helpers ---------- */
function pad(n){return String(n).padStart(2,'0')}
function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function today(){return ymd(new Date())}
function daysAgo(n){var d=new Date();d.setDate(d.getDate()-n);return ymd(d)}
function addDays(s,n){var d=new Date(s+'T00:00:00');d.setDate(d.getDate()+n);return ymd(d)}
function weekStart(s){var d=s?new Date(s+'T00:00:00'):new Date();d.setDate(d.getDate()-((d.getDay()+6)%7));return ymd(d)}
function daysBetween(a,b){return Math.round((new Date(b+'T00:00:00')-new Date(a+'T00:00:00'))/864e5)}
function fmtDay(s){if(!s)return '';var d=new Date(s+'T00:00:00');return d.toLocaleDateString(undefined,{day:'numeric',month:'short'})}
function n1(v){return v==null?'—':(Math.round(v*10)/10).toFixed(1)}
function pct(v){return v==null?'—':Math.round(v*100)+'%'}
function byName(a,b){return String(a.name||'').localeCompare(String(b.name||''))}
function byRecent(a,b){return (String(b.date||'')+String(b.createdAt||0).padStart(15,'0'))>(String(a.date||'')+String(a.createdAt||0).padStart(15,'0'))?1:-1}
function bget(id){for(var i=0;i<S.baristas.length;i++){if(S.baristas[i].id===id)return S.baristas[i]}return null}
function bname(id){var b=bget(id);return b?b.name||'Unnamed':'Former barista'}
function canSee(b){return !!b&&(S.admin||b.id===S.myBarista)}
function me(){return S.myBarista?bget(S.myBarista):null}
function setting(k){return (S.settings&&S.settings[k])||{}}
function skillsList(){var l=setting('skills').list;return Array.isArray(l)&&l.length?l:DEF_SKILLS}
function skillMap(){var m={};skillsList().forEach(function(s){m[s.k]=s});return m}
function respList(){var l=setting('resp').list;return Array.isArray(l)&&l.length?l:DEF_RESP}
function onboardList(){var l=setting('onboard').list;return Array.isArray(l)&&l.length?l:DEF_ONBOARD}
function cfg(){var c=setting('config');return {techShare:c.techShare!=null?c.techShare:DEF_CFG.techShare,ready:c.ready!=null?c.ready:DEF_CFG.ready,dev:c.dev!=null?c.dev:DEF_CFG.dev}}
function weight(k){var w=setting('config').weights&&setting('config').weights[k];if(typeof w==='number')return w;for(var i=0;i<COMPS.length;i++){if(COMPS[i].k===k)return COMPS[i].w}return 1}
function skillVal(b,k){var v=b&&b.skills&&b.skills[k];return typeof v==='number'?v:null}
function ratedVals(b){var o=[];skillsList().forEach(function(s){var v=skillVal(b,s.k);if(v!=null)o.push(v)});return o}
function techAvg(b){var r=ratedVals(b);if(!r.length)return null;return r.reduce(function(a,c){return a+c},0)/r.length}
function expertCount(b){return ratedVals(b).filter(function(v){return v===3}).length}
function gapCount(b){return ratedVals(b).filter(function(v){return v<=1}).length}
function avgSkills(sk){var v=[];skillsList().forEach(function(s){var x=sk&&sk[s.k];if(typeof x==='number')v.push(x)});return v.length?v.reduce(function(a,c){return a+c},0)/v.length:null}
function respStatus(r,b){
  var m=skillMap(),short=0,missing=false,n=0;
  r.s.forEach(function(k){if(!m[k])return;n++;var v=skillVal(b,k);if(v==null)missing=true;else if(v<r.m)short+=r.m-v});
  if(!n||missing)return 'unknown';
  if(short===0)return 'ready';
  if(short===1)return 'almost';
  return 'no';
}
function nextSteps(b){
  var out=[],m=skillMap();if(!ratedVals(b).length)return out;
  respList().forEach(function(r){
    if(respStatus(r,b)==='ready')return;
    var gaps=[];r.s.forEach(function(k){if(!m[k])return;var v=skillVal(b,k),cur=v==null?0:v;if(cur<r.m)gaps.push({k:k,n:m[k].n,from:cur,to:r.m})});
    if(gaps.length)out.push({r:r,gaps:gaps,total:gaps.reduce(function(a,g){return a+g.to-g.from},0)});
  });
  out.sort(function(a,c){return a.total-c.total});return out;
}
function leadScore(id){
  var sc=S.score[id];if(!sc||!sc.ratings)return null;var num=0,den=0;
  COMPS.forEach(function(c){var v=sc.ratings[c.k];if(typeof v==='number'){var w=weight(c.k);num+=v*w;den+=w}});
  return den?num/den:null;
}
function overall(b){var t=techAvg(b),l=leadScore(b.id);if(t==null||l==null)return null;var sh=cfg().techShare;return sh*t+(1-sh)*l}
function readiness(b){
  var o=overall(b),l=leadScore(b.id);if(o==null)return null;var c=cfg();
  if(o>=c.ready&&l>=2)return {t:'Ready for head barista track',k:'good'};
  if(o>=c.dev)return {t:'Developing: give a project',k:'warn'};
  return {t:'Not yet: keep building',k:''};
}
function isFlag(c){return c.checked===false||c.recipeProblem===true||c.brewingWell===false||(c.off&&c.off.length>0)}
function checkStats(id,from){
  var cs=S.checks.filter(function(c){return c.baristaId===id&&(!from||c.date>=from)});
  var done=cs.filter(function(c){return c.checked}).length;
  return {n:cs.length,done:done,flags:cs.filter(isFlag).length,pct:cs.length?done/cs.length:null};
}
function ideaPriority(i){
  if(i.impact==='High'&&i.effort!=='High')return {t:'Do first',r:0,k:'good'};
  if(i.impact==='High')return {t:'Plan it',r:1,k:'acc'};
  if(i.impact==='Medium'&&i.effort==='Low')return {t:'Quick win',r:2,k:'acc'};
  return {t:'Later',r:3,k:''};
}
function ratio(d,y){d=parseFloat(d);y=parseFloat(y);return d>0&&y>0?'1:'+(y/d).toFixed(1):null}
function numOrNull(v){var n=parseFloat(v);return isNaN(n)?null:n}
function recipeByName(n){n=String(n||'').trim().toLowerCase();if(!n)return null;for(var i=0;i<S.recipes.length;i++){if(String(S.recipes[i].name||'').trim().toLowerCase()===n)return S.recipes[i]}return null}
function offRecipe(rec,dose,yld,time){
  var off=[];if(!rec)return off;
  if(rec.dose&&dose!=null&&Math.abs(dose-rec.dose)>(rec.tolD!=null?rec.tolD:0.5))off.push('dose');
  if(rec.yield&&yld!=null&&Math.abs(yld-rec.yield)>(rec.tolY!=null?rec.tolY:2))off.push('yield');
  if(rec.time&&time!=null&&Math.abs(time-rec.time)>(rec.tolT!=null?rec.tolT:3))off.push('time');
  return off;
}
function certInfo(c){
  if(!c.expires)return {k:'',t:'No expiry date',days:null};
  var d=daysBetween(today(),c.expires);
  if(d<0)return {k:'bad',t:'Expired '+(-d)+(d===-1?' day':' days')+' ago',days:d};
  if(d<=60)return {k:'warn',t:'Expires in '+d+(d===1?' day':' days'),days:d};
  return {k:'good',t:'Valid until '+fmtDay(c.expires),days:d};
}
function onboardProgress(b){var l=onboardList(),o=b.onboarding||{},n=0;l.forEach(function(i){if(o[i.k])n++});return {done:n,total:l.length}}
function histFor(id){return S.history.filter(function(h){return h.baristaId===id&&h.date}).sort(function(a,b){return a.date<b.date?-1:1})}
function canEditEntry(e,field){
  if(S.admin)return true;
  if(!S.myBarista||e[field]!==S.myBarista)return false;
  return Date.now()-(e.createdAt||0)<864e5-60000;
}
function pill(t,k){return '<span class="pill '+(k||'')+'">'+esc(t)+'</span>'}
function sampleTag(x){return x&&x.sample?' <span class="pill">Sample</span>':''}
function rebuild(){
  S.baristas=S.baristasRaw.map(function(b){var o=Object.assign({},b),st=S.staff[b.id];if(st){PRIVATE.forEach(function(f){if(st[f]!==undefined)o[f]=st[f]});o.hasPrivate=true}return o});
}

/* ---------- toasts, errors ---------- */
var toastT;
function toast(m){var el=$('#toastMount');el.innerHTML='<div class="toast">'+esc(m)+'</div>';clearTimeout(toastT);toastT=setTimeout(function(){el.innerHTML=''},3600)}
function fail(e){var c=e&&e.code;toast(c==='invalid_argument'||c==='not_granted'?'You don’t have permission to change that, or the 24 hour edit window has passed.':(c==='quota_exceeded'?'The database is full. Delete some old entries.':'That didn’t save. Check your connection and try again.'))}
var tq={};
function queue(key,fn){var p=(tq[key]||Promise.resolve()).then(fn,fn).catch(function(e){fail(e)});tq[key]=p;return p}

/* ---------- charts (inline SVG; colours come from the page theme) ---------- */
function chartW(max){var vw=document.documentElement.clientWidth||360;return Math.max(280,Math.min(max||720,vw-64))}
function niceMax(v){var st=[5,10,15,20,30,40,50,75,100,150,200,300,500,1000];for(var i=0;i<st.length;i++){if(v<=st[i])return st[i]}return Math.ceil(v/100)*100}
function topRound(x,y,w,h,r){r=Math.min(r,h,w/2);return 'M'+x+','+(y+h)+'L'+x+','+(y+r)+'Q'+x+','+y+' '+(x+r)+','+y+'L'+(x+w-r)+','+y+'Q'+(x+w)+','+y+' '+(x+w)+','+(y+r)+'L'+(x+w)+','+(y+h)+'Z'}
function lineChart(pts,o){
  o=o||{};if(!pts.length)return '';
  var W=chartW(o.w),H=190,L=32,R=22,T=22,B=28,min=o.min!=null?o.min:0,max=o.max!=null?o.max:3;
  var t0=new Date(pts[0].d+'T00:00:00').getTime(),t1=new Date(pts[pts.length-1].d+'T00:00:00').getTime();
  function X(d){return (pts.length===1||t1===t0)?L+(W-L-R)/2:L+((new Date(d+'T00:00:00').getTime()-t0)/(t1-t0))*(W-L-R)}
  function Y(v){return T+(1-(v-min)/(max-min))*(H-T-B)}
  var g='',i,path='',dots='',rows='';
  for(i=min;i<=max;i++)g+='<line class="grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(i).toFixed(1)+'" y2="'+Y(i).toFixed(1)+'"/><text class="axis" x="'+(L-8)+'" y="'+(Y(i)+4).toFixed(1)+'" text-anchor="end">'+i+'</text>';
  pts.forEach(function(p,k){path+=(k?'L':'M')+X(p.d).toFixed(1)+','+Y(p.v).toFixed(1);rows+='<tr><td>'+esc(fmtDay(p.d))+'</td><td class="mono">'+n1(p.v)+'</td></tr>'});
  var last=pts[pts.length-1];
  pts.forEach(function(p){dots+='<circle class="dot" cx="'+X(p.d).toFixed(1)+'" cy="'+Y(p.v).toFixed(1)+'" r="4"/>'});
  var xl='<text class="axis" x="'+X(pts[0].d).toFixed(1)+'" y="'+(H-8)+'" text-anchor="'+(pts.length>1?'start':'middle')+'">'+esc(fmtDay(pts[0].d))+'</text>';
  if(pts.length>1)xl+='<text class="axis" x="'+X(last.d).toFixed(1)+'" y="'+(H-8)+'" text-anchor="end">'+esc(fmtDay(last.d))+'</text>';
  var data=esc(JSON.stringify(pts.map(function(p){return {d:p.d,v:Math.round(p.v*10)/10,x:Math.round(X(p.d)*10)/10,y:Math.round(Y(p.v)*10)/10}})));
  return '<div class="chartbox"><svg class="chart" data-kind="line" data-label="'+esc(o.label||'')+'" data-pts="'+data+'" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="'+esc((o.label||'Chart')+', '+pts.length+' points, latest '+n1(last.v))+'">'
    +g+'<line class="xh" x1="0" x2="0" y1="'+T+'" y2="'+(H-B)+'" hidden/><path class="ln" d="'+path+'" pathLength="1"/>'+dots+xl
    +'<text class="val" x="'+X(last.d).toFixed(1)+'" y="'+(Y(last.v)-10).toFixed(1)+'" text-anchor="'+(pts.length>1?'end':'middle')+'">'+n1(last.v)+'</text></svg>'
    +'<details class="tbl"><summary>Table view</summary><table><tr><th>Week</th><th>'+esc(o.label||'Value')+'</th></tr>'+rows+'</table></details></div>';
}
function weekBars(weeks,o){
  o=o||{};
  var W=chartW(o.w),H=190,L=34,R=10,T=16,B=28,n=weeks.length;
  var max=niceMax(Math.max.apply(null,weeks.map(function(w){return w.ok+w.flag}).concat([1])));
  function Y(v){return T+(1-v/max)*(H-T-B)}
  var base=H-B,band=(W-L-R)/n,bw=Math.min(24,band*0.6),g='',bars='',xl='',rows='',i;
  [0,max/2,max].forEach(function(v){g+='<line class="grid" x1="'+L+'" x2="'+(W-R)+'" y1="'+Y(v).toFixed(1)+'" y2="'+Y(v).toFixed(1)+'"/><text class="axis" x="'+(L-8)+'" y="'+(Y(v)+4).toFixed(1)+'" text-anchor="end">'+(Math.round(v*10)/10)+'</text>'});
  weeks.forEach(function(w,k){
    var cx=L+band*(k+0.5),x=cx-bw/2,tot=w.ok+w.flag,seg='';
    if(w.ok>0){var yo=Y(w.ok),ho=base-yo;seg+=(w.flag>0?'<rect class="mk-ok" x="'+x.toFixed(1)+'" y="'+yo.toFixed(1)+'" width="'+bw+'" height="'+ho.toFixed(1)+'"/>':'<path class="mk-ok" d="'+topRound(x,yo,bw,ho,4)+'"/>')}
    if(w.flag>0){var yt=Y(tot),yb=w.ok>0?Y(w.ok)-2:base;seg+='<path class="mk-flag" d="'+topRound(x,yt,bw,Math.max(2,yb-yt),4)+'"/>'}
    var tip=['Week of '+fmtDay(w.d),w.ok+' checked, no issues',w.flag+(w.flag===1?' needs':' need')+' follow-up'].join('|');
    bars+='<g class="bar" tabindex="0" data-tip="'+esc(tip)+'">'+seg+'<rect class="hit" x="'+(cx-band/2).toFixed(1)+'" y="'+T+'" width="'+band.toFixed(1)+'" height="'+(H-T-B)+'"/></g>';
    if(band>=40||k%2===0)xl+='<text class="axis" x="'+cx.toFixed(1)+'" y="'+(H-8)+'" text-anchor="middle">'+esc(fmtDay(w.d))+'</text>';
    rows+='<tr><td>'+esc(fmtDay(w.d))+'</td><td class="mono">'+w.ok+'</td><td class="mono">'+w.flag+'</td></tr>';
  });
  return '<div class="chartbox"><div class="legend"><span><i style="background:var(--mk-ok)"></i>Checked, no issues</span><span><i style="background:var(--accent)"></i>Needs follow-up</span></div>'
    +'<svg class="chart" data-kind="bars" viewBox="0 0 '+W+' '+H+'" width="'+W+'" height="'+H+'" role="img" aria-label="Coffee checks per week, split by whether they need follow-up">'+g+bars+xl+'</svg>'
    +'<details class="tbl"><summary>Table view</summary><table><tr><th>Week of</th><th>No issues</th><th>Follow-up</th></tr>'+rows+'</table></details></div>';
}
function coffeeBars(rows){
  if(!rows.length)return '<p class="small muted">No follow-ups yet. Nothing to rank.</p>';
  var mx=Math.max.apply(null,rows.map(function(r){return r.flag}));
  return '<div class="hbars">'+rows.map(function(r){
    return '<div class="hb" title="'+esc(r.name+': '+r.flag+' of '+r.n+' checks need follow-up')+'"><span class="hb-n">'+esc(r.name)+'</span><span class="hb-bar"><i style="width:'+Math.max(4,Math.round(r.flag/mx*100))+'%"></i></span><span class="hb-v mono">'+r.flag+' of '+r.n+'</span></div>';
  }).join('')+'</div>';
}
var tipEl=null;
function showTip(lines,cx,cy){
  if(!tipEl){tipEl=document.createElement('div');tipEl.className='tip';tipEl.setAttribute('role','status');document.body.appendChild(tipEl)}
  tipEl.textContent='';
  lines.forEach(function(t,i){var d=document.createElement('div');d.className=i===0?'tip-v':'tip-l';d.textContent=t;tipEl.appendChild(d)});
  tipEl.hidden=false;
  var w=tipEl.offsetWidth,h=tipEl.offsetHeight,x=cx+14,y=cy-h-10;
  if(x+w>window.innerWidth-8)x=cx-w-14;if(x<8)x=8;if(y<8)y=cy+18;
  tipEl.style.left=x+'px';tipEl.style.top=y+'px';
}
function hideTip(){if(tipEl)tipEl.hidden=true;$$('.chart .xh').forEach(function(x){x.setAttribute('hidden','')})}
function chartPointer(svg,ev){
  var pts;try{pts=JSON.parse(svg.getAttribute('data-pts'))}catch(e){return}
  var r=svg.getBoundingClientRect(),vb=svg.viewBox.baseVal,x=(ev.clientX-r.left)/r.width*vb.width,best=pts[0];
  pts.forEach(function(p){if(Math.abs(p.x-x)<Math.abs(best.x-x))best=p});
  var xh=$('.xh',svg);if(xh){xh.setAttribute('x1',best.x);xh.setAttribute('x2',best.x);xh.removeAttribute('hidden')}
  showTip([String(best.v),'Week of '+fmtDay(best.d)+' · '+(svg.getAttribute('data-label')||'')],ev.clientX,ev.clientY);
}

/* ---------- shared fragments ---------- */
function strip(b,row){
  var sk=skillsList();
  return '<div class="strip" style="grid-template-columns:repeat('+sk.length+',1fr);--r:'+(row||0)+'" aria-hidden="true">'+sk.map(function(s,i){var v=skillVal(b,s.k);return '<i class="'+(v==null?'':'v'+v)+'" style="--i:'+i+'" title="'+esc(s.n)+(v==null?': not rated':': '+v)+'"></i>'}).join('')+'</div>';
}
function seg(kind,key,val,dis,label){
  return '<div class="seg" role="group" aria-label="'+esc(label)+'">'+[0,1,2,3].map(function(v){
    return '<button type="button" class="'+(val===v?'on s'+v:'')+'" data-act="rate" data-kind="'+kind+'" data-key="'+esc(key)+'" data-v="'+v+'" aria-pressed="'+(val===v)+'"'+(dis?' disabled':'')+'>'+v+'</button>';
  }).join('')+'</div>';
}
function emptyTeam(){
  return '<div class="card empty"><h3>No baristas yet</h3><p>Add the people on your team to start rating skills, logging coffee checks and planning who can take on what.</p>'
   +(S.admin?'<div class="row"><button class="btn" data-act="goto-add">Add the first barista</button><button class="btn ghost" data-act="sample-load">Load a sample team</button></div>':'<p>A manager needs to add the team first.</p>')+'</div>';
}
function stat(label,value,i,bad){return '<div class="stat" style="--i:'+i+'"><span class="label">'+label+'</span><b data-n="'+value+'"'+(bad?' style="color:var(--bad)"':'')+'>'+value+'</b></div>'}
function whyList(c){
  var w=[];if(c.checked===false)w.push('check skipped');if(c.recipeProblem)w.push('recipe problem');if(c.brewingWell===false)w.push('not brewing well');
  if(c.off&&c.off.length)w.push('off recipe: '+c.off.join(', '));return w;
}
function notLinkedNote(){return '<div class="card flat"><strong>Your account is not linked to a barista profile yet.</strong><p class="small muted">Ask a manager to link it in the Access tab. Then you can log coffee checks and see your own skills and next steps.</p></div>'}
function groupSkills(){var out=[],cur=null;skillsList().forEach(function(s){if(!cur||cur.g!==s.g){cur={g:s.g||'Other',items:[]};out.push(cur)}cur.items.push(s)});return out}
function checkItem(c){
  var r=ratio(c.dose,c.yield),pills=[];
  pills.push(c.checked?pill('Checked','good'):pill('Check skipped','bad'));
  if(c.recipeProblem)pills.push(pill('Recipe problem','bad'));
  if(c.brewingWell===false)pills.push(pill('Not brewing well','bad'));
  if(c.off&&c.off.length)pills.push(pill('Off recipe: '+c.off.join(', '),'bad'));
  if(!isFlag(c))pills.push(pill('OK','good'));
  var mine=canEditEntry(c,'baristaId'),k='checks/'+c.id;
  return '<div class="item"><div class="row between"><span class="t">'+esc(bname(c.baristaId))+' <span class="muted" style="font-weight:400">· '+esc(c.coffee||'Coffee')+sampleTag(c)+'</span></span><span class="small muted mono">'+esc(c.date)+' · '+esc(c.shift||'')+'</span></div>'
    +'<div class="row">'+pills.join('')+(r?'<span class="ratio">'+esc(c.dose)+'g → '+esc(c.yield)+'g = '+r+(c.time?' in '+esc(c.time)+'s':'')+'</span>':'')+'</div>'
    +(c.taste?'<div class="small"><span class="muted">Taste:</span> '+esc(c.taste)+'</div>':'')
    +(c.fix?'<div class="small"><span class="muted">Fix:</span> '+esc(c.fix)+'</div>':'')
    +(mine?'<div class="row"><button class="btn ghost sm" data-act="edit-entry" data-coll="checks" data-id="'+c.id+'">Edit</button><button class="btn danger sm" data-act="del" data-coll="checks" data-id="'+c.id+'">'+(S.confirm===k?'Confirm delete':'Delete')+'</button></div>':'')+'</div>';
}
function ideaItem(i){
  var p=ideaPriority(i),mine=canEditEntry(i,'byId'),k='ideas/'+i.id;
  return '<div class="item"><div class="row between"><span class="t">'+esc(i.area||'Other')+sampleTag(i)+'</span><span class="row">'+pill(p.t,p.k)+pill(i.status||'Idea',i.status==='Adopted'?'good':'')+'</span></div>'
    +'<div class="small"><span class="muted">Problem:</span> '+esc(i.problem)+'</div><div class="small"><span class="muted">Change:</span> '+esc(i.change)+'</div>'
    +'<div class="small muted">'+esc(bname(i.byId))+' · '+esc(i.date||'')+' · Impact '+esc(i.impact)+' · Effort '+esc(i.effort)+'</div>'
    +(S.admin?'<div class="form"><label class="field"><span>Status</span><select data-idea="'+i.id+'" data-f="status">'+STATUSES.map(function(s){return '<option'+((i.status||'Idea')===s?' selected':'')+'>'+s+'</option>'}).join('')+'</select></label><label class="field"><span>Owner</span><input type="text" data-keep data-idea="'+i.id+'" data-f="owner" value="'+esc(i.owner||'')+'"></label><label class="field wide"><span>Result and what we learned</span><input type="text" data-keep data-idea="'+i.id+'" data-f="result" value="'+esc(i.result||'')+'"></label></div>'
       :((i.owner?'<div class="small"><span class="muted">Owner:</span> '+esc(i.owner)+'</div>':'')+(i.result?'<div class="small"><span class="muted">Result:</span> '+esc(i.result)+'</div>':'')))
    +(mine?'<div class="row"><button class="btn ghost sm" data-act="edit-entry" data-coll="ideas" data-id="'+i.id+'">Edit</button><button class="btn danger sm" data-act="del" data-coll="ideas" data-id="'+i.id+'">'+(S.confirm===k?'Confirm delete':'Delete')+'</button></div>':'')+'</div>';
}
function progressBlock(b,w){
  var h=histFor(b.id).map(function(x){return {d:x.date,v:avgSkills(x.skills),sk:x.skills}}).filter(function(x){return x.v!=null});
  if(!h.length)return '<p class="small muted">Progress appears here once skills are rated. A new point is added each week a rating changes.</p>';
  var out=lineChart(h.slice(-26),{label:'Average skill level',w:w});
  if(h.length>1){
    var first=h[0].sk||{},last=h[h.length-1].sk||{},gains=[];
    skillsList().forEach(function(s){var a=typeof first[s.k]==='number'?first[s.k]:0,c=typeof last[s.k]==='number'?last[s.k]:null;if(c!=null&&c>a)gains.push(s.n+' +'+(c-a))});
    out+='<p class="small" style="margin-top:8px"><span class="muted">Since '+esc(fmtDay(h[0].d))+':</span> '+(gains.length?esc(gains.slice(0,6).join(', ')):'no skill has gone up yet')+'</p>';
  }else out+='<p class="small muted" style="margin-top:8px">One data point so far. The line appears after the next week with a rating change.</p>';
  return out;
}

/* ---------- Today ---------- */
function renderOverview(){
  var el=$('#ovBody');
  var pendN=S.admin?S.people.filter(function(p){return !p.approved}).length:0;
  var banner=pendN?'<div class="card flat row between"><span>'+pendN+(pendN===1?' person is':' people are')+' waiting for access.</span><button class="btn sm" data-act="tab" data-tab="access">Review</button></div>':'';
  if(!S.admin&&!S.myBarista)banner+=notLinkedNote();
  if(!S.baristas.length){el.innerHTML=banner+emptyTeam();return}
  var wk=daysAgo(6),td=today();
  var weekChecks=S.checks.filter(function(c){return c.date>=wk});
  var flags=weekChecks.filter(isFlag).sort(byRecent);
  var cohort=S.baristas.filter(function(b){return b.inCohort});
  var live=S.ideas.filter(function(i){var s=i.status||'Idea';return s==='Idea'||s==='Reviewing'||s==='Pilot'});
  var missing=S.baristas.filter(function(b){return !S.checks.some(function(c){return c.baristaId===b.id&&c.date===td})}).sort(byName);
  var h=banner+'<div class="stats">'+stat('Baristas',S.baristas.length,0)+stat('Checks, 7 days',weekChecks.length,1)+stat('Follow-ups, 7 days',flags.length,2,flags.length>0)+stat('Ideas in play',live.length,3)+stat('In leadership group',cohort.length,4)+'</div>';
  h+='<div class="grid g-2"><div class="card"><h3>Needs attention</h3><div class="list">';
  if(flags.length){flags.slice(0,5).forEach(function(c){
    h+='<div class="item"><div class="row between"><span class="t">'+esc(bname(c.baristaId))+' <span class="muted" style="font-weight:400">· '+esc(c.coffee||'Coffee')+'</span></span><span class="small muted mono">'+esc(c.date)+'</span></div><div class="row">'+whyList(c).map(function(w){return pill(w,'bad')}).join('')+'</div>'+(c.fix?'<div class="small">'+esc(c.fix)+'</div>':'')+'</div>';
  })}else{h+='<div class="item muted">No follow-ups in the last 7 days.</div>'}
  h+='</div></div><div class="card"><h3>No coffee check logged today</h3><div class="row" style="margin-top:4px">'
   +(missing.length?missing.map(function(b){return pill(b.name||'Unnamed','warn')}).join(''):pill('Everyone has logged one','good'))
   +'</div><p class="small muted" style="margin-top:10px">Someone with no entry may have forgotten to log, so ask.</p></div></div>';
  if(S.admin){
    var open=[];
    respList().forEach(function(r){
      var as=S.assign[r.k];var hasOwner=as&&as.ownerId&&bget(as.ownerId);
      var rd=S.baristas.filter(function(b){return respStatus(r,b)==='ready'});
      if(!hasOwner&&rd.length)open.push({r:r,rd:rd});
    });
    h+='<div class="grid g-2"><div class="card"><h3>Ready to take something on</h3><div class="list">';
    if(open.length){open.slice(0,6).forEach(function(o){h+='<div class="item"><span class="t">'+esc(o.r.n)+'</span><div class="row"><span class="small muted">No owner. Ready:</span>'+o.rd.sort(byName).map(function(b){return pill(b.name,'good')}).join('')+'</div></div>'})}
    else{h+='<div class="item muted">Nothing unowned has a ready person right now. Rate skills on the Team tab to see matches.</div>'}
    h+='</div></div>';
    var thin=[];
    if(S.baristas.length>=2){skillsList().forEach(function(s){var n=S.baristas.filter(function(b){return (skillVal(b,s.k)||0)>=2}).length;if(n<2)thin.push({s:s,n:n})})}
    h+='<div class="card"><h3>Thin coverage</h3><p class="small muted">Skills where fewer than two people work independently.</p><div class="row" style="margin-top:10px">'
     +(thin.length?thin.map(function(t){return pill(t.s.n+' ('+t.n+')',t.n===0?'bad':'warn')}).join(''):pill('Every skill has at least two people','good'))+'</div></div></div>';
    /* people care */
    var due=S.baristas.filter(function(b){return b.nextCheckin&&b.nextCheckin<=addDays(td,7)}).sort(function(a,b){return a.nextCheckin<b.nextCheckin?-1:1});
    var certs=S.certs.map(function(c){return {c:c,i:certInfo(c)}}).filter(function(x){return x.i.k==='bad'||x.i.k==='warn'}).sort(function(a,b){return a.i.days-b.i.days});
    var onb=S.baristas.filter(function(b){var p=onboardProgress(b);return p.done<p.total&&(b.role==='Trainee'||(b.startDate&&b.startDate>=daysAgo(60)))});
    h+='<div class="grid g-2"><div class="card"><h3>Check-ins due</h3><div class="list">'
      +(due.length?due.map(function(b){return '<button class="item rowbtn" data-act="open-b" data-id="'+b.id+'"><span class="row between"><span class="t">'+esc(b.name)+'</span>'+(b.nextCheckin<td?pill('Overdue since '+fmtDay(b.nextCheckin),'bad'):pill(b.nextCheckin===td?'Today':fmtDay(b.nextCheckin),'warn'))+'</span></button>'}).join(''):'<div class="item muted">No one-to-ones due in the next 7 days. Set a next check-in date on a barista’s file.</div>')
      +'</div></div><div class="card"><h3>Certifications</h3><div class="list">'
      +(certs.length?certs.slice(0,6).map(function(x){return '<button class="item rowbtn" data-act="open-b" data-id="'+esc(x.c.baristaId)+'"><span class="row between"><span class="t">'+esc(bname(x.c.baristaId))+' <span class="muted" style="font-weight:400">· '+esc(x.c.name)+'</span></span>'+pill(x.i.t,x.i.k)+'</span></button>'}).join(''):'<div class="item muted">Nothing expired or expiring in the next 60 days.</div>')
      +'</div></div></div>';
    if(onb.length)h+='<div class="card"><h3>Onboarding in progress</h3><div class="list">'+onb.map(function(b){var p=onboardProgress(b);return '<button class="item rowbtn" data-act="open-b" data-id="'+b.id+'"><span class="row between"><span class="t">'+esc(b.name)+'</span><span class="small mono muted">'+p.done+' of '+p.total+' done</span></span><div class="bar"><i style="width:'+Math.round(p.done/p.total*100)+'%"></i></div></button>'}).join('')+'</div></div>';
    if(cohort.length){
      h+='<div class="card"><h3>Leadership group</h3><div class="list">';
      cohort.sort(byName).forEach(function(b){
        var rd=readiness(b);
        h+='<button class="item rowbtn" data-act="open-b" data-id="'+b.id+'"><span class="row between"><span class="t">'+esc(b.name)+sampleTag(b)+'</span>'+(rd?pill(rd.t,rd.k):'<span class="small muted mono">skills '+n1(techAvg(b))+'</span>')+'</span>'+(b.cohortFocus?'<span class="small muted">Focus: '+esc(b.cohortFocus)+'</span>':'')+'</button>';
      });
      h+='</div></div>';
    }
    if(S.baristas.some(function(b){return b.sample}))h+='<div class="card flat row between"><span class="small">The sample team is still loaded. Remove it before you add real people.</span><button class="btn ghost sm" data-act="sample-clear">Remove sample data</button></div>';
  }else if(S.myBarista){
    var mb=me(),steps=mb?nextSteps(mb):[];
    if(steps.length)h+='<div class="card"><h3>Your next steps</h3><div class="list">'+steps.slice(0,2).map(function(s){return '<div class="item"><span class="t">'+esc(s.r.n)+'</span><span class="small muted">'+s.gaps.map(function(g){return 'Raise '+esc(g.n)+' to level '+g.to}).join(' · ')+'</span></div>'}).join('')+'</div><p style="margin-top:10px"><button class="btn ghost sm" data-act="tab" data-tab="me">See all of mine</button></p></div>';
  }
  el.innerHTML=h;
}

/* ---------- Me ---------- */
function renderMe(){
  var el=$('#meBody'),b=me();
  if(!b){el.innerHTML=S.myBarista?'<div class="card flat">Your barista profile could not be found. Ask a manager to check the link in the Access tab.</div>':notLinkedNote();return}
  var t=techAvg(b),st=checkStats(b.id,daysAgo(29)),steps=nextSteps(b),ok=respList().filter(function(r){return respStatus(r,b)==='ready'});
  var op=onboardProgress(b),h='';
  h+='<div class="card"><div class="kv">'+'<div><span class="label">Skill avg</span><b>'+n1(t)+'</b></div><div><span class="label">Experts</span><b>'+(ratedVals(b).length?expertCount(b):'—')+'</b></div><div><span class="label">Checks done, 30 days</span><b>'+pct(st.pct)+'</b></div><div><span class="label">Follow-ups, 30 days</span><b>'+st.flags+'</b></div></div></div>';
  h+='<div class="grid g-2"><div class="card"><h3>What to work on next</h3>';
  if(!ratedVals(b).length)h+='<p class="muted">Your manager has not rated your skills yet. Once they do, your next steps show up here.</p>';
  else if(!steps.length)h+='<p class="muted">You meet every responsibility on the list. Ask your manager about taking on something new.</p>';
  else h+='<div class="list">'+steps.slice(0,3).map(function(s){return '<div class="item"><div class="row between"><span class="t">'+esc(s.r.n)+'</span>'+(s.total===1?pill('One step away','warn'):'')+'</div><span class="small">'+s.gaps.map(function(g){return 'Raise <strong>'+esc(g.n)+'</strong> from '+g.from+' to '+g.to}).join(' · ')+'</span></div>'}).join('')+'</div>';
  h+='</div><div class="card"><h3>You can take on</h3><div class="row">'+(ok.length?ok.map(function(r){return pill(r.n,'good')}).join(''):'<span class="muted small">Nothing yet. Keep building skills.</span>')+'</div></div></div>';
  h+='<div class="card"><h3>My skills</h3><div class="legend" style="margin:0 0 6px"><span><i style="background:var(--s0)"></i>0 Not trained</span><span><i style="background:var(--s1)"></i>1 Learning</span><span><i style="background:var(--s2)"></i>2 Independent</span><span><i style="background:var(--s3)"></i>3 Can train others</span></div>';
  groupSkills().forEach(function(g){h+='<div class="label" style="margin:14px 0 2px">'+esc(g.g)+'</div>';g.items.forEach(function(s){h+='<div class="skillrow"><span>'+esc(s.n)+'</span>'+seg('skill',s.k,skillVal(b,s.k),true,s.n)+'</div>'})});
  h+='</div>';
  h+='<div class="card"><h3>My progress</h3>'+progressBlock(b)+'</div>';
  if(op.done<op.total){
    h+='<div class="card"><h3>Onboarding</h3><div class="bar" style="margin-bottom:10px"><i style="width:'+Math.round(op.done/op.total*100)+'%"></i></div><div class="list">'+onboardList().map(function(i){var d=(b.onboarding||{})[i.k];return '<div class="item"><div class="row between"><span>'+esc(i.n)+'</span>'+(d?pill('Signed off '+fmtDay(d),'good'):pill('To do',''))+'</div></div>'}).join('')+'</div></div>';
  }
  var mc=S.certs.filter(function(c){return c.baristaId===b.id});
  if(mc.length)h+='<div class="card"><h3>My certifications</h3><div class="list">'+mc.map(function(c){var i=certInfo(c);return '<div class="item"><div class="row between"><span class="t">'+esc(c.name)+'</span>'+pill(i.t,i.k)+'</div></div>'}).join('')+'</div></div>';
  if(b.strengths||b.grow||b.goals)h+='<div class="card"><h3>From your manager</h3><div class="stack">'+(b.strengths?'<div><span class="label">Strengths</span><p>'+esc(b.strengths)+'</p></div>':'')+(b.grow?'<div><span class="label">Areas to grow</span><p>'+esc(b.grow)+'</p></div>':'')+(b.goals?'<div><span class="label">Goals</span><p>'+esc(b.goals)+'</p></div>':'')+'</div></div>';
  var myC=S.checks.filter(function(c){return c.baristaId===b.id}).sort(byRecent).slice(0,5),myI=S.ideas.filter(function(i){return i.byId===b.id}).sort(function(a,c){return (c.createdAt||0)-(a.createdAt||0)}).slice(0,5);
  h+='<div class="grid g-2"><div class="card"><h3>My recent checks</h3><div class="list">'+(myC.length?myC.map(checkItem).join(''):'<div class="item muted">None yet.</div>')+'</div></div><div class="card"><h3>My ideas</h3><div class="list">'+(myI.length?myI.map(ideaItem).join(''):'<div class="item muted">None yet.</div>')+'</div></div></div>';
  el.innerHTML=h;
}

/* ---------- Team ---------- */
function renderTeam(){
  $('#teamTools').innerHTML=S.admin?'<form id="addForm" class="row" autocomplete="off"><input type="text" id="addName" data-keep placeholder="Barista name" style="width:170px" aria-label="Barista name"><button class="btn" type="submit">Add barista</button></form>':'';
  $('#teamLegend').hidden=!S.admin;
  var g=$('#teamGrid');
  if(!S.baristas.length){g.innerHTML=emptyTeam();return}
  g.innerHTML=S.baristas.slice().sort(byName).map(function(b,i){
    var see=canSee(b),open=S.admin,self=!S.admin&&b.id===S.myBarista;
    var head='<div class="stack" style="gap:4px"><h3>'+esc(b.name||'Unnamed')+sampleTag(b)+(self?' <span class="pill acc">You</span>':'')+'</h3><div class="row small muted"><span>'+esc(b.role||'Barista')+'</span>'+(b.location?'<span>· '+esc(b.location)+'</span>':'')+(b.inCohort?pill('Leadership group','acc'):'')+'</div></div>';
    var body='';
    if(see){
      var t=techAvg(b),st=checkStats(b.id,daysAgo(29)),ready=respList().filter(function(r){return respStatus(r,b)==='ready'}).length;
      body=strip(b,i)+'<div class="kv"><div><span class="label">Skill avg</span><b>'+n1(t)+'</b></div><div><span class="label">Experts</span><b>'+(ratedVals(b).length?expertCount(b):'—')+'</b></div><div><span class="label">Gaps</span><b>'+(ratedVals(b).length?gapCount(b):'—')+'</b></div><div><span class="label">Can own</span><b>'+ready+'</b></div><div><span class="label">Checks done</span><b>'+pct(st.pct)+'</b></div></div>';
    }
    var tag=(open||self)?'button':'div';
    var attrs=open?' data-act="open-b" data-id="'+b.id+'"':(self?' data-act="tab" data-tab="me"':'');
    return '<'+tag+' class="person'+((open||self)?'':' static')+'" style="--i:'+i+'"'+attrs+'>'+head+body+'</'+tag+'>';
  }).join('');
}

/* ---------- Responsibilities ---------- */
function renderRoles(){
  var el=$('#rolesBody');
  if(!S.baristas.length){el.innerHTML=emptyTeam();return}
  var mb=me();
  el.innerHTML=respList().map(function(r,i){
    var m=skillMap(),as=S.assign[r.k]||{};
    var req=r.s.filter(function(k){return m[k]}).map(function(k){return esc(m[k].n)}).join(', ');
    var head='<h3>'+esc(r.n)+'</h3><div class="label">'+esc(r.c||'')+'</div><div class="small muted">Needs level '+r.m+'+ in: '+(req||'no skills chosen')+'</div>';
    if(S.admin){
      var rd=[],al=[];S.baristas.slice().sort(byName).forEach(function(b){var s=respStatus(r,b);if(s==='ready')rd.push(b);else if(s==='almost')al.push(b)});
      var opts=function(sel){return '<option value="">Unassigned</option>'+S.baristas.slice().sort(byName).map(function(b){var tag=respStatus(r,b)==='ready'?' (ready)':'';return '<option value="'+b.id+'"'+(sel===b.id?' selected':'')+'>'+esc(b.name)+tag+'</option>'}).join('')};
      return '<div class="card stack" style="--i:'+i+'">'+head
        +'<div class="row"><span class="small muted" style="width:54px">Ready</span>'+(rd.length?rd.map(function(b){return pill(b.name,'good')}).join(''):'<span class="small muted">No one yet</span>')+'</div>'
        +(al.length?'<div class="row"><span class="small muted" style="width:54px">Almost</span>'+al.map(function(b){return pill(b.name,'warn')}).join('')+'</div>':'')
        +'<div class="form"><label class="field"><span>Owner</span><select data-assign="'+esc(r.k)+'" data-f="ownerId">'+opts(as.ownerId)+'</select></label><label class="field"><span>Backup</span><select data-assign="'+esc(r.k)+'" data-f="backupId">'+opts(as.backupId)+'</select></label></div></div>';
    }
    var st=mb?respStatus(r,mb):'unknown';
    return '<div class="card stack" style="--i:'+i+'">'+head
      +'<div class="row"><span class="small muted" style="width:54px">Owner</span>'+(as.ownerId&&bget(as.ownerId)?pill(bname(as.ownerId),'acc'):'<span class="small muted">Not assigned</span>')+'</div>'
      +'<div class="row"><span class="small muted" style="width:54px">Backup</span>'+(as.backupId&&bget(as.backupId)?pill(bname(as.backupId),''):'<span class="small muted">Not assigned</span>')+'</div>'
      +(mb?'<div class="row"><span class="small muted" style="width:54px">You</span>'+(st==='ready'?pill('Ready for this','good'):st==='almost'?pill('One step away','warn'):st==='no'?pill('Keep building','') :pill('Not rated yet',''))+'</div>':'')+'</div>';
  }).join('');
}

/* ---------- coffee checks ---------- */
function fillSelect(sel,items,keep){
  var cur=keep!=null?keep:sel.value;
  sel.innerHTML=items.map(function(i){return '<option value="'+esc(i.v)+'">'+esc(i.t)+'</option>'}).join('');
  if(cur&&items.some(function(i){return i.v===cur}))sel.value=cur;
}
function recipeHint(){
  var el=$('#ckHint');if(!el)return;
  var rec=recipeByName($('#ckCoffee').value);
  if(!rec){el.textContent='';el.hidden=true;return}
  var dose=numOrNull($('#ckDose').value),yld=numOrNull($('#ckYield').value),time=numOrNull($('#ckTime').value),off=offRecipe(rec,dose,yld,time);
  var tg='Target: '+(rec.dose||'?')+' g in, '+(rec.yield||'?')+' g out'+(rec.time?', '+rec.time+' s':'');
  el.hidden=false;el.className='hint'+(off.length?' bad':'');
  el.textContent=off.length?tg+'. Off target: '+off.join(', ')+'. This will be flagged for follow-up.':tg+'.';
}
function renderChecks(){
  var who=$('#ckWho'),mine=!S.admin&&S.myBarista;
  var items=S.baristas.slice().sort(byName).map(function(b){return {v:b.id,t:b.name}});
  var last='';try{last=localStorage.getItem('crew.ckWho')||''}catch(e){}
  if(mine){fillSelect(who,items.filter(function(i){return i.v===S.myBarista}),S.myBarista)}
  else fillSelect(who,items.length?items:[{v:'',t:'Add a barista first'}],who.value||last);
  who.closest('.field').hidden=!!mine;
  var blocked=!S.admin&&!S.myBarista;
  $('#checkForm').hidden=blocked;$('#ckBlocked').innerHTML=blocked?notLinkedNote():'';
  $('#ckFormTitle').textContent=S.editing&&S.editing.coll==='checks'?'Edit coffee check':'Log a coffee check';
  $('#ckSubmit').textContent=S.editing&&S.editing.coll==='checks'?'Save changes':'Log check';
  $('#ckCancel').hidden=!(S.editing&&S.editing.coll==='checks');
  var names={};S.checks.forEach(function(c){if(c.coffee)names[c.coffee]=1});S.recipes.forEach(function(r){if(r.name)names[r.name]=1});
  $('#coffeeList').innerHTML=Object.keys(names).map(function(c){return '<option value="'+esc(c)+'">'}).join('');
  var vis=S.admin||!!S.myBarista;
  var scope=S.admin?S.checks:S.checks.filter(function(c){return c.baristaId===S.myBarista});
  /* summary */
  var from=daysAgo(29),sm=$('#ckSummary');
  var team=S.admin?S.baristas:S.baristas.filter(function(b){return b.id===S.myBarista});
  sm.innerHTML=team.length?team.slice().sort(byName).map(function(b){
    var st=checkStats(b.id,from);
    return '<div class="item"><div class="row between"><span class="t">'+esc(b.name)+'</span><span class="small mono muted">'+st.n+' logged · '+st.flags+' follow-up'+(st.flags===1?'':'s')+' · '+pct(st.pct)+' done</span></div><div class="bar"><i style="width:'+(st.pct==null?0:Math.round(st.pct*100))+'%"></i></div></div>';
  }).join(''):'<div class="item muted">Nothing to show yet.</div>';
  /* charts (everyone sees the team-wide coffee picture; barista names stay out of it) */
  var weeks=[],ws=weekStart(),i;
  for(i=7;i>=0;i--){var d=addDays(ws,-7*i);weeks.push({d:d,ok:0,flag:0})}
  S.checks.forEach(function(c){var w=weekStart(c.date);for(var k=0;k<weeks.length;k++){if(weeks[k].d===w){if(isFlag(c))weeks[k].flag++;else weeks[k].ok++}}});
  var any=weeks.some(function(w){return w.ok+w.flag>0});
  var by={};S.checks.filter(function(c){return c.date>=daysAgo(59)}).forEach(function(c){var n=(c.coffee||'Unnamed coffee').trim();var o=by[n]||(by[n]={name:n,n:0,flag:0});o.n++;if(isFlag(c))o.flag++});
  var worst=Object.keys(by).map(function(k){return by[k]}).filter(function(o){return o.flag>0}).sort(function(a,b){return b.flag-a.flag||b.n-a.n}).slice(0,6);
  $('#ckCharts').innerHTML=any?'<div class="grid g-2"><div class="card"><h3>Checks per week</h3><p class="small muted">Weeks start on Monday. Last 8 weeks.</p>'+weekBars(weeks)+'</div><div class="card"><h3>Coffees with most follow-ups</h3><p class="small muted">Last 60 days.</p>'+coffeeBars(worst)+'</div></div>':'';
  /* list */
  var list=scope.slice().sort(byRecent);
  if(S.ckFilter==='flag')list=list.filter(isFlag);
  var el=$('#ckList');
  el.innerHTML=list.length?list.slice(0,40).map(checkItem).join(''):'<div class="item muted">'+(S.ckFilter==='flag'?'No follow-ups. Everything logged looks fine.':'No checks logged yet. The first one will show here.')+'</div>';
  recipeHint();
}

/* ---------- ideas ---------- */
function renderIdeas(){
  var mine=!S.admin&&S.myBarista,blocked=!S.admin&&!S.myBarista;
  var items=S.baristas.slice().sort(byName).map(function(b){return {v:b.id,t:b.name}});
  var who=$('#idWho'),last='';try{last=localStorage.getItem('crew.idWho')||''}catch(e){}
  if(mine)fillSelect(who,items.filter(function(i){return i.v===S.myBarista}),S.myBarista);
  else fillSelect(who,items.length?items:[{v:'',t:'Add a barista first'}],who.value||last);
  who.closest('.field').hidden=!!mine;
  var area=$('#idArea');if(!area.options.length)fillSelect(area,AREAS.map(function(a){return {v:a,t:a}}));
  $('#ideaForm').hidden=blocked;$('#idBlocked').innerHTML=blocked?notLinkedNote():'';
  var ed=S.editing&&S.editing.coll==='ideas';
  $('#idFormTitle').textContent=ed?'Edit idea':'New idea';$('#idSubmit').textContent=ed?'Save changes':'Add idea';$('#idCancel').hidden=!ed;
  var el=$('#ideaList');
  var list=S.ideas.slice().sort(function(a,b){var pa=ideaPriority(a).r,pb=ideaPriority(b).r;if(a.status==='Rejected')pa+=10;if(b.status==='Rejected')pb+=10;return pa-pb||((b.createdAt||0)-(a.createdAt||0))});
  el.innerHTML=list.length?list.map(ideaItem).join(''):'<div class="empty"><h3>No ideas yet</h3><p>When someone spots something that slows the bar down or hurts the coffee, add it above. The best ideas rise to the top.</p></div>';
}

/* ---------- leadership ---------- */
function renderLead(){
  var r=$('#leadRoster');
  var cohort=S.baristas.filter(function(b){return b.inCohort}).sort(byName);
  var others=S.baristas.filter(function(b){return !b.inCohort}).sort(byName);
  var h='';
  if(!S.baristas.length){r.innerHTML=emptyTeam()}
  else{
    h+='<div class="card stack"><div class="row between"><h3>Group members</h3>'
      +(S.admin&&others.length?'<div class="row"><select id="cohortAdd" aria-label="Add to leadership group" style="width:180px"><option value="">Add someone…</option>'+others.map(function(b){return '<option value="'+b.id+'">'+esc(b.name)+'</option>'}).join('')+'</select><button class="btn sm" data-act="cohort-add">Add</button></div>':'')+'</div>';
    if(!cohort.length)h+='<p class="muted">No one is in the group yet. Pick three to five people you want to develop, ideally working the same location, so they see how the place really runs.</p>';
    else{
      h+='<div class="grid g-auto">'+cohort.map(function(b,i){
        var st=checkStats(b.id,daysAgo(29)),mi=S.ideas.filter(function(x){return x.byId===b.id}),ad=mi.filter(function(x){return x.status==='Adopted'}).length;
        var rd=S.admin?readiness(b):null,ls=S.admin?leadScore(b.id):null,ov=S.admin?overall(b):null;
        return '<'+(S.admin?'button data-act="open-b" data-id="'+b.id+'"':'div')+' class="person'+(S.admin?'':' static')+'" style="--i:'+i+'"><div class="stack" style="gap:4px"><h3>'+esc(b.name)+sampleTag(b)+'</h3><div class="small muted">'+(b.cohortFocus?'Focus: '+esc(b.cohortFocus):'No focus area set')+(b.mentor?' · Mentor: '+esc(b.mentor):'')+(b.location?' · '+esc(b.location):'')+'</div></div>'
          +'<div class="kv"><div><span class="label">Ideas</span><b>'+mi.length+'</b></div><div><span class="label">Adopted</span><b>'+ad+'</b></div>'+(S.admin?'<div><span class="label">Skills</span><b>'+n1(techAvg(b))+'</b></div><div><span class="label">Checks done</span><b>'+pct(st.pct)+'</b></div><div><span class="label">Leadership</span><b>'+n1(ls)+'</b></div><div><span class="label">Overall</span><b>'+n1(ov)+'</b></div>':'')+'</div>'
          +(S.admin?(rd?pill(rd.t,rd.k):'<span class="small muted">Rate leadership to see readiness</span>'):'')+'</'+(S.admin?'button':'div')+'>';
      }).join('')+'</div>';
      if(!S.admin)h+='<p class="small muted">Ratings and scorecards are visible to managers only.</p>';
    }
    r.innerHTML=h+'</div>';
  }
  $('#leadPlan').innerHTML=PLAN.map(function(p,i){
    var st=(S.plan['w'+(i+1)]||{}).status||'';
    return '<div class="item"><div class="row between"><span class="t"><span class="mono muted">Week '+(i+1)+'</span> · '+esc(p[0])+'</span>'+(S.admin?'<select data-plan="w'+(i+1)+'" style="width:140px" aria-label="Week '+(i+1)+' status"><option value=""'+(st===''?' selected':'')+'>Not started</option><option value="doing"'+(st==='doing'?' selected':'')+'>In progress</option><option value="done"'+(st==='done'?' selected':'')+'>Done</option></select>':pill(st==='done'?'Done':st==='doing'?'In progress':'Not started',st==='done'?'good':st==='doing'?'warn':''))+'</div><div class="small">'+esc(p[1])+'</div><div class="small muted">Brings back: '+esc(p[2])+'</div></div>';
  }).join('');
  var sc=$('#leadScoring');
  if(!S.admin){sc.hidden=true;return}
  sc.hidden=false;var c=cfg();
  sc.innerHTML='<h3>Scoring</h3><p class="muted small" style="margin:2px 0 10px">How leadership ratings and technical skills combine into the readiness label. These are starting points. Weight each area from 1 to 5.</p>'
   +'<div class="form"><label class="field"><span>Technical share of overall score (%)</span><input type="number" data-keep min="0" max="100" step="5" data-cfg="techShare" value="'+Math.round(c.techShare*100)+'"></label>'
   +'<label class="field"><span>Ready at overall score of</span><input type="number" data-keep min="0" max="3" step="0.1" data-cfg="ready" value="'+c.ready+'"></label>'
   +'<label class="field"><span>Developing at overall score of</span><input type="number" data-keep min="0" max="3" step="0.1" data-cfg="dev" value="'+c.dev+'"></label></div>'
   +'<div class="form" style="margin-top:12px">'+COMPS.map(function(k){return '<label class="field"><span>'+esc(k.n)+'</span><input type="number" data-keep min="1" max="5" step="1" data-cfg-w="'+k.k+'" value="'+weight(k.k)+'"></label>'}).join('')+'</div>';
}

/* ---------- access ---------- */
function renderAccess(){
  var el=$('#accessList'),inv=$('#inviteList'),md=$('#signupMode');
  if(md)md.value=S.signupMode;
  var bopts=function(sel){return '<option value="">No barista profile</option>'+S.baristas.slice().sort(byName).map(function(b){return '<option value="'+b.id+'"'+(sel===b.id?' selected':'')+'>'+esc(b.name)+'</option>'}).join('')};
  var ps=S.people.slice().sort(function(a,b){return (a.approved===b.approved?0:(a.approved?1:-1))||String(a.email).localeCompare(String(b.email))});
  el.innerHTML=ps.length?ps.map(function(p){
    var self=p.id===S.uid;
    return '<div class="item"><div class="row between"><span class="t">'+esc(p.email||'Unknown')+(self?' <span class="muted" style="font-weight:400">(you)</span>':'')+'</span>'+(p.approved?pill('Approved','good'):pill('Waiting','warn'))+'</div>'
      +'<div class="form"><label class="field"><span>Role</span><select data-person="'+p.id+'"'+(self?' disabled':'')+'><option value="barista"'+(p.role==='barista'?' selected':'')+'>Barista</option><option value="manager"'+(p.role==='manager'?' selected':'')+'>Manager</option></select></label>'
      +'<label class="field"><span>Linked barista profile</span><select data-person-b="'+p.id+'">'+bopts(p.barista_id)+'</select></label></div>'
      +(self?'':'<div><button class="btn'+(p.approved?' ghost':'')+' sm" data-act="person-approve" data-id="'+p.id+'" data-v="'+(p.approved?'0':'1')+'">'+(p.approved?'Remove access':'Approve')+'</button></div>')+'</div>';
  }).join(''):'<div class="item muted">No one has signed up yet.</div>';
  $('#invBarista').innerHTML=bopts('');
  var rows=S.invites.slice().sort(function(a,b){return (a.used_at?1:0)-(b.used_at?1:0)||String(b.created_at).localeCompare(String(a.created_at))});
  inv.innerHTML=rows.length?rows.map(function(i){
    return '<div class="item"><div class="row between"><span class="t">'+esc(i.email)+'</span>'+(i.used_at?pill('Used','good'):pill('Waiting','warn'))+'</div>'
     +'<div class="row"><span class="small muted">Role '+esc(i.role)+(i.barista_id?' · linked to '+esc(bname(i.barista_id)):'')+'</span>'+(i.used_at?'':'<span class="code mono">'+esc(i.code)+'</span>')+'</div>'
     +(i.used_at?'':'<div><button class="btn ghost sm" data-act="inv-del" data-email="'+esc(i.email)+'">Cancel invite</button></div>')+'</div>';
  }).join(''):'<div class="item muted">No invites yet.</div>';
  var li=S.lastInvite;
  $('#invResult').innerHTML=li?'<div class="card flat"><strong>Invite ready for '+esc(li.email)+'.</strong><p class="small">Send them this code. They create an account on the site with this email and the code. It works once.</p><div class="row"><span class="code mono big">'+esc(li.code)+'</span><button class="btn ghost sm" data-act="copy" data-v="'+esc(li.code)+'">Copy code</button></div></div>':'';
}

/* ---------- setup ---------- */
function rowIn(attrs,val,ph,w){return '<input type="text" data-keep '+attrs+' value="'+esc(val==null?'':val)+'" placeholder="'+esc(ph||'')+'"'+(w?' style="width:'+w+'"':'')+'>'}
function renderSetup(){
  var sk=skillsList(),rs=respList(),ob=onboardList(),h='';
  h+='<div class="card stack"><h3>Skills</h3><p class="small muted">The skills you rate each barista on. Group them however you like. Removing a skill hides it but does not delete old ratings.</p><div class="list">'
   +sk.map(function(s,i){return '<div class="item"><div class="form">'+'<label class="field"><span>Skill</span>'+rowIn('data-list="skills" data-i="'+i+'" data-f="n"',s.n)+'</label><label class="field"><span>Group</span>'+rowIn('data-list="skills" data-i="'+i+'" data-f="g"',s.g)+'</label></div><div class="row"><button class="btn ghost sm" data-act="list-move" data-list="skills" data-i="'+i+'" data-d="-1"'+(i===0?' disabled':'')+'>Up</button><button class="btn ghost sm" data-act="list-move" data-list="skills" data-i="'+i+'" data-d="1"'+(i===sk.length-1?' disabled':'')+'>Down</button><button class="btn danger sm" data-act="list-del" data-list="skills" data-i="'+i+'">'+(S.confirm==='skills/'+i?'Confirm remove':'Remove')+'</button></div></div>'}).join('')
   +'</div><div><button class="btn" data-act="list-add" data-list="skills">Add a skill</button></div></div>';
  h+='<div class="card stack"><h3>Responsibilities</h3><p class="small muted">A person is ready for a responsibility when they reach the minimum level in every skill you tick.</p><div class="list">'
   +rs.map(function(r,i){return '<div class="item"><div class="form"><label class="field"><span>Responsibility</span>'+rowIn('data-list="resp" data-i="'+i+'" data-f="n"',r.n)+'</label><label class="field"><span>Category</span>'+rowIn('data-list="resp" data-i="'+i+'" data-f="c"',r.c)+'</label><label class="field"><span>Minimum level</span><select data-list="resp" data-i="'+i+'" data-f="m">'+[1,2,3].map(function(v){return '<option'+(r.m===v?' selected':'')+' value="'+v+'">'+v+'</option>'}).join('')+'</select></label></div>'
     +'<div class="row">'+sk.map(function(s){var on=r.s.indexOf(s.k)>=0;return '<button type="button" class="chip" aria-pressed="'+on+'" data-act="resp-skill" data-i="'+i+'" data-k="'+esc(s.k)+'">'+esc(s.n)+'</button>'}).join('')+'</div>'
     +'<div class="row"><button class="btn danger sm" data-act="list-del" data-list="resp" data-i="'+i+'">'+(S.confirm==='resp/'+i?'Confirm remove':'Remove')+'</button></div></div>'}).join('')
   +'</div><div><button class="btn" data-act="list-add" data-list="resp">Add a responsibility</button></div></div>';
  h+='<div class="card stack"><h3>Coffee recipes</h3><p class="small muted">Targets for each coffee. When a check uses the coffee name and falls outside the tolerance, it is flagged for follow-up automatically.</p><div class="list">'
   +(S.recipes.length?S.recipes.slice().sort(byName).map(function(r){
     function n(f,l,ph){return '<label class="field"><span>'+l+'</span><input type="number" data-keep data-recipe="'+r.id+'" data-f="'+f+'" step="any" min="0" inputmode="decimal" value="'+esc(r[f]==null?'':r[f])+'" placeholder="'+(ph||'')+'"></label>'}
     return '<div class="item"><div class="form"><label class="field wide"><span>Coffee name</span>'+rowIn('data-recipe="'+r.id+'" data-f="name"',r.name)+'</label>'+n('dose','Dose in (g)')+n('yield','Yield out (g)')+n('time','Time (s)')+n('tolD','Dose tolerance ±','0.5')+n('tolY','Yield tolerance ±','2')+n('tolT','Time tolerance ±','3')+'</div><div><button class="btn danger sm" data-act="del" data-coll="recipes" data-id="'+r.id+'">'+(S.confirm==='recipes/'+r.id?'Confirm delete':'Delete')+'</button></div></div>'}).join(''):'<div class="item muted">No recipes yet.</div>')
   +'</div><div><button class="btn" data-act="recipe-add">Add a coffee</button></div></div>';
  h+='<div class="card stack"><h3>Onboarding checklist</h3><p class="small muted">Steps a new barista gets signed off on. Progress shows on their file.</p><div class="list">'
   +ob.map(function(o,i){return '<div class="item"><div class="row">'+rowIn('data-list="onboard" data-i="'+i+'" data-f="n"',o.n,'Step','min(100%,320px)')+'<button class="btn ghost sm" data-act="list-move" data-list="onboard" data-i="'+i+'" data-d="-1"'+(i===0?' disabled':'')+'>Up</button><button class="btn ghost sm" data-act="list-move" data-list="onboard" data-i="'+i+'" data-d="1"'+(i===ob.length-1?' disabled':'')+'>Down</button><button class="btn danger sm" data-act="list-del" data-list="onboard" data-i="'+i+'">'+(S.confirm==='onboard/'+i?'Confirm remove':'Remove')+'</button></div></div>'}).join('')
   +'</div><div><button class="btn" data-act="list-add" data-list="onboard">Add a step</button></div></div>';
  h+='<div class="card stack"><h3>Backup and export</h3><p class="small muted">Download everything in the database. The Excel file is for reading. The JSON file is a full backup that can be restored. A free Supabase project is paused after a week without activity. A weekly automatic ping keeps it awake.</p><div class="row"><button class="btn" data-act="export-xlsx"'+(S.exporting?' disabled':'')+'>'+(S.exporting?'Preparing…':'Download Excel')+'</button><button class="btn ghost" data-act="export-json"'+(S.exporting?' disabled':'')+'>Download JSON backup</button></div></div>';
  if(S.baristas.some(function(b){return b.sample}))h+='<div class="card flat row between"><span class="small">The sample team is still loaded.</span><button class="btn ghost sm" data-act="sample-clear">Remove sample data</button></div>';
  $('#setupBody').innerHTML=h;
}

/* ---------- barista file (managers) ---------- */
function renderDrawer(){
  var m=$('#drawerMount');
  if(!S.openId||!S.admin){m.innerHTML='';return}
  var b=bget(S.openId);
  if(!b){S.openId=null;m.innerHTML='';return}
  var a=document.activeElement;
  if(a&&m.contains(a)&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT'))return;
  var old=$('.drawer-body',m),sy=old?old.scrollTop:0,already=!!old;
  function f(label,field,type,wide){return '<label class="field'+(wide?' wide':'')+'"><span>'+label+'</span>'+(type==='ta'?'<textarea data-f="'+field+'" rows="2">'+esc(b[field]||'')+'</textarea>':type==='role'?'<select data-f="'+field+'">'+ROLES.map(function(r){return '<option'+((b.role||'Barista')===r?' selected':'')+'>'+r+'</option>'}).join('')+'</select>':'<input type="'+type+'" data-f="'+field+'" value="'+esc(b[field]||'')+'">')+'</label>'}
  var t=techAvg(b),st=checkStats(b.id,daysAgo(29)),login=S.people.filter(function(p){return p.barista_id===b.id})[0];
  var h='<div class="scrim" data-act="close-drawer"></div><aside class="drawer'+(already?' still':'')+'" role="dialog" aria-label="Barista details"><div class="drawer-head"><input type="text" data-f="name" value="'+esc(b.name||'')+'" aria-label="Name"><button class="btn ghost sm" data-act="close-drawer">Close</button></div><div class="drawer-body">';
  h+='<div class="stack"><div class="kv"><div><span class="label">Skill avg</span><b>'+n1(t)+'</b></div><div><span class="label">Experts</span><b>'+(ratedVals(b).length?expertCount(b):'—')+'</b></div><div><span class="label">Gaps</span><b>'+(ratedVals(b).length?gapCount(b):'—')+'</b></div><div><span class="label">Checks done</span><b>'+pct(st.pct)+'</b></div></div>'+strip(b)+'<p class="small muted">'+(login?'Signs in as '+esc(login.email)+'.':'No login is linked to this profile yet. Link one in the Access tab so they can see their own skills.')+'</p></div>';
  h+='<div><h3>Profile</h3><div class="form">'+f('Role','role','role')+f('Location','location','text')+f('Start date','startDate','date')+f('Availability','availability','text')+f('Next check-in','nextCheckin','date')+f('Strengths','strengths','ta',true)+f('Areas to grow','grow','ta',true)+f('Goals','goals','ta',true)+f('Notes (private to managers and this barista)','notes','ta',true)+'</div></div>';
  h+='<div><h3>Skills</h3><div class="legend" style="margin-bottom:8px"><span>0 Not trained</span><span>1 Learning</span><span>2 Independent</span><span>3 Can train others</span></div>';
  groupSkills().forEach(function(g){h+='<div class="label" style="margin:12px 0 2px">'+esc(g.g)+'</div>';g.items.forEach(function(s){h+='<div class="skillrow"><span>'+esc(s.n)+'</span>'+seg('skill',s.k,skillVal(b,s.k),false,s.n)+'</div>'})});
  h+='</div>';
  var ok=respList().filter(function(r){return respStatus(r,b)==='ready'}),al=respList().filter(function(r){return respStatus(r,b)==='almost'});
  h+='<div><h3>Can take on</h3><div class="row">'+(ok.length?ok.map(function(r){return pill(r.n,'good')}).join(''):'<span class="muted small">Nothing yet. Rate their skills above.</span>')+'</div>'+(al.length?'<div class="small muted" style="margin:8px 0 4px">One step away</div><div class="row">'+al.map(function(r){return pill(r.n,'warn')}).join('')+'</div>':'')+'</div>';
  h+='<div><h3>Progress</h3>'+progressBlock(b,460)+'</div>';
  var op=onboardProgress(b);
  h+='<div><h3>Onboarding <span class="small muted mono">'+op.done+' of '+op.total+'</span></h3><div class="bar" style="margin:6px 0 8px"><i style="width:'+(op.total?Math.round(op.done/op.total*100):0)+'%"></i></div>'+onboardList().map(function(i){var d=(b.onboarding||{})[i.k];return '<label class="row check"><input type="checkbox" data-onb="'+esc(i.k)+'"'+(d?' checked':'')+'> <span>'+esc(i.n)+(d?' <span class="muted small">· '+esc(fmtDay(d))+'</span>':'')+'</span></label>'}).join('')+'</div>';
  var cs=S.certs.filter(function(c){return c.baristaId===b.id}).sort(function(a,c){return String(a.expires||'9').localeCompare(String(c.expires||'9'))});
  h+='<div><h3>Certifications</h3><div class="list">'+(cs.length?cs.map(function(c){var i=certInfo(c);return '<div class="item"><div class="row between"><span class="t">'+esc(c.name)+'</span>'+pill(i.t,i.k)+'</div><div><button class="btn danger sm" data-act="del" data-coll="certs" data-id="'+c.id+'">'+(S.confirm==='certs/'+c.id?'Confirm delete':'Delete')+'</button></div></div>'}).join(''):'<div class="item muted">None recorded.</div>')+'</div>'
   +'<div class="form" style="margin-top:10px"><label class="field"><span>Name</span><input type="text" id="certName" placeholder="Food hygiene level 2"></label><label class="field"><span>Expires</span><input type="date" id="certExp"></label></div><div><button class="btn sm" data-act="cert-add">Add certification</button></div></div>';
  var os=S.oneonones.filter(function(o){return o.baristaId===b.id}).sort(function(a,c){return String(c.date).localeCompare(String(a.date))||(c.createdAt||0)-(a.createdAt||0)});
  h+='<div><h3>One-to-one notes</h3><div class="list">'+(os.length?os.map(function(o){return '<div class="item"><div class="row between"><span class="small mono muted">'+esc(o.date)+'</span><button class="btn danger sm" data-act="del" data-coll="oneonones" data-id="'+o.id+'">'+(S.confirm==='oneonones/'+o.id?'Confirm delete':'Delete')+'</button></div><div class="small pre">'+esc(o.text)+'</div></div>'}).join(''):'<div class="item muted">No notes yet. These are visible to managers only.</div>')+'</div>'
   +'<div class="form" style="margin-top:10px"><label class="field"><span>Date</span><input type="date" id="ooDate" value="'+today()+'"></label><label class="field wide"><span>What you talked about and agreed</span><textarea id="ooText" rows="3"></textarea></label></div><div><button class="btn sm" data-act="oo-add">Save note</button></div></div>';
  h+='<div><h3>Leadership group</h3><label class="row check" style="margin-bottom:10px"><input type="checkbox" data-f="inCohort"'+(b.inCohort?' checked':'')+'> <span>Member of the leadership group</span></label>';
  if(b.inCohort){
    h+='<div class="form"><label class="field"><span>Mentor</span><input type="text" data-f="mentor" value="'+esc(b.mentor||'')+'"></label><label class="field"><span>Focus area</span><select data-f="cohortFocus"><option value="">None</option>'+AREAS.map(function(x){return '<option'+(b.cohortFocus===x?' selected':'')+'>'+x+'</option>'}).join('')+'</select></label></div>';
    var sc=S.score[b.id]||{},rd=readiness(b);
    h+='<h3 style="margin-top:16px">Head barista scorecard</h3><div class="legend" style="margin-bottom:6px"><span>0 Not shown yet</span><span>1 Sometimes</span><span>2 Consistently</span><span>3 Clear strength others learn from</span></div>';
    COMPS.forEach(function(c){h+='<div class="skillrow"><span>'+esc(c.n)+'</span>'+seg('comp',c.k,typeof (sc.ratings||{})[c.k]==='number'?sc.ratings[c.k]:null,false,c.n)+'</div>'});
    h+='<div class="row" style="margin-top:12px">'+pill('Leadership '+n1(leadScore(b.id)),'')+pill('Skills '+n1(t),'')+pill('Overall '+n1(overall(b)),'acc')+(rd?pill(rd.t,rd.k):'')+'</div><p class="small muted" style="margin-top:8px">Rate with a mentor, and note a real example for each rating in the notes. Ready also requires a leadership score of at least 2.</p>';
  }
  h+='</div>';
  h+='<div><button class="btn danger" data-act="del-b" data-id="'+b.id+'">'+(S.confirm==='b/'+b.id?'Confirm: remove '+esc(b.name||'barista')+' and all their records':'Remove barista')+'</button></div>';
  h+='</div></aside>';
  m.innerHTML=h;
  var nb=$('.drawer-body',m);if(nb)nb.scrollTop=sy;
}

/* ---------- header, tabs, render loop ---------- */
function tabVisible(t){return t.need==='admin'?S.admin:t.need==='me'?(!S.admin&&!!S.myBarista):true}
function tabCounts(){
  var pend=S.people.filter(function(p){return !p.approved}).length;
  return {team:S.baristas.length,roles:respList().length,checks:S.checks.length,lead:S.baristas.filter(function(b){return b.inCohort}).length,ideas:S.ideas.length,access:S.admin&&pend?pend:null};
}
function buildNav(){
  $('#nav').innerHTML=TABS.map(function(t){return '<button data-act="tab" data-tab="'+t.id+'" data-label="'+esc(t.label)+'" aria-selected="'+(S.tab===t.id)+'"></button>'}).join('');
}
function renderHeader(){
  $('#who').innerHTML=S.db?(S.admin?pill('Manager view','acc'):pill('Team view',''))+' <button class="btn ghost sm" data-act="signout">Sign out</button>':'';
  var counts=S.db?tabCounts():{};
  TABS.forEach(function(t){
    var b=$('#nav [data-tab="'+t.id+'"]');if(!b)return;
    b.hidden=!tabVisible(t);
    var c=t.count?counts[t.count]:null;
    var html=esc(t.label)+(c!=null?'<span class="n">('+c+')</span>':'');
    if(b.innerHTML!==html)b.innerHTML=html;
  });
  var q=$('#queueBar');if(q){q.hidden=!S.queue.length;q.textContent=S.queue.length?(S.queue.length+(S.queue.length===1?' entry is':' entries are')+' saved on this phone and will upload when you are back online.'):''}
}
function renderAll(){
  renderHeader();
  var t=S.tab;
  if(!TABS.some(function(x){return x.id===t&&tabVisible(x)})){S.tab=t='overview'}
  if(t==='overview')renderOverview();else if(t==='me')renderMe();else if(t==='team')renderTeam();else if(t==='roles')renderRoles();else if(t==='checks')renderChecks();else if(t==='lead')renderLead();else if(t==='ideas')renderIdeas();else if(t==='access')renderAccess();else if(t==='setup')renderSetup();
  $$('#nav button').forEach(function(b){b.setAttribute('aria-selected',b.dataset.tab===S.tab?'true':'false')});
  $$('section.tab').forEach(function(s){s.hidden=s.id!=='tab-'+S.tab});
  renderDrawer();
  if(S.fresh){S.fresh=false;var mn=$('main');mn.classList.add('fresh');setTimeout(function(){mn.classList.remove('fresh')},1400);countUp()}
}
function countUp(){
  if(REDUCE)return;
  $$('.stat b[data-n]').forEach(function(el){
    var to=parseFloat(el.dataset.n);if(isNaN(to)||to<2)return;
    var t0=performance.now();(function step(t){var k=Math.min(1,(t-t0)/600);el.textContent=Math.round(to*(1-Math.pow(1-k,3)));if(k<1)requestAnimationFrame(step);else el.textContent=el.dataset.n})(t0);
  });
}
var raf=0;
function schedule(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;
  var a=document.activeElement,tabEl=$('#tab-'+S.tab);
  if(a&&tabEl&&tabEl.contains(a)&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT')&&(a.hasAttribute('data-keep')||a.tagName==='TEXTAREA'||a.type==='date')){renderHeader();renderDrawer();return}
  renderAll()})}
function setTab(t){
  S.tab=t;S.confirm=null;
  if(t==='access'&&S.admin)loadPeople();
  renderAll();window.scrollTo(0,0);
}

/* ---------- writes ---------- */
function upsertDoc(path,data){
  return queue(path,function(){var ref=db.doc(path);return ref.update(data).catch(function(e){if(e&&e.code==='invalid_argument'){return ref.set(data)}throw e})});
}
function addBarista(name){
  var id=newId();
  return db.doc('baristas/'+id).set({name:name,role:'Barista',createdAt:Date.now()}).then(function(){S.openId=id;S.baristasRaw.push({id:id,name:name,role:'Barista',createdAt:Date.now()});rebuild();renderAll()}).catch(fail);
}
function setField(id,field,value){
  var d={};d[field]=value;
  if(PRIVATE.indexOf(field)>=0){
    S.staff[id]=Object.assign({},S.staff[id]||{},d);rebuild();
    return upsertDoc('staff/'+id,d);
  }
  return queue('baristas/'+id,function(){return db.doc('baristas/'+id).update(d)});
}
function rate(kind,key,v){
  var id=S.openId;if(!id||!S.admin)return;
  var b=bget(id);if(!b)return;
  if(kind==='skill'){
    var cur=skillVal(b,key),nv=(cur===v)?null:v,sk={};sk[key]=nv;
    var full=Object.assign({},b.skills||{});if(nv==null)delete full[key];else full[key]=nv;
    S.staff[id]=Object.assign({},S.staff[id]||{},{skills:full});rebuild();renderDrawer();
    upsertDoc('staff/'+id,{skills:sk}).then(function(){
      var wk=weekStart(),snap={};Object.keys(full).forEach(function(k){if(typeof full[k]==='number')snap[k]=full[k]});
      var body={baristaId:id,date:wk,skills:snap};if(b.sample)body.sample=true;
      return db.doc('history/'+id+'_'+wk).set(body);
    }).catch(fail);
  }else{
    var sc=S.score[id],cur2=sc&&sc.ratings?sc.ratings[key]:null,nv2=(cur2===v)?null:v,rr={};rr[key]=nv2;
    var path='scorecards/'+id;
    if(sc){queue(path,function(){return db.doc(path).update({ratings:rr,date:today()})})}
    else{var body2={ratings:rr,date:today()};if(b.sample)body2.sample=true;queue(path,function(){return db.doc(path).set(body2)})}
  }
}
function delDoc(path){return db.doc(path).delete().catch(fail)}

/* ---------- offline queue ---------- */
var QKEY='crew.queue.v1';
function saveQueue(){try{localStorage.setItem(QKEY,JSON.stringify(S.queue))}catch(e){}}
function loadQueue(){try{S.queue=JSON.parse(localStorage.getItem(QKEY)||'[]')||[]}catch(e){S.queue=[]}}
function addEntry(coll,doc){
  var id=newId();
  return db.doc(coll+'/'+id).set(doc).then(function(){return {ok:true}},function(e){
    if(e&&e.code==='unavailable'){S.queue.push({coll:coll,id:id,doc:doc});saveQueue();renderHeader();return {ok:true,queued:true}}
    throw e;
  });
}
function flushQueue(){
  if(flushing||!db||!S.queue.length)return;
  flushing=true;
  (function next(){
    var q=S.queue[0];
    if(!q){flushing=false;renderHeader();return}
    db.doc(q.coll+'/'+q.id).set(q.doc).then(function(){S.queue.shift();saveQueue();renderHeader();toast('Saved entry uploaded');next()},function(e){
      if(e&&e.code==='invalid_argument'){S.queue.shift();saveQueue();renderHeader();toast('One saved entry was refused by the database and was dropped.');next()}
      else{flushing=false}
    });
  })();
}

/* ---------- entries: coffee checks and ideas ---------- */
function resetCheckForm(){
  ['#ckCoffee','#ckDose','#ckYield','#ckTime','#ckTaste','#ckFix'].forEach(function(s){$(s).value=''});
  $('#ckRatio').textContent='—';$('#ckDate').value=today();S.yn={checked:null,recipe:null,brew:null};syncYn();
  if(S.editing&&S.editing.coll==='checks')S.editing=null;recipeHint();
}
function resetIdeaForm(){$('#idProblem').value='';$('#idChange').value='';if(S.editing&&S.editing.coll==='ideas')S.editing=null}
function saveCheck(){
  var msg=$('#ckMsg'),who=S.admin?$('#ckWho').value:S.myBarista;
  if(!who){msg.textContent=S.admin?'Add a barista first.':'Your account is not linked to a barista profile yet.';return}
  if(S.yn.checked==null||S.yn.recipe==null||S.yn.brew==null){msg.textContent='Answer all three questions.';return}
  var dose=numOrNull($('#ckDose').value),yld=numOrNull($('#ckYield').value),time=numOrNull($('#ckTime').value),coffee=$('#ckCoffee').value.trim();
  var off=offRecipe(recipeByName(coffee),dose,yld,time);
  var doc={date:$('#ckDate').value||today(),shift:$('#ckShift').value,baristaId:who,coffee:coffee,checked:S.yn.checked,recipeProblem:S.yn.recipe,brewingWell:S.yn.brew,dose:dose,yield:yld,time:time,taste:$('#ckTaste').value.trim(),fix:$('#ckFix').value.trim(),off:off};
  var flag=isFlag(doc);
  if(S.editing&&S.editing.coll==='checks'){
    var id=S.editing.id,patch=Object.assign({},doc);if(!S.admin)delete patch.baristaId;
    db.doc('checks/'+id).update(patch).then(function(){resetCheckForm();msg.textContent='Changes saved.';toast('Check updated')}).catch(fail);
    return;
  }
  doc.createdAt=Date.now();
  try{localStorage.setItem('crew.ckWho',who)}catch(e){}
  addEntry('checks',doc).then(function(r){
    resetCheckForm();
    msg.textContent=r.queued?'Saved on this phone. It uploads when you are online.':(flag?'Logged and flagged for follow-up.':'Logged. All good.');
    toast(r.queued?'Saved offline':(flag?'Check logged and flagged':'Check logged'));
  }).catch(fail);
}
function saveIdea(){
  var m=$('#idMsg'),by=S.admin?$('#idWho').value:S.myBarista,p=$('#idProblem').value.trim(),c=$('#idChange').value.trim();
  if(!by){m.textContent=S.admin?'Add a barista first.':'Your account is not linked to a barista profile yet.';return}
  if(!p||!c){m.textContent='Describe the problem and the change.';return}
  var core={area:$('#idArea').value,problem:p,change:c,impact:$('#idImpact').value,effort:$('#idEffort').value};
  if(S.editing&&S.editing.coll==='ideas'){
    var patch=Object.assign({},core);if(S.admin)patch.byId=by;
    db.doc('ideas/'+S.editing.id).update(patch).then(function(){resetIdeaForm();m.textContent='';toast('Idea updated');renderAll()}).catch(fail);
    return;
  }
  var doc=Object.assign({date:today(),byId:by,status:'Idea',owner:'',result:'',createdAt:Date.now()},core);
  try{localStorage.setItem('crew.idWho',by)}catch(e){}
  addEntry('ideas',doc).then(function(r){resetIdeaForm();m.textContent='';toast(r.queued?'Saved offline':'Idea added')}).catch(fail);
}
function startEdit(coll,id){
  var list=coll==='checks'?S.checks:S.ideas,e=null;list.forEach(function(x){if(x.id===id)e=x});
  if(!e)return;
  S.editing={coll:coll,id:id};
  if(coll==='checks'){
    S.tab='checks';
    renderAll();
    $('#ckDate').value=e.date||today();$('#ckShift').value=e.shift||'Opening';if(S.admin)$('#ckWho').value=e.baristaId;
    $('#ckCoffee').value=e.coffee||'';$('#ckDose').value=e.dose==null?'':e.dose;$('#ckYield').value=e.yield==null?'':e.yield;$('#ckTime').value=e.time==null?'':e.time;
    $('#ckTaste').value=e.taste||'';$('#ckFix').value=e.fix||'';
    S.yn={checked:!!e.checked,recipe:!!e.recipeProblem,brew:e.brewingWell!==false};syncYn();
    $('#ckRatio').textContent=ratio(e.dose,e.yield)||'—';recipeHint();
    $('#checkForm').scrollIntoView({behavior:REDUCE?'auto':'smooth',block:'start'});
  }else{
    S.tab='ideas';renderAll();
    if(S.admin)$('#idWho').value=e.byId;
    $('#idArea').value=e.area||AREAS[0];$('#idImpact').value=e.impact||'Medium';$('#idEffort').value=e.effort||'Low';$('#idProblem').value=e.problem||'';$('#idChange').value=e.change||'';
    $('#ideaForm').scrollIntoView({behavior:REDUCE?'auto':'smooth',block:'start'});
  }
}

/* ---------- editable lists in Setup ---------- */
function getList(name){var src=name==='skills'?skillsList():name==='resp'?respList():onboardList();return JSON.parse(JSON.stringify(src))}
function saveList(name,list){
  S.settings[name]={list:list};
  schedule();
  return queue('settings/'+name,function(){return db.doc('settings/'+name).set({list:list})});
}

/* ---------- sample data ---------- */
var SAMPLE=[
 {n:'Maya',r:'Senior barista',v:[3,3,2,3,3,3,3,2,3,3,2,2,3,2],c:true,f:'Workflow & bar layout',m:'Head barista'},
 {n:'Dario',r:'Barista',v:[2,3,2,1,2,2,3,2,2,1,1,0,2,0]},
 {n:'Priya',r:'Barista',v:[3,2,3,2,2,3,2,1,3,2,2,3,2,1],c:true,f:'Ordering & inventory',m:'Head barista'},
 {n:'Tom',r:'Trainee',v:[1,1,2,1,1,2,2,1,0,0,0,0,1,0]}
];
function loadSample(){
  toast('Loading sample team…');
  var ids=[],chain=Promise.resolve(),keys=DEF_SKILLS.map(function(s){return s.k});
  SAMPLE.forEach(function(p,i){chain=chain.then(function(){
    var id=newId();ids[i]=id;
    var skills={};keys.forEach(function(k,j){skills[k]=p.v[j]});
    return db.doc('baristas/'+id).set({name:p.n,role:p.r,inCohort:!!p.c,cohortFocus:p.f||'',mentor:p.m||'',location:'Main shop',createdAt:Date.now(),sample:true})
     .then(function(){return db.doc('staff/'+id).set({skills:skills,sample:true})})
     .then(function(){
       var ws=weekStart(),jobs=Promise.resolve();
       [[4,2],[2,1],[0,0]].forEach(function(st){jobs=jobs.then(function(){
         var sn={};keys.forEach(function(k,j){sn[k]=Math.max(0,p.v[j]-st[1])});var d=addDays(ws,-7*st[0]);
         return db.doc('history/'+id+'_'+d).set({baristaId:id,date:d,skills:sn,sample:true});
       })});
       return jobs;
     });
  })});
  var checks=[[0,0,'House espresso',1,0,1,18,36,27,'Balanced, sweet',''],[1,0,'House espresso',1,1,0,18,36,19,'Sour and thin, ran fast','Ground finer by 2 steps, re-pulled'],[2,1,'Single origin',1,0,1,18,40,28,'Fruity, clean',''],[3,1,'House espresso',0,0,1,0,0,0,'','Forgot, will check at close'],[0,2,'Decaf',1,0,1,17,34,26,'Fine',''],[1,5,'House espresso',1,0,1,18,36,26,'Good',''],[2,8,'House espresso',1,1,1,18,36,30,'Bitter','Coarser grind']];
  checks.forEach(function(c,i){chain=chain.then(function(){return db.doc('checks/'+newId()).set({date:daysAgo(c[1]),shift:'Opening',baristaId:ids[c[0]],coffee:c[2],checked:!!c[3],recipeProblem:!!c[4],brewingWell:!!c[5],dose:c[6]||null,yield:c[7]||null,time:c[8]||null,taste:c[9],fix:c[10],off:[],createdAt:Date.now()+i,sample:true})})});
  chain=chain.then(function(){return db.doc('recipes/'+newId()).set({name:'House espresso',dose:18,yield:36,time:27,tolD:0.5,tolY:2,tolT:3,sample:true})});
  chain=chain.then(function(){return db.doc('ideas/'+newId()).set({date:daysAgo(2),byId:ids[0],area:'Workflow & bar layout',problem:'Milk fridge is far from the machine, six steps per latte in the rush',change:'Move the fridge next to the steam wand and mark a syrup station',impact:'High',effort:'Low',status:'Pilot',owner:'Head barista',result:'',createdAt:Date.now(),sample:true})});
  chain=chain.then(function(){return db.doc('ideas/'+newId()).set({date:daysAgo(4),byId:ids[2],area:'Ordering & inventory',problem:'We run out of oat milk on weekends',change:'Order on Thursday with a par level on the shelf',impact:'Medium',effort:'Low',status:'Idea',owner:'',result:'',createdAt:Date.now()+1,sample:true})});
  [[0,[3,3,2,3,3,3,2,3,2,3]],[2,[2,2,3,2,1,3,2,2,3,2]]].forEach(function(s){chain=chain.then(function(){var r={};COMPS.forEach(function(c,j){r[c.k]=s[1][j]});return db.doc('scorecards/'+ids[s[0]]).set({ratings:r,date:today(),sample:true})})});
  chain.then(function(){toast('Sample team loaded. Remove it any time from the Today tab.')}).catch(fail);
}
function clearSample(){
  var jobs=[],sids={};
  S.baristas.filter(function(b){return b.sample}).forEach(function(b){sids[b.id]=1;jobs.push('baristas/'+b.id,'staff/'+b.id);if(S.score[b.id])jobs.push('scorecards/'+b.id)});
  S.history.filter(function(h){return h.sample||sids[h.baristaId]}).forEach(function(h){jobs.push('history/'+h.id)});
  S.certs.filter(function(h){return sids[h.baristaId]}).forEach(function(h){jobs.push('certs/'+h.id)});
  S.oneonones.filter(function(h){return sids[h.baristaId]}).forEach(function(h){jobs.push('oneonones/'+h.id)});
  S.checks.filter(function(c){return c.sample}).forEach(function(c){jobs.push('checks/'+c.id)});
  S.ideas.filter(function(c){return c.sample}).forEach(function(c){jobs.push('ideas/'+c.id)});
  S.recipes.filter(function(c){return c.sample}).forEach(function(c){jobs.push('recipes/'+c.id)});
  var chain=Promise.resolve();
  jobs.forEach(function(p){chain=chain.then(function(){return db.doc(p).delete()})});
  chain.then(function(){toast('Sample data removed.')}).catch(fail);
}

/* ---------- export and backup ---------- */
function fetchAllDocs(){
  var out=[];
  return (function page(from){
    return sb.from('docs').select('collection,id,data,updated_at,created_at').order('collection').order('id').range(from,from+999).then(function(r){
      if(r.error)throw r.error;
      out=out.concat(r.data||[]);
      if((r.data||[]).length===1000)return page(from+1000);
      return out;
    });
  })(0);
}
function download(name,blob){
  var a=document.createElement('a'),u=URL.createObjectURL(blob);a.href=u;a.download=name;document.body.appendChild(a);a.click();
  setTimeout(function(){URL.revokeObjectURL(u);a.remove()},4000);
}
function loadSheetJs(){
  if(window.XLSX)return Promise.resolve();
  return new Promise(function(res,rej){var s=document.createElement('script');s.src='https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js';s.onload=res;s.onerror=function(){rej(new Error('Could not load the Excel library. Check your connection.'))};document.head.appendChild(s)});
}
function exportData(kind){
  if(S.exporting)return;
  S.exporting=true;renderSetup();
  fetchAllDocs().then(function(docs){
    var stamp=today();
    if(kind==='json'){
      download('crew-book-backup-'+stamp+'.json',new Blob([JSON.stringify({format:'crewbook-backup',version:2,exported:new Date().toISOString(),docs:docs},null,1)],{type:'application/json'}));
      toast('Backup downloaded ('+docs.length+' records)');return;
    }
    return loadSheetJs().then(function(){
      var by={};docs.forEach(function(d){(by[d.collection]=by[d.collection]||[]).push(Object.assign({id:d.id},d.data))});
      var staff={};(by.staff||[]).forEach(function(s){staff[s.id]=s});
      var bn={};(by.baristas||[]).forEach(function(b){bn[b.id]=b.name});
      var nm=function(id){return bn[id]||'Former barista'};
      var sk=skillsList(),wb=XLSX.utils.book_new();
      function add(name,rows){XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{Note:'No records'}]),name)}
      add('Baristas',(by.baristas||[]).sort(byName).map(function(b){var s=staff[b.id]||{},o={Name:b.name,Role:b.role,Location:b.location||'',Start:b.startDate||'','Next check-in':s.nextCheckin||'','Leadership group':b.inCohort?'Yes':'',Strengths:s.strengths||'','Areas to grow':s.grow||'',Goals:s.goals||'',Notes:s.notes||''};sk.forEach(function(k){var v=s.skills&&s.skills[k.k];o[k.n]=typeof v==='number'?v:''});return o}));
      add('Coffee checks',(by.checks||[]).sort(function(a,b){return String(b.date).localeCompare(String(a.date))}).map(function(c){return {Date:c.date,Shift:c.shift,Barista:nm(c.baristaId),Coffee:c.coffee,Checked:c.checked?'Yes':'No','Recipe problem':c.recipeProblem?'Yes':'No','Brewing well':c.brewingWell===false?'No':'Yes','Dose g':c.dose,'Yield g':c.yield,'Time s':c.time,'Off recipe':(c.off||[]).join(', '),Taste:c.taste||'',Fix:c.fix||''}}));
      add('Ideas',(by.ideas||[]).map(function(i){return {Date:i.date,'Raised by':nm(i.byId),Area:i.area,Problem:i.problem,Change:i.change,Impact:i.impact,Effort:i.effort,Status:i.status,Owner:i.owner||'',Result:i.result||''}}));
      add('Skill history',(by.history||[]).sort(function(a,b){return String(a.date).localeCompare(String(b.date))}).map(function(h){var o={Week:h.date,Barista:nm(h.baristaId),Average:avgSkills(h.skills)==null?'':Math.round(avgSkills(h.skills)*100)/100};sk.forEach(function(k){o[k.n]=h.skills&&typeof h.skills[k.k]==='number'?h.skills[k.k]:''});return o}));
      add('Certifications',(by.certs||[]).map(function(c){return {Barista:nm(c.baristaId),Certification:c.name,Expires:c.expires||''}}));
      add('One-to-ones',(by.oneonones||[]).sort(function(a,b){return String(b.date).localeCompare(String(a.date))}).map(function(o){return {Date:o.date,Barista:nm(o.baristaId),Notes:o.text}}));
      add('Recipes',(by.recipes||[]).map(function(r){return {Coffee:r.name,'Dose g':r.dose,'Yield g':r.yield,'Time s':r.time}}));
      XLSX.writeFile(wb,'crew-book-'+stamp+'.xlsx');
      toast('Excel file downloaded');
    });
  }).catch(function(e){toast((e&&e.message)||'Export failed. Try again.')}).then(function(){S.exporting=false;if(S.tab==='setup')renderSetup()});
}

/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');if(!t)return;
  var act=t.dataset.act,i;
  if(act==='tab'){setTab(t.dataset.tab)}
  else if(act==='open-b'){S.openId=t.dataset.id;S.confirm=null;renderDrawer()}
  else if(act==='close-drawer'){S.openId=null;S.confirm=null;renderDrawer()}
  else if(act==='rate'){rate(t.dataset.kind,t.dataset.key,parseInt(t.dataset.v,10))}
  else if(act==='yn'){S.yn[t.dataset.q]=t.dataset.v==='1';syncYn()}
  else if(act==='ckfilter'){S.ckFilter=t.dataset.v;$$('[data-act=ckfilter]').forEach(function(c){c.setAttribute('aria-pressed',c.dataset.v===S.ckFilter?'true':'false')});renderChecks()}
  else if(act==='signout'){sb.auth.signOut().then(function(){location.reload()},function(){location.reload()})}
  else if(act==='auth-mode'){showAuth(t.dataset.mode)}
  else if(act==='auth-refresh'){loadProfile()}
  else if(act==='person-approve'){sb.from('profiles').update({approved:t.dataset.v==='1'}).eq('id',t.dataset.id).then(function(r){if(r.error)toast('Could not update that person.');else{toast(t.dataset.v==='1'?'Approved':'Access removed');loadPeople()}})}
  else if(act==='sample-load'){loadSample()}
  else if(act==='sample-clear'){clearSample()}
  else if(act==='goto-add'){setTab('team');setTimeout(function(){var x=$('#addName');if(x)x.focus()},0)}
  else if(act==='cohort-add'){var sel=$('#cohortAdd');if(sel&&sel.value)setField(sel.value,'inCohort',true).catch(fail)}
  else if(act==='del'){var key=t.dataset.coll+'/'+t.dataset.id;if(S.confirm===key){S.confirm=null;if(S.editing&&S.editing.id===t.dataset.id)S.editing=null;delDoc(key).then(function(){kickLocal(t.dataset.coll,t.dataset.id)})}else{S.confirm=key;S.drawerForce=true;renderAll()}}
  else if(act==='del-b'){var k='b/'+t.dataset.id;if(S.confirm===k){S.confirm=null;var id=t.dataset.id,jobs=['baristas/'+id,'staff/'+id,'scorecards/'+id];
      S.history.filter(function(h){return h.baristaId===id}).forEach(function(h){jobs.push('history/'+h.id)});
      S.certs.filter(function(h){return h.baristaId===id}).forEach(function(h){jobs.push('certs/'+h.id)});
      S.oneonones.filter(function(h){return h.baristaId===id}).forEach(function(h){jobs.push('oneonones/'+h.id)});
      S.openId=null;var ch=Promise.resolve();jobs.forEach(function(p){ch=ch.then(function(){return db.doc(p).delete()})});ch.catch(fail)}else{S.confirm=k;S.drawerForce=true;var ae=document.activeElement;if(ae&&ae.blur)ae.blur();renderDrawer()}}
  else if(act==='edit-entry'){startEdit(t.dataset.coll,t.dataset.id)}
  else if(act==='cancel-edit'){if(S.editing&&S.editing.coll==='checks')resetCheckForm();else resetIdeaForm();S.editing=null;renderAll()}
  else if(act==='cert-add'){
    var cn=$('#certName').value.trim();if(!cn||!S.openId){toast('Enter the certification name.');return}
    var cb=bget(S.openId),cd={baristaId:S.openId,name:cn,expires:$('#certExp').value||null,createdAt:Date.now()};if(cb&&cb.sample)cd.sample=true;
    db.doc('certs/'+newId()).set(cd).then(function(){$('#certName').value='';$('#certExp').value='';toast('Certification added')}).catch(fail)}
  else if(act==='oo-add'){
    var tx=$('#ooText').value.trim();if(!tx||!S.openId){toast('Write something first.');return}
    db.doc('oneonones/'+newId()).set({baristaId:S.openId,date:$('#ooDate').value||today(),text:tx,createdAt:Date.now()}).then(function(){$('#ooText').value='';toast('Note saved')}).catch(fail)}
  else if(act==='list-add'){
    var ln=t.dataset.list,L=getList(ln),k2=(ln==='skills'?'s':ln==='resp'?'r':'o')+newId().replace(/-/g,'').slice(0,6);
    if(ln==='skills')L.push({k:k2,n:'New skill',g:(L[L.length-1]||{}).g||'Other'});
    else if(ln==='resp')L.push({k:k2,n:'New responsibility',c:'Other',s:[],m:2});
    else L.push({k:k2,n:'New step'});
    saveList(ln,L)}
  else if(act==='list-del'){
    var kk=t.dataset.list+'/'+t.dataset.i;
    if(S.confirm===kk){S.confirm=null;var L2=getList(t.dataset.list);L2.splice(parseInt(t.dataset.i,10),1);saveList(t.dataset.list,L2)}else{S.confirm=kk;renderSetup()}}
  else if(act==='list-move'){
    var L3=getList(t.dataset.list),ix=parseInt(t.dataset.i,10),dx=parseInt(t.dataset.d,10),to=ix+dx;
    if(to>=0&&to<L3.length){var tmp=L3[ix];L3[ix]=L3[to];L3[to]=tmp;saveList(t.dataset.list,L3)}}
  else if(act==='resp-skill'){
    var L4=getList('resp'),r=L4[parseInt(t.dataset.i,10)];if(!r)return;
    var p=r.s.indexOf(t.dataset.k);if(p>=0)r.s.splice(p,1);else r.s.push(t.dataset.k);saveList('resp',L4)}
  else if(act==='recipe-add'){db.doc('recipes/'+newId()).set({name:'New coffee',dose:18,yield:36,time:27}).catch(fail)}
  else if(act==='export-xlsx'){exportData('xlsx')}
  else if(act==='export-json'){exportData('json')}
  else if(act==='inv-del'){sb.from('invites').delete().eq('email',t.dataset.email).then(function(){loadPeople()})}
  else if(act==='copy'){var v=t.dataset.v;(navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).then(function(){toast('Copied')},function(){toast('Select the code and copy it by hand.')})}
});
function kickLocal(coll,id){
  var map={checks:'checks',ideas:'ideas',recipes:'recipes',certs:'certs',oneonones:'oneonones'};
  if(map[coll]){S[map[coll]]=S[map[coll]].filter(function(x){return x.id!==id});schedule()}
}
document.addEventListener('change',function(e){
  var t=e.target;if(!db)return;
  if(t.dataset.person){sb.from('profiles').update({role:t.value}).eq('id',t.dataset.person).then(function(r){if(r.error)toast('Could not change that role.');else{toast('Role updated');loadPeople()}});return}
  if(t.dataset.personB!==undefined){sb.from('profiles').update({barista_id:t.value||null}).eq('id',t.dataset.personB).then(function(r){if(r.error)toast('Could not link that profile.');else{toast(t.value?'Login linked':'Link removed');loadPeople()}});return}
  if(t.id==='signupMode'){sb.from('app_settings').upsert({key:'signup_mode',value:t.value}).then(function(r){if(r.error)toast('Could not change that setting.');else{S.signupMode=t.value;toast(t.value==='open'?'Anyone can ask for access. You approve them.':'Sign-ups need an invite code.')}});return}
  if(t.dataset.onb&&t.closest('.drawer')){var o={};o[t.dataset.onb]=t.checked?today():null;var id0=S.openId;S.staff[id0]=Object.assign({},S.staff[id0]||{},{onboarding:Object.assign({},(S.staff[id0]||{}).onboarding||{},o)});rebuild();upsertDoc('staff/'+id0,{onboarding:o}).catch(fail);return}
  if(t.dataset.f&&t.closest('.drawer')){
    var id=S.openId;if(!id)return;
    var v=t.type==='checkbox'?t.checked:t.value;
    if(t.dataset.f==='name'&&!String(v).trim()){toast('A name is needed.');S.drawerForce=true;renderDrawer();return}
    setField(id,t.dataset.f,v).catch(fail);return;
  }
  if(t.dataset.list){
    var ln=t.dataset.list,L=getList(ln),it=L[parseInt(t.dataset.i,10)];if(!it)return;
    it[t.dataset.f]=t.dataset.f==='m'?parseInt(t.value,10):t.value.trim();
    if(t.dataset.f==='n'&&!it.n)it.n='Untitled';
    saveList(ln,L);return;
  }
  if(t.dataset.recipe){var rd={};var f=t.dataset.f;rd[f]=f==='name'?t.value.trim():numOrNull(t.value);upsertDoc('recipes/'+t.dataset.recipe,rd).catch(fail);return}
  if(t.dataset.assign){var oo={};oo[t.dataset.f]=t.value||null;upsertDoc('assign/'+t.dataset.assign,oo).catch(fail);return}
  if(t.dataset.idea){var d={};d[t.dataset.f]=t.value;queue('ideas/'+t.dataset.idea,function(){return db.doc('ideas/'+t.dataset.idea).update(d)});return}
  if(t.dataset.plan){upsertDoc('plan/'+t.dataset.plan,{status:t.value}).catch(fail);return}
  if(t.dataset.cfg){var n=parseFloat(t.value);if(isNaN(n))return;if(t.dataset.cfg==='techShare')n=Math.max(0,Math.min(100,n))/100;var x={};x[t.dataset.cfg]=n;upsertDoc('settings/config',x).catch(fail);return}
  if(t.dataset.cfgW){var w=parseFloat(t.value);if(isNaN(w))return;var ws={};ws[t.dataset.cfgW]=Math.max(1,Math.min(5,w));upsertDoc('settings/config',{weights:ws}).catch(fail);return}
  if(t.id==='ckWho'){try{localStorage.setItem('crew.ckWho',t.value)}catch(x2){}}
  if(t.id==='idWho'){try{localStorage.setItem('crew.idWho',t.value)}catch(x3){}}
});
document.addEventListener('input',function(e){
  var id=e.target.id;
  if(id==='ckDose'||id==='ckYield'||id==='ckTime'||id==='ckCoffee'){$('#ckRatio').textContent=ratio($('#ckDose').value,$('#ckYield').value)||'—';recipeHint()}
});
document.addEventListener('submit',function(e){
  e.preventDefault();var f=e.target;if(f.id==='authForm'){doAuth();return}if(!db)return;
  if(f.id==='addForm'){var i=$('#addName'),n=i.value.trim();if(!n){i.focus();return}i.value='';addBarista(n)}
  else if(f.id==='checkForm')saveCheck();
  else if(f.id==='ideaForm')saveIdea();
  else if(f.id==='inviteForm'){
    var em=$('#invEmail').value.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(em)){toast('Enter a valid email address.');return}
    var al='ABCDEFGHJKMNPQRSTUVWXYZ23456789',code='',a=new Uint8Array(6);crypto.getRandomValues(a);for(var k=0;k<6;k++)code+=al[a[k]%al.length];
    sb.from('invites').upsert({email:em,code:code,role:$('#invRole').value,barista_id:$('#invBarista').value||null,used_at:null,created_at:new Date().toISOString()}).then(function(r){
      if(r.error){toast('Could not create the invite.');return}
      S.lastInvite={email:em,code:code};$('#invEmail').value='';loadPeople();
    });
  }
});
function syncYn(){
  $$('.yn').forEach(function(g){
    var q=g.dataset.q,val=S.yn[q];
    $$('button',g).forEach(function(b){
      var yes=b.dataset.v==='1';b.className='';
      if(val!=null&&val===yes){var bad=(q==='checked'&&!yes)||(q==='recipe'&&yes)||(q==='brew'&&!yes);b.className=bad?'no':'ok'}
      b.setAttribute('aria-pressed',val!=null&&val===yes?'true':'false');
    });
  });
}
/* chart hover */
function overChart(ev){
  var el=ev.target&&ev.target.closest?ev.target.closest('svg.chart[data-kind="line"], .bar[data-tip]'):null;
  if(!el){hideTip();return}
  if(el.matches('svg.chart'))chartPointer(el,ev);
  else{var r=el.getBoundingClientRect();showTip(el.getAttribute('data-tip').split('|'),ev.clientX||r.left+r.width/2,ev.clientY||r.top)}
}
document.addEventListener('pointermove',overChart);
document.addEventListener('pointerdown',overChart);
document.addEventListener('focusin',function(e){if(e.target.matches&&e.target.matches('.bar[data-tip]')){var r=e.target.getBoundingClientRect();showTip(e.target.getAttribute('data-tip').split('|'),r.left+r.width/2,r.top)}});
document.addEventListener('focusout',hideTip);
window.addEventListener('scroll',hideTip,{passive:true});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){hideTip();if(S.openId){S.openId=null;renderDrawer()}}});
window.addEventListener('online',flushQueue);

/* ---------- subscriptions ---------- */
function sub(path,key,opts,after){
  db.collection(path,opts).onSnapshot(function(snap){
    S[key]=snap.docs.map(function(d){var o=Object.assign({},d.data());o.id=d.id;return o});if(after)after();schedule();
  },function(e){console.warn(path,e)});
}
function subMap(path,key,after){
  db.collection(path).onSnapshot(function(snap){
    var m={};snap.docs.forEach(function(d){m[d.id]=d.data()});S[key]=m;if(after)after();schedule();
  },function(e){console.warn(path,e)});
}
function loadPeople(){
  if(!sb||!S.admin)return;
  sb.from('profiles').select('id,email,role,approved,barista_id,created_at').then(function(r){if(r.data){S.people=r.data;schedule()}});
  sb.from('invites').select('email,code,role,barista_id,created_at,used_at').then(function(r){if(r.data){S.invites=r.data;schedule()}});
  sb.from('app_settings').select('key,value').eq('key','signup_mode').then(function(r){if(r.data&&r.data[0]){S.signupMode=r.data[0].value==='open'?'open':'invite';schedule()}});
}

/* ---------- sign in ---------- */
function showAuth(mode,msg,isErr){
  S.authMode=mode;$('#app').hidden=true;var el=$('#auth');el.hidden=false;
  if(mode!=='pending'&&pendTimer){clearInterval(pendTimer);pendTimer=null}
  var h='<div class="auth-in"><h1 class="hero-word"><span>crew<sup>®</sup></span></h1>';
  if(mode==='setup'){
    h+='<div class="stack"><h2>not connected yet</h2><p class="muted">This site needs its database details. Open <code>config.js</code> in the repository, paste in your Supabase project URL and anon key, and save. The setup guide has the exact steps.</p></div>';
  }else if(mode==='badurl'){
    h+='<div class="stack"><h2>check the address</h2><p class="muted">The Project URL in <code>config.js</code> does not look right. It should look like <code>https://abcdefgh.supabase.co</code>: it starts with https:// and has nothing after .supabase.co.</p><p class="muted">What this page found: <code>'+esc(S.badUrl||'')+'</code></p></div>';
  }else if(mode==='pending'){
    h+='<div class="stack"><h2>waiting for approval</h2><p class="muted">'+esc(S.email||'Your account')+' is signed in. A manager needs to approve it in the Access tab. This page checks again automatically.</p><div class="links"><button class="btn" data-act="auth-refresh">Check now</button><button class="btn ghost" data-act="signout">Sign out</button></div></div>';
    if(!pendTimer)pendTimer=setInterval(function(){if(S.authMode==='pending')loadProfile()},12000);
  }else{
    var titles={signin:'sign in',signup:'create account',forgot:'reset password',recovery:'new password'};
    h+='<form class="stack" id="authForm" novalidate><h2>'+titles[mode]+'</h2>';
    if(mode!=='recovery')h+='<label class="field"><span>Email</span><input type="email" id="authEmail" autocomplete="email" inputmode="email" autocapitalize="none" required></label>';
    if(mode!=='forgot')h+='<label class="field"><span>'+(mode==='recovery'?'New password':'Password')+'</span><input type="password" id="authPass" autocomplete="'+(mode==='signin'?'current-password':'new-password')+'" minlength="8" required></label>';
    if(mode==='signup')h+='<label class="field"><span>Invite code</span><input type="text" id="authCode" autocomplete="one-time-code" autocapitalize="characters" spellcheck="false" placeholder="From your manager"></label>';
    h+='<div class="msg'+(isErr?' err':'')+'" id="authMsg" role="status">'+esc(msg||(mode==='signup'?'Use the email your manager invited, at least 8 characters for the password, and the invite code they sent you.':''))+'</div>';
    h+='<div class="links"><button class="btn" type="submit">'+({signin:'Sign in',signup:'Create account',forgot:'Send reset link',recovery:'Save password'}[mode])+'</button>';
    if(mode==='signin')h+='<button class="btn ghost" type="button" data-act="auth-mode" data-mode="signup">Create account</button><button class="btn ghost" type="button" data-act="auth-mode" data-mode="forgot">Forgot password</button>';
    else if(mode!=='recovery')h+='<button class="btn ghost" type="button" data-act="auth-mode" data-mode="signin">Back to sign in</button>';
    h+='</div></form>';
  }
  el.innerHTML=h+(S.host?'<p class="small muted" id="connLine">'+esc(connText())+'</p>':'')+'</div>';
}
function netMsg(m){
  m=String(m||'');
  if(/load failed|failed to fetch|networkerror|network request|fetch/i.test(m))return 'Cannot reach the database at '+(S.host||'the address in config.js')+'. Check the Project URL in config.js, make sure the Supabase project is not paused, and turn off any content blocker for this site.';
  if(/database error saving new user|signup_closed/i.test(m))return 'Sign-ups are by invite only. Use the exact email your manager invited and the invite code they sent you. If you do not have one, ask your manager.';
  return m;
}
function authMsg(m,err){var e=$('#authMsg');if(e){e.textContent=m;e.className='msg'+(err?' err':'')}}
function doAuth(){
  var mode=S.authMode,em=$('#authEmail'),pw=$('#authPass'),cd=$('#authCode');
  var email=em?em.value.trim():'',pass=pw?pw.value:'',code=cd?cd.value.trim().toUpperCase():'';
  if(mode!=='recovery'&&!email){authMsg('Enter your email.',true);return}
  if(mode!=='forgot'&&pass.length<8){authMsg('Use at least 8 characters for the password.',true);return}
  authMsg('One moment…');
  if(mode==='signin'){sb.auth.signInWithPassword({email:email,password:pass}).then(function(r){if(r.error)authMsg(netMsg(r.error.message),true)},function(e){authMsg(netMsg(e&&e.message),true)})}
  else if(mode==='signup'){sb.auth.signUp({email:email,password:pass,options:{data:{invite_code:code}}}).then(function(r){if(r.error){authMsg(netMsg(r.error.message),true);return}if(!r.data.session){authMsg('Check your email for a confirmation link, then sign in.')}},function(e){authMsg(netMsg(e&&e.message),true)})}
  else if(mode==='forgot'){sb.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname}).then(function(r){authMsg(r.error?netMsg(r.error.message):'If that email has an account, a reset link is on its way.',!!r.error)})}
  else if(mode==='recovery'){sb.auth.updateUser({password:pass}).then(function(r){if(r.error){authMsg(netMsg(r.error.message),true);return}S.recovery=false;sb.auth.getSession().then(function(x){S.profileFor=null;handleSession(x.data.session)})})}
}
function handleSession(session){
  if(!session){if(S.started){location.reload();return}S.profileFor=null;S.uid=null;showAuth('signin');return}
  if(S.profileFor===session.user.id)return;
  S.profileFor=session.user.id;S.uid=session.user.id;S.email=session.user.email;loadProfile();
}
function loadProfile(){
  sb.from('profiles').select('id,email,role,approved,barista_id').eq('id',S.uid).maybeSingle().then(function(r){
    if(r.error){if(!S.started){showAuth('signin','Could not load your account: '+netMsg(r.error.message),true);S.profileFor=null}return}
    var p=r.data;
    if(S.started){
      if(!p||!p.approved||(p.role==='manager')!==S.admin){location.reload();return}
      if((p.barista_id||null)!==S.myBarista){S.myBarista=p.barista_id||null;schedule()}
      return;
    }
    if(!p||!p.approved){if(S.authMode!=='pending')showAuth('pending');return}
    startApp(p);
  });
}

/* ---------- database adapter (documents on top of Supabase) ---------- */
function makeDb(sb){
  var subs=[],deb=null;
  function mapErr(e){var m=(e&&e.message)||'',c=(e&&e.code)||'';
    if(c==='42501'||c==='P0002'||/row-level security|permission denied|doc_not_found/i.test(m))return {code:'invalid_argument',message:m};
    if(c==='54000'||/too large|quota/i.test(m))return {code:'quota_exceeded',message:m};
    if(/^PGRST|^22|^23/.test(c)&&c!=='PGRST301')return {code:'invalid_argument',message:m};
    return {code:'unavailable',message:m}}
  function runAll(){subs.forEach(function(s){s.run()})}
  function kick(){clearTimeout(deb);deb=setTimeout(runAll,150)}
  function listen(query,build,cb,errcb){
    var last=null;
    var s={run:function(){query().then(function(r){
      if(r.error){if(errcb)errcb(mapErr(r.error));return}
      var rows=r.data||[],j=JSON.stringify(rows);if(j===last)return;last=j;cb(build(rows))
    },function(){})}};
    subs.push(s);s.run();
    return function(){subs=subs.filter(function(x){return x!==s})};
  }
  function wrap(p){return p.then(function(r){if(r&&r.error)throw mapErr(r.error);kick()},function(e){throw (e&&e.code)?e:mapErr(e||{message:'network'})})}
  function mkDoc(row){return {id:row.id,exists:true,data:function(){return row.data}}}
  function docRef(col,id){
    return {id:id,path:col+'/'+id,
      set:function(d){return wrap(sb.from('docs').upsert({collection:col,id:id,data:d,updated_at:new Date().toISOString()}))},
      update:function(d){return wrap(sb.rpc('merge_doc',{p_collection:col,p_id:id,p_patch:d}))},
      delete:function(){return wrap(sb.from('docs').delete().eq('collection',col).eq('id',id))}
    };
  }
  function colRef(col,opts){
    opts=opts||{};
    return {path:col,
      onSnapshot:function(cb,errcb){return listen(function(){
        var q=sb.from('docs').select('id,data').eq('collection',col);
        if(opts.sinceDays)q=q.gte('created_at',new Date(Date.now()-opts.sinceDays*864e5).toISOString());
        return q.order('updated_at',{ascending:false}).limit(1000);
      },function(rows){return {docs:rows.map(mkDoc),size:rows.length,empty:!rows.length}},cb,errcb)}
    };
  }
  try{sb.channel('crew-docs').on('postgres_changes',{event:'*',schema:'public',table:'docs'},kick).subscribe()}catch(e){}
  setInterval(runAll,20000);
  document.addEventListener('visibilitychange',function(){if(!document.hidden)kick()});
  return {collection:colRef,doc:function(path){var p=path.split('/');return docRef(p[0],p.slice(1).join('/'))},refresh:kick};
}

function startApp(p){
  if(S.started)return;
  S.started=true;S.admin=p.role==='manager';S.myBarista=p.barista_id||null;S.db=true;
  if(S.admin&&S.tab==='me')S.tab='overview';
  if(pendTimer){clearInterval(pendTimer);pendTimer=null}
  $('#auth').hidden=true;$('#app').hidden=false;
  db=makeDb(sb);loadQueue();buildNav();
  sub('baristas','baristasRaw',null,rebuild);
  subMap('staff','staff',rebuild);
  sub('checks','checks',{sinceDays:150});
  sub('ideas','ideas');sub('recipes','recipes');sub('history','history',{sinceDays:200});sub('certs','certs');
  subMap('assign','assign');subMap('plan','plan');subMap('settings','settings');
  if(S.admin){subMap('scorecards','score');sub('oneonones','oneonones');loadPeople();peopleTimer=setInterval(loadPeople,20000)}
  profTimer=setInterval(function(){if(S.uid)loadProfile()},30000);
  setInterval(flushQueue,15000);flushQueue();
  schedule();
}

function connText(){return 'Build '+BUILD+' · '+(S.host||'no address')+' · '+(S.conn||'checking connection…')}
function setConn(t){S.conn=t;var e=$('#connLine');if(e)e.textContent=connText()}
function boot(){
  var sc=document.createElement('script');
  sc.src='config.js?v='+Date.now();
  sc.onload=boot2;
  sc.onerror=function(){window.CREW_CONFIG=window.CREW_CONFIG||{};boot2()};
  document.head.appendChild(sc);
}
function boot2(){
  $('#ckDate').value=today();
  $('#ovDate').textContent=new Date().toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
  $('#ovYear').textContent='('+new Date().getFullYear()+')';
  syncYn();buildNav();
  var c=window.CREW_CONFIG||{};
  var cfgUrl=String(c.url||'').trim().replace(/\/+$/,'').replace(/\/(rest|auth)\/v1.*$/,'');
  var cfgKey=String(c.anonKey||'').trim();
  S.host=cfgUrl.replace(/^https?:\/\//,'');
  if(!cfgUrl||!cfgKey||/PASTE/.test(cfgUrl+cfgKey)||!window.supabase){showAuth('setup');return}
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)$/i.test(cfgUrl)&&!window.CREW_TEST){S.badUrl=String(c.url||'').slice(0,60);showAuth('badurl');return}
  sb=window.supabase.createClient(cfgUrl,cfgKey);
  try{
    var ctl=new AbortController(),to=setTimeout(function(){ctl.abort()},12000);
    fetch(cfgUrl+'/auth/v1/health',{headers:{apikey:cfgKey},signal:ctl.signal}).then(function(r){clearTimeout(to);setConn(r.ok?'database reachable':'database answered with error '+r.status+(r.status===401?' (check the anon key)':''))}).catch(function(e){clearTimeout(to);setConn('cannot reach database ('+((e&&e.name==='AbortError')?'timed out':((e&&e.message)||'blocked'))+')')});
  }catch(e){setConn('connection check unavailable')}
  sb.auth.onAuthStateChange(function(ev,session){
    setTimeout(function(){
      if(ev==='PASSWORD_RECOVERY'){S.recovery=true;showAuth('recovery');return}
      if(S.recovery)return;
      handleSession(session);
    },0);
  });
  sb.auth.getSession().then(function(r){if(!S.profileFor&&!S.started&&!S.recovery)handleSession(r.data&&r.data.session)});
}
boot();
})();
