(function(){
'use strict';
var BUILD='2026-10-29.1';
var $=function(s,r){return (r||document).querySelector(s)}, $$=function(s,r){return Array.prototype.slice.call((r||document).querySelectorAll(s))};
var esc=function(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})};
var REDUCE=!!(window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches);
function newId(){return (window.crypto&&crypto.randomUUID)?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now().toString(36)}

/* ---------- defaults ---------- */
var DEF_SKILLS=[
 {k:'espresso',n:'Espresso & dialing in',g:'On the bar'},{k:'milk',n:'Milk & latte art',g:'On the bar'},{k:'filter',n:'Filter & pour-over',g:'On the bar'},{k:'speed',n:'Speed on a busy bar',g:'On the bar'},
 {k:'service',n:'Customer service',g:'Customers'},{k:'register',n:'Register & cash',g:'Customers'},
 {k:'routine',n:'Opening & closing',g:'Running the shop'},{k:'clean',n:'Cleaning & machine care',g:'Running the shop'}
];
var ROLES=['Trainee','Barista','Senior barista','Shift lead','Head barista'];
var PRIVATE=['skills','notes'];
var TABS=[
 {id:'locations',label:'Locations',count:'locations'},{id:'team',label:'Baristas',count:'team'},{id:'checks',label:'Coffee checks'},
 {id:'me',label:'Me',need:'me'},{id:'access',label:'Access',need:'admin',count:'access'},{id:'setup',label:'Setup',need:'admin'}
];

/* ---------- state ---------- */
var S={people:[],invites:[],signupMode:'invite',lastInvite:null,uid:null,myBarista:null,email:'',started:false,profileFor:null,recovery:false,authMode:'signin',
 baristasRaw:[],baristas:[],staff:{},checks:[],locations:[],settings:{},
 tab:'locations',locId:null,openId:null,admin:false,db:false,ckFilter:'all',ckLoc:'',teamLoc:'',yn:{checked:null,recipe:null,brew:null},confirm:null,editing:null,fresh:true,queue:[],exporting:false,menuOpen:false};
var db=null,sb=null,pendTimer=null,peopleTimer=null,profTimer=null,flushing=false;

/* ---------- helpers ---------- */
function pad(n){return String(n).padStart(2,'0')}
function ymd(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate())}
function today(){return ymd(new Date())}
function daysAgo(n){var d=new Date();d.setDate(d.getDate()-n);return ymd(d)}
function fmtDay(s){if(!s)return '';var d=new Date(s+'T00:00:00');return d.toLocaleDateString(undefined,{day:'numeric',month:'short'})}
function n1(v){return v==null?'—':(Math.round(v*10)/10).toFixed(1)}
function pct(v){return v==null?'—':Math.round(v*100)+'%'}
function byName(a,b){return String(a.name||'').localeCompare(String(b.name||''))}
function byRecent(a,b){return (String(b.date||'')+String(b.createdAt||0).padStart(15,'0'))>(String(a.date||'')+String(a.createdAt||0).padStart(15,'0'))?1:-1}
function bget(id){for(var i=0;i<S.baristas.length;i++){if(S.baristas[i].id===id)return S.baristas[i]}return null}
function bname(id){var b=bget(id);return b?b.name||'Unnamed':'Former barista'}
function lget(id){for(var i=0;i<S.locations.length;i++){if(S.locations[i].id===id)return S.locations[i]}return null}
function lname(id){var l=lget(id);return l?l.name:''}
function baristasAt(id){return S.baristas.filter(function(b){return (b.locationId||'')===(id||'')||(!id&&!lget(b.locationId))}).sort(byName)}
function canSee(b){return !!b&&(S.admin||b.id===S.myBarista)}
function me(){return S.myBarista?bget(S.myBarista):null}
function skillsList(){var l=(S.settings.skills||{}).list;return Array.isArray(l)&&l.length?l:DEF_SKILLS}
function groupSkills(){var out=[],cur=null;skillsList().forEach(function(s){if(!cur||cur.g!==s.g){cur={g:s.g||'Other',items:[]};out.push(cur)}cur.items.push(s)});return out}
function skillVal(b,k){var v=b&&b.skills&&b.skills[k];return typeof v==='number'?v:null}
function techAvg(b){var v=[];skillsList().forEach(function(s){var x=skillVal(b,s.k);if(x!=null)v.push(x)});return v.length?v.reduce(function(a,c){return a+c},0)/v.length:null}
function isFlag(c){return c.checked===false||c.recipeProblem===true||c.brewingWell===false}
function whyList(c){var w=[];if(c.checked===false)w.push('check skipped');if(c.recipeProblem)w.push('recipe problem');if(c.brewingWell===false)w.push('not brewing well');return w}
function checksFor(id,from){return S.checks.filter(function(c){return c.baristaId===id&&(!from||c.date>=from)})}
function checkStats(id,from){var cs=checksFor(id,from),done=cs.filter(function(c){return c.checked}).length;return {n:cs.length,done:done,flags:cs.filter(isFlag).length,pct:cs.length?done/cs.length:null}}
function todayState(b){
  var cs=S.checks.filter(function(c){return c.baristaId===b.id&&c.date===today()});
  if(!cs.length)return {t:'No check yet',k:''};
  return cs.some(isFlag)?{t:'Follow-up',k:'bad'}:{t:'Checked',k:'good'};
}
function locStats(id){
  var bs=baristasAt(id),ids={};bs.forEach(function(b){ids[b.id]=1});
  var cs=S.checks.filter(function(c){return ids[c.baristaId]});
  var todayDone=bs.filter(function(b){return cs.some(function(c){return c.baristaId===b.id&&c.date===today()})}).length;
  var flags=cs.filter(function(c){return c.date>=daysAgo(6)&&isFlag(c)}).length;
  return {people:bs.length,todayDone:todayDone,flags:flags};
}
function canEditEntry(e){
  if(S.admin)return true;
  if(!S.myBarista||e.baristaId!==S.myBarista)return false;
  return Date.now()-(e.createdAt||0)<864e5-60000;
}
function pill(t,k){return '<span class="pill '+(k||'')+'">'+esc(t)+'</span>'}
function sampleTag(x){return x&&x.sample?' <span class="pill">Sample</span>':''}
function rebuild(){
  S.baristas=S.baristasRaw.map(function(b){var o=Object.assign({},b),st=S.staff[b.id];if(st){PRIVATE.forEach(function(f){if(st[f]!==undefined)o[f]=st[f]})}return o});
}

/* ---------- toasts, errors, write queue ---------- */
var toastT;
function toast(m){var el=$('#toastMount');el.innerHTML='<div class="toast">'+esc(m)+'</div>';clearTimeout(toastT);toastT=setTimeout(function(){el.innerHTML=''},3600)}
function fail(e){var c=e&&e.code;toast(c==='invalid_argument'||c==='not_granted'?'You don’t have permission to change that, or the 24 hour edit window has passed.':(c==='quota_exceeded'?'The database is full. Delete some old entries.':'That didn’t save. Check your connection and try again.'))}
var tq={};
function queue(key,fn){var p=(tq[key]||Promise.resolve()).then(fn,fn).catch(function(e){fail(e)});tq[key]=p;return p}

/* ---------- shared fragments ---------- */
function seg(kind,key,val,dis,label){
  return '<div class="seg" role="group" aria-label="'+esc(label)+'">'+[0,1,2,3].map(function(v){
    return '<button type="button" class="'+(val===v?'on s'+v:'')+'" data-act="rate" data-key="'+esc(key)+'" data-v="'+v+'" aria-pressed="'+(val===v)+'"'+(dis?' disabled':'')+'>'+v+'</button>';
  }).join('')+'</div>';
}
function strip(b){
  var sk=skillsList();
  return '<div class="strip" style="grid-template-columns:repeat('+sk.length+',1fr)" aria-hidden="true">'+sk.map(function(s,i){var v=skillVal(b,s.k);return '<i class="'+(v==null?'':'v'+v)+'" style="--i:'+i+'" title="'+esc(s.n)+(v==null?': not rated':': '+v)+'"></i>'}).join('')+'</div>';
}
function notLinkedNote(){return '<div class="card flat"><strong>Your account is not linked to a barista profile yet.</strong><p class="small muted">Ask a manager to link it in the Access tab. Then you can log coffee checks and see your own skills.</p></div>'}
function checkItem(c,showWho){
  var pills=[c.checked?pill('Checked','good'):pill('Check skipped','bad')];
  if(c.recipeProblem)pills.push(pill('Recipe problem','bad'));
  if(c.brewingWell===false)pills.push(pill('Not brewing well','bad'));
  if(!isFlag(c))pills.push(pill('OK','good'));
  var mine=canEditEntry(c),k='checks/'+c.id,note=c.fix||c.taste;
  return '<div class="item"><div class="row between"><span class="t">'+(showWho!==false?esc(bname(c.baristaId))+' <span class="muted" style="font-weight:400">· ':'<span class="muted" style="font-weight:400">')+esc(c.coffee||'Coffee')+sampleTag(c)+'</span></span><span class="small muted mono">'+esc(fmtDay(c.date))+'</span></div>'
    +'<div class="row">'+pills.join('')+'</div>'
    +(note?'<div class="small">'+esc(note)+'</div>':'')
    +(mine?'<div class="row"><button class="btn ghost sm" data-act="edit-entry" data-id="'+c.id+'">Edit</button><button class="btn danger sm" data-act="del" data-coll="checks" data-id="'+c.id+'">'+(S.confirm===k?'Confirm delete':'Delete')+'</button></div>':'')+'</div>';
}
function personRow(b){
  var ts=todayState(b),adm=S.admin;
  var inner='<span class="row between"><span class="t">'+esc(b.name||'Unnamed')+sampleTag(b)+' <span class="muted" style="font-weight:400">· '+esc(b.role||'Barista')+'</span></span><span class="row">'+pill(ts.t,ts.k)+(adm?'<span class="mono small muted">'+n1(techAvg(b))+'</span>':'')+'</span></span>';
  return adm?'<button class="item rowbtn" data-act="open-b" data-id="'+b.id+'">'+inner+'</button>':'<div class="item">'+inner+'</div>';
}
function addBaristaForm(locId){
  return '<form id="addForm" class="row" autocomplete="off" data-loc="'+esc(locId||'')+'"><input type="text" id="addName" data-keep placeholder="New barista name" style="width:190px" aria-label="Barista name"><button class="btn" type="submit">Add barista</button></form>';
}

/* ---------- locations (home) ---------- */
function renderLocations(){
  var el=$('#locBody');
  $('#locHead').hidden=!!S.locId;
  if(S.locId){renderLocation(el);return}
  $('#locHead').hidden=false;
  var h='';
  if(S.admin)h+='<form id="locForm" class="row" autocomplete="off"><input type="text" id="locName" data-keep placeholder="New location name" style="width:210px" aria-label="Location name"><button class="btn" type="submit">Add location</button></form>';
  var locs=S.locations.slice().sort(byName),un=S.admin?baristasAt(''):[];
  if(!locs.length&&!un.length){
    h+='<div class="card empty"><h3>No locations yet</h3><p>'+(S.admin?'Add your first location above, then add the baristas who work there.':'A manager needs to add the locations first.')+'</p>'+(S.admin?'<div class="row"><button class="btn ghost" data-act="sample-load">Load a sample team</button></div>':'')+'</div>';
    el.innerHTML=h;return;
  }
  h+='<div class="grid g-auto">';
  var all=locs.map(function(l){return {id:l.id,name:l.name,sample:l.sample}});
  if(un.length)all.push({id:'_',name:'No location'});
  h+=all.map(function(l,i){
    var st=locStats(l.id==='_'?'':l.id);
    return '<button class="person" style="--i:'+i+'" data-act="open-loc" data-id="'+esc(l.id)+'"><div class="stack" style="gap:4px"><h3>'+esc(l.name)+sampleTag(l)+'</h3><div class="small muted">'+st.people+(st.people===1?' barista':' baristas')+'</div></div>'
     +'<div class="kv"><div><span class="label">Checked today</span><b>'+st.todayDone+'<span class="muted" style="font-size:.6em"> / '+st.people+'</span></b></div><div><span class="label">Follow-ups, 7 days</span><b'+(st.flags?' style="color:var(--bad)"':'')+'>'+st.flags+'</b></div></div></button>';
  }).join('')+'</div>';
  if(S.admin&&S.baristas.some(function(b){return b.sample}))h+='<div class="card flat row between"><span class="small">The sample team is loaded. Remove it before you add real people.</span><button class="btn ghost sm" data-act="sample-clear">Remove sample data</button></div>';
  el.innerHTML=h;
}
function renderLocation(el){
  var id=S.locId,real=id==='_'?'':id;
  if(id!=='_'&&!lget(id)){S.locId=null;renderLocations();return}
  $('#locHead').hidden=true;
  var name=id==='_'?'No location':lname(id),st=locStats(real),bs=baristasAt(real),ids={};bs.forEach(function(b){ids[b.id]=1});
  var cs=S.checks.filter(function(c){return ids[c.baristaId]}).sort(byRecent);
  var flags=cs.filter(function(c){return c.date>=daysAgo(6)&&isFlag(c)});
  var h='<div class="row between"><button class="btn ghost sm" data-act="loc-back">← All locations</button><button class="btn sm" data-act="goto-check" data-loc="'+esc(id)+'">Log a coffee check</button></div>';
  h+='<div class="head"><div><h2 style="font-size:clamp(40px,10vw,84px)">'+esc(name)+'</h2></div></div>';
  h+='<div class="kv"><div><span class="label">Baristas</span><b>'+st.people+'</b></div><div><span class="label">Checked today</span><b>'+st.todayDone+' / '+st.people+'</b></div><div><span class="label">Follow-ups, 7 days</span><b'+(st.flags?' style="color:var(--bad)"':'')+'>'+st.flags+'</b></div></div>';
  h+='<div class="card"><div class="row between"><h3>Baristas</h3>'+(S.admin&&id!=='_'?addBaristaForm(id):'')+'</div><div class="list">'+(bs.length?bs.map(personRow).join(''):'<div class="item muted">No one here yet.</div>')+'</div></div>';
  h+='<div class="card"><h3>Needs attention</h3><div class="list">'+(flags.length?flags.slice(0,6).map(function(c){return checkItem(c)}).join(''):'<div class="item muted">No follow-ups in the last 7 days.</div>')+'</div></div>';
  h+='<div class="card"><h3>Recent checks</h3><div class="list">'+(cs.length?cs.slice(0,6).map(function(c){return checkItem(c)}).join(''):'<div class="item muted">No checks logged yet.</div>')+'</div></div>';
  el.innerHTML=h;
}

/* ---------- baristas ---------- */
function renderTeam(){
  var h='';
  var chips=['<button class="chip" data-act="team-loc" data-v="" aria-pressed="'+(S.teamLoc==='')+'">All</button>'].concat(S.locations.slice().sort(byName).map(function(l){return '<button class="chip" data-act="team-loc" data-v="'+esc(l.id)+'" aria-pressed="'+(S.teamLoc===l.id)+'">'+esc(l.name)+'</button>'}));
  if(S.admin&&baristasAt('').length)chips.push('<button class="chip" data-act="team-loc" data-v="_" aria-pressed="'+(S.teamLoc==='_')+'">No location</button>');
  h+='<div class="row">'+chips.join('')+'</div>';
  if(S.admin){
    h+='<form id="addForm" class="row" autocomplete="off" data-loc="'+esc(S.teamLoc==='_'?'':S.teamLoc)+'"><input type="text" id="addName" data-keep placeholder="New barista name" style="width:190px" aria-label="Barista name"><select id="addLoc" aria-label="Location" style="width:170px"><option value="">No location</option>'+S.locations.slice().sort(byName).map(function(l){return '<option value="'+l.id+'"'+(S.teamLoc===l.id?' selected':'')+'>'+esc(l.name)+'</option>'}).join('')+'</select><button class="btn" type="submit">Add barista</button></form>';
  }
  var list=S.baristas.filter(function(b){return !S.teamLoc||(S.teamLoc==='_'?!lget(b.locationId):b.locationId===S.teamLoc)}).sort(byName);
  if(!list.length)h+='<div class="card empty"><h3>No baristas here</h3><p>'+(S.admin?'Add someone above.':'Nobody has been added yet.')+'</p></div>';
  else h+='<div class="grid g-auto">'+list.map(function(b,i){
    var st=checkStats(b.id,daysAgo(29)),self=!S.admin&&b.id===S.myBarista,open=S.admin||self,ts=todayState(b);
    var attrs=S.admin?' data-act="open-b" data-id="'+b.id+'"':(self?' data-act="tab" data-tab="me"':'');
    return '<'+(open?'button':'div')+' class="person'+(open?'':' static')+'" style="--i:'+i+'"'+attrs+'><div class="stack" style="gap:4px"><h3>'+esc(b.name||'Unnamed')+sampleTag(b)+(self?' <span class="pill acc">You</span>':'')+'</h3><div class="row small muted"><span>'+esc(b.role||'Barista')+'</span>'+(lname(b.locationId)?'<span>· '+esc(lname(b.locationId))+'</span>':'')+'</div></div>'
      +(canSee(b)?strip(b):'<span></span>')
      +'<div class="kv">'+(canSee(b)?'<div><span class="label">Skills</span><b>'+n1(techAvg(b))+'</b></div>':'')+'<div><span class="label">Today</span>'+pill(ts.t,ts.k)+'</div>'+(S.admin?'<div><span class="label">Follow-ups, 30d</span><b'+(st.flags?' style="color:var(--bad)"':'')+'>'+st.flags+'</b></div>':'')+'</div></'+(open?'button':'div')+'>';
  }).join('')+'</div>';
  $('#teamBody').innerHTML=h;
}

/* ---------- coffee checks ---------- */
function fillSelect(sel,items,keep){
  var cur=keep!=null?keep:sel.value;
  sel.innerHTML=items.map(function(i){return '<option value="'+esc(i.v)+'">'+esc(i.t)+'</option>'}).join('');
  if(cur&&items.some(function(i){return i.v===cur}))sel.value=cur;
}
function renderChecks(){
  var who=$('#ckWho'),mine=!S.admin&&S.myBarista,blocked=!S.admin&&!S.myBarista;
  var items=S.baristas.slice().sort(byName).map(function(b){return {v:b.id,t:b.name+(lname(b.locationId)?' · '+lname(b.locationId):'')}});
  var last='';try{last=localStorage.getItem('crew.ckWho')||''}catch(e){}
  if(mine)fillSelect(who,items.filter(function(i){return i.v===S.myBarista}),S.myBarista);
  else fillSelect(who,items.length?items:[{v:'',t:'Add a barista first'}],who.value||last);
  who.closest('.field').hidden=!!mine;
  $('#checkForm').hidden=blocked;$('#ckBlocked').innerHTML=blocked?notLinkedNote():'';
  var ed=S.editing&&S.editing.coll==='checks';
  $('#ckFormTitle').textContent=ed?'Edit coffee check':'Log a coffee check';$('#ckSubmit').textContent=ed?'Save changes':'Log check';$('#ckCancel').hidden=!ed;
  var names={};S.checks.forEach(function(c){if(c.coffee)names[c.coffee]=1});
  $('#coffeeList').innerHTML=Object.keys(names).map(function(c){return '<option value="'+esc(c)+'">'}).join('');
  var f=$('#ckLoc');
  if(S.admin||S.locations.length>1){
    f.hidden=false;fillSelect(f,[{v:'',t:'All locations'}].concat(S.locations.slice().sort(byName).map(function(l){return {v:l.id,t:l.name}})),S.ckLoc);
  }else f.hidden=true;
  var scope=S.admin?S.checks:S.checks.filter(function(c){return c.baristaId===S.myBarista});
  if(S.ckLoc)scope=scope.filter(function(c){var b=bget(c.baristaId);return b&&b.locationId===S.ckLoc});
  var list=scope.slice().sort(byRecent);if(S.ckFilter==='flag')list=list.filter(isFlag);
  $('#ckList').innerHTML=list.length?list.slice(0,40).map(function(c){return checkItem(c)}).join(''):'<div class="item muted">'+(S.ckFilter==='flag'?'No follow-ups. Everything logged looks fine.':'No checks logged yet. The first one will show here.')+'</div>';
}

/* ---------- me ---------- */
function renderMe(){
  var el=$('#meBody'),b=me();
  if(!b){el.innerHTML=S.myBarista?'<div class="card flat">Your barista profile could not be found. Ask a manager to check the link in the Access tab.</div>':notLinkedNote();return}
  var st=checkStats(b.id,daysAgo(29)),h='';
  h+='<div class="kv"><div><span class="label">Location</span><b style="font-size:20px">'+esc(lname(b.locationId)||'—')+'</b></div><div><span class="label">Skill avg</span><b>'+n1(techAvg(b))+'</b></div><div><span class="label">Checks, 30 days</span><b>'+st.n+'</b></div></div>';
  h+='<div class="card"><h3>My skills</h3><div class="legend" style="margin:0 0 6px"><span><i style="background:var(--s0)"></i>0 Not trained</span><span><i style="background:var(--s1)"></i>1 Learning</span><span><i style="background:var(--s2)"></i>2 Independent</span><span><i style="background:var(--s3)"></i>3 Can train others</span></div>';
  groupSkills().forEach(function(g){h+='<div class="label" style="margin:14px 0 2px">'+esc(g.g)+'</div>';g.items.forEach(function(s){h+='<div class="skillrow"><span>'+esc(s.n)+'</span>'+seg('skill',s.k,skillVal(b,s.k),true,s.n)+'</div>'})});
  h+='</div>';
  if(b.notes)h+='<div class="card"><h3>Notes from your manager</h3><p class="pre">'+esc(b.notes)+'</p></div>';
  var mc=S.checks.filter(function(c){return c.baristaId===b.id}).sort(byRecent).slice(0,6);
  h+='<div class="card"><h3>My recent checks</h3><div class="list">'+(mc.length?mc.map(function(c){return checkItem(c,false)}).join(''):'<div class="item muted">None yet.</div>')+'</div></div>';
  el.innerHTML=h;
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
function legacyLocations(){
  var seen={};S.baristasRaw.forEach(function(b){var t=String(b.location||'').trim();if(t&&!lget(b.locationId))seen[t]=(seen[t]||0)+1});
  return seen;
}
function renderSetup(){
  var sk=skillsList(),h='',legacy=legacyLocations(),lk=Object.keys(legacy);
  h+='<div class="card stack"><h3>Locations</h3><form id="locForm2" class="row" autocomplete="off"><input type="text" id="locName2" data-keep placeholder="New location name" style="width:210px" aria-label="Location name"><button class="btn" type="submit">Add location</button></form><div class="list">'
   +(S.locations.length?S.locations.slice().sort(byName).map(function(l){var n=baristasAt(l.id).length;return '<div class="item"><div class="row">'+rowIn('data-locn="'+l.id+'"',l.name,'Location name','min(100%,260px)')+'<span class="small muted">'+n+(n===1?' barista':' baristas')+'</span><button class="btn danger sm" data-act="loc-del" data-id="'+l.id+'">'+(S.confirm==='loc/'+l.id?'Confirm remove':'Remove')+'</button></div></div>'}).join(''):'<div class="item muted">No locations yet.</div>')+'</div>'
   +(lk.length?'<div class="card flat stack"><span class="small">Some baristas have a location typed in from the old version ('+esc(lk.join(', '))+').</span><div><button class="btn sm" data-act="import-loc">Turn these into locations</button></div></div>':'')+'</div>';
  h+='<div class="card stack"><h3>Skills</h3><p class="small muted">The skills you rate each barista on, scored 0 to 3. Removing a skill hides it but keeps old ratings.</p><div class="list">'
   +sk.map(function(s,i){return '<div class="item"><div class="form"><label class="field"><span>Skill</span>'+rowIn('data-list="skills" data-i="'+i+'" data-f="n"',s.n)+'</label><label class="field"><span>Group</span>'+rowIn('data-list="skills" data-i="'+i+'" data-f="g"',s.g)+'</label></div><div class="row"><button class="btn ghost sm" data-act="list-move" data-i="'+i+'" data-d="-1"'+(i===0?' disabled':'')+'>Up</button><button class="btn ghost sm" data-act="list-move" data-i="'+i+'" data-d="1"'+(i===sk.length-1?' disabled':'')+'>Down</button><button class="btn danger sm" data-act="list-del" data-i="'+i+'">'+(S.confirm==='skills/'+i?'Confirm remove':'Remove')+'</button></div></div>'}).join('')
   +'</div><div><button class="btn" data-act="list-add">Add a skill</button></div></div>';
  h+='<div class="card stack"><h3>Backup and export</h3><p class="small muted">Download everything in the database. Excel is for reading. The JSON file is a full backup.</p><div class="row"><button class="btn" data-act="export-xlsx"'+(S.exporting?' disabled':'')+'>'+(S.exporting?'Preparing…':'Download Excel')+'</button><button class="btn ghost" data-act="export-json"'+(S.exporting?' disabled':'')+'>Download JSON backup</button></div></div>';
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
  var st=checkStats(b.id,daysAgo(29)),login=S.people.filter(function(p){return p.barista_id===b.id})[0];
  var h='<div class="scrim" data-act="close-drawer"></div><aside class="drawer'+(already?' still':'')+'" role="dialog" aria-label="Barista details"><div class="drawer-head"><input type="text" data-f="name" value="'+esc(b.name||'')+'" aria-label="Name"><button class="btn ghost sm" data-act="close-drawer">Close</button></div><div class="drawer-body">';
  h+='<div class="stack"><div class="kv"><div><span class="label">Skill avg</span><b>'+n1(techAvg(b))+'</b></div><div><span class="label">Checks, 30 days</span><b>'+st.n+'</b></div><div><span class="label">Follow-ups</span><b>'+st.flags+'</b></div></div>'+strip(b)+'<p class="small muted">'+(login?'Signs in as '+esc(login.email)+'.':'No login linked yet. Link one in the Access tab so they can see their own skills.')+'</p></div>';
  h+='<div class="form"><label class="field"><span>Location</span><select data-f="locationId"><option value="">No location</option>'+S.locations.slice().sort(byName).map(function(l){return '<option value="'+l.id+'"'+(b.locationId===l.id?' selected':'')+'>'+esc(l.name)+'</option>'}).join('')+'</select></label>'
   +'<label class="field"><span>Role</span><select data-f="role">'+ROLES.map(function(r){return '<option'+((b.role||'Barista')===r?' selected':'')+'>'+r+'</option>'}).join('')+'</select></label>'
   +'<label class="field wide"><span>Notes (visible to managers and this barista)</span><textarea data-f="notes" rows="3">'+esc(b.notes||'')+'</textarea></label></div>';
  h+='<div><h3>Skills</h3><div class="legend" style="margin-bottom:8px"><span>0 Not trained</span><span>1 Learning</span><span>2 Independent</span><span>3 Can train others</span></div>';
  groupSkills().forEach(function(g){h+='<div class="label" style="margin:12px 0 2px">'+esc(g.g)+'</div>';g.items.forEach(function(s){h+='<div class="skillrow"><span>'+esc(s.n)+'</span>'+seg('skill',s.k,skillVal(b,s.k),false,s.n)+'</div>'})});
  h+='</div><div><button class="btn danger" data-act="del-b" data-id="'+b.id+'">'+(S.confirm==='b/'+b.id?'Confirm: remove '+esc(b.name||'barista')+' and their checks':'Remove barista')+'</button></div></div></aside>';
  m.innerHTML=h;
  var nb=$('.drawer-body',m);if(nb)nb.scrollTop=sy;
}

/* ---------- header, tabs, render loop ---------- */
function tabVisible(t){return t.need==='admin'?S.admin:t.need==='me'?(!S.admin&&!!S.myBarista):true}
function validTab(t){return TABS.some(function(x){return x.id===t&&tabVisible(x)})}
function tabCounts(){
  var pend=S.people.filter(function(p){return !p.approved}).length;
  return {locations:S.locations.length,team:S.baristas.length,access:S.admin&&pend?pend:null};
}
function buildNav(){}
function renderHeader(){
  $('#who').innerHTML=S.db?'<button class="btn ghost sm icon" data-act="theme" id="themeBtn" aria-label="'+themeLabel()+'" title="'+themeLabel()+'">'+themeIcon()+'</button> <button class="btn ghost sm" id="menuBtn" data-act="menu" aria-haspopup="dialog" aria-expanded="'+!!S.menuOpen+'">Menu</button>':'';
  var cr=$('#crumb'),ct=TABS.filter(function(t){return t.id===S.tab})[0];
  if(cr){var nm=S.tab==='locations'&&S.locId?(S.locId==='_'?'no location':(lname(S.locId)||'').toLowerCase()):(ct?ct.label.toLowerCase():'');cr.textContent=S.db&&nm?'/ '+nm:''}
  var q=$('#queueBar');if(q){q.hidden=!S.queue.length;q.textContent=S.queue.length?(S.queue.length+(S.queue.length===1?' entry is':' entries are')+' saved on this phone and will upload when you are back online.'):''}
}
function renderAll(){
  if(!validTab(S.tab))S.tab='locations';
  renderHeader();
  var t=S.tab;
  if(t==='locations')renderLocations();else if(t==='team')renderTeam();else if(t==='checks')renderChecks();else if(t==='me')renderMe();else if(t==='access')renderAccess();else if(t==='setup')renderSetup();
  $$('section.tab').forEach(function(s){s.hidden=s.id!=='tab-'+S.tab});
  renderDrawer();
  if(S.fresh){S.fresh=false;var mn=$('main');mn.classList.add('fresh');setTimeout(function(){mn.classList.remove('fresh')},1400)}
}
var raf=0;
function schedule(){if(raf)return;raf=requestAnimationFrame(function(){raf=0;
  var a=document.activeElement,tabEl=$('#tab-'+S.tab);
  if(a&&tabEl&&tabEl.contains(a)&&(a.tagName==='INPUT'||a.tagName==='TEXTAREA'||a.tagName==='SELECT')&&(a.hasAttribute('data-keep')||a.tagName==='TEXTAREA'||a.type==='date')){renderHeader();renderDrawer();return}
  renderAll()})}
function hashFor(){return '#'+S.tab+(S.tab==='locations'&&S.locId?'/'+S.locId:'')}
function go(t,locId,fromHash){
  S.tab=t;S.locId=t==='locations'?(locId||null):null;S.confirm=null;
  if(!fromHash){try{if(location.hash!==hashFor())history.pushState(null,'',hashFor())}catch(e){}}
  try{localStorage.setItem('crew.tab',S.tab)}catch(e){}
  if(t==='access'&&S.admin)loadPeople();
  renderAll();window.scrollTo(0,0);
}
function setTab(t,fromHash){go(t,null,fromHash)}
function parseHash(){var h=(location.hash||'').slice(1).split('/');return {tab:h[0],loc:h[1]||null}}
function initialTab(){
  var p=parseHash(),l='';try{l=localStorage.getItem('crew.tab')||''}catch(e){}
  if(validTab(p.tab)){S.locId=p.tab==='locations'?p.loc:null;return p.tab}
  return validTab(l)?l:'locations';
}
function onHash(){if(!S.started)return;var p=parseHash();if(!validTab(p.tab))p.tab='locations';if(p.tab!==S.tab||(p.loc||null)!==(S.locId||null))go(p.tab,p.loc,true)}
window.addEventListener('popstate',onHash);window.addEventListener('hashchange',onHash);

/* ---------- slide-out menu ---------- */
function renderMenu(){
  var m=$('#menuMount');
  if(!S.menuOpen){m.innerHTML='';return}
  var counts=tabCounts(),n=0;
  var links=TABS.filter(tabVisible).map(function(t){
    n++;var c=t.count?counts[t.count]:null;
    return '<button class="mlink'+(S.tab===t.id?' cur':'')+'" style="--i:'+n+'" data-act="menu-tab" data-tab="'+t.id+'"><span class="mono mnum">'+String(n).padStart(2,'0')+'</span><span class="mname">'+esc(t.label)+'</span>'+(c!=null?'<span class="mono mcount">'+c+'</span>':'')+'</button>';
  }).join('');
  m.innerHTML='<div class="mscrim" data-act="menu-close"></div><aside class="menu" role="dialog" aria-modal="true" aria-label="Menu"><div class="menu-head"><span class="label">Menu</span><button class="btn ghost sm" id="menuClose" data-act="menu-close">Close</button></div><nav class="mlinks">'+links+'</nav><div class="menu-foot" style="--i:'+(n+1)+'"><div class="small muted">'+esc(S.email||'')+'</div><div class="row"><span class="label">Appearance</span><button class="chip" data-act="theme-set" data-v="light" aria-pressed="'+(effTheme()==='light')+'">Light</button><button class="chip" data-act="theme-set" data-v="dark" aria-pressed="'+(effTheme()==='dark')+'">Dark</button></div><div class="row">'+(S.admin?pill('Manager view','acc'):pill('Team view',''))+'<button class="btn ghost sm" data-act="signout">Sign out</button></div><div class="small muted mono">Build '+esc(BUILD)+'</div></div></aside>';
}
function openMenu(){S.menuOpen=true;renderMenu();var b=$('#menuBtn');if(b)b.setAttribute('aria-expanded','true');var c=$('#menuClose');if(c)c.focus();document.body.classList.add('noscroll')}
function closeMenu(){
  if(!S.menuOpen)return;S.menuOpen=false;document.body.classList.remove('noscroll');
  var m=$('#menuMount');m.classList.add('closing');
  setTimeout(function(){m.classList.remove('closing');if(!S.menuOpen)m.innerHTML=''},REDUCE?0:280);
  var b=$('#menuBtn');if(b){b.setAttribute('aria-expanded','false');b.focus()}
}

/* ---------- header ticker: hopping beans and little notes ---------- */
var NOTES=['tamp it like you mean it','decaf is just a rumour','shots pulled, feelings suppressed','milk steamed, ego not','grind size: ask again later','dial in. breathe. repeat.','nobody wants a cold flat white','bean there, done that','espresso yourself','life happens, coffee helps','fresh beans, fresh start','one more shot never hurt','latte art is just milk drawing','mondays need a double'];
function startTicker(){
  var el=$('#tickNote');if(!el)return;
  var i=Math.floor(Math.random()*NOTES.length);
  function show(){el.textContent=NOTES[i%NOTES.length];if(!REDUCE){el.classList.remove('swap');void el.offsetWidth;el.classList.add('swap')}i++}
  show();if(!REDUCE)setInterval(show,5200);
}

/* ---------- light / dark ---------- */
function effTheme(){var t=document.documentElement.getAttribute('data-theme');if(t==='dark'||t==='light')return t;return window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}
function themeLabel(){return effTheme()==='dark'?'Switch to light mode':'Switch to dark mode'}
function themeIcon(){return effTheme()==='dark'
  ?'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>'
  :'<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>'}
function setTheme(t){
  document.documentElement.setAttribute('data-theme',t);
  try{localStorage.setItem('crew.theme',t)}catch(e){}
  $$('meta[name="theme-color"]').forEach(function(m){m.setAttribute('content',t==='dark'?'#0c0c0b':'#ffffff')});
  var b=$('#themeBtn');if(b){b.innerHTML=themeIcon();b.setAttribute('aria-label',themeLabel());b.title=themeLabel()}
  $$('[data-act=theme-set]').forEach(function(c){c.setAttribute('aria-pressed',c.dataset.v===t?'true':'false')});
  if(S.tab==='checks'||S.tab==='overview'||S.tab==='me')schedule();
}

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

/* ---------- writes ---------- */
function upsertDoc(path,data){
  return queue(path,function(){var ref=db.doc(path);return ref.update(data).catch(function(e){if(e&&e.code==='invalid_argument'){return ref.set(data)}throw e})});
}
function addBarista(name,locId){
  var id=newId(),doc={name:name,role:'Barista',createdAt:Date.now()};if(locId)doc.locationId=locId;
  return db.doc('baristas/'+id).set(doc).then(function(){S.openId=id;S.baristasRaw.push(Object.assign({id:id},doc));rebuild();renderAll()}).catch(fail);
}
function addLocation(name){
  var id=newId(),doc={name:name,createdAt:Date.now()};
  return db.doc('locations/'+id).set(doc).then(function(){S.locations.push(Object.assign({id:id},doc));renderAll()}).catch(fail);
}
function setField(id,field,value){
  var d={};d[field]=value;
  if(PRIVATE.indexOf(field)>=0){S.staff[id]=Object.assign({},S.staff[id]||{},d);rebuild();return upsertDoc('staff/'+id,d)}
  return queue('baristas/'+id,function(){return db.doc('baristas/'+id).update(d)});
}
function rate(key,v){
  var id=S.openId;if(!id||!S.admin)return;
  var b=bget(id);if(!b)return;
  var cur=skillVal(b,key),nv=(cur===v)?null:v,sk={};sk[key]=nv;
  var full=Object.assign({},b.skills||{});if(nv==null)delete full[key];else full[key]=nv;
  S.staff[id]=Object.assign({},S.staff[id]||{},{skills:full});rebuild();renderDrawer();
  upsertDoc('staff/'+id,{skills:sk}).catch(fail);
}
function delDoc(path){return db.doc(path).delete().catch(fail)}
function getSkills(){return JSON.parse(JSON.stringify(skillsList()))}
function saveSkills(list){S.settings.skills={list:list};schedule();return queue('settings/skills',function(){return db.doc('settings/skills').set({list:list})})}
function importLocations(){
  var seen={},chain=Promise.resolve();
  S.baristasRaw.forEach(function(b){var t=String(b.location||'').trim();if(t&&!lget(b.locationId)){(seen[t]=seen[t]||[]).push(b.id)}});
  Object.keys(seen).forEach(function(name){
    var id=newId();
    chain=chain.then(function(){return db.doc('locations/'+id).set({name:name,createdAt:Date.now()})}).then(function(){
      return seen[name].reduce(function(p,bid){return p.then(function(){return db.doc('baristas/'+bid).update({locationId:id})})},Promise.resolve());
    });
  });
  chain.then(function(){toast('Locations created from your existing baristas.')}).catch(fail);
}

/* ---------- coffee checks ---------- */
function resetCheckForm(){
  ['#ckCoffee','#ckFix'].forEach(function(s){$(s).value=''});
  $('#ckDate').value=today();S.yn={checked:null,recipe:null,brew:null};syncYn();
  if(S.editing&&S.editing.coll==='checks')S.editing=null;
}
function saveCheck(){
  var msg=$('#ckMsg'),who=S.admin?$('#ckWho').value:S.myBarista;
  if(!who){msg.textContent=S.admin?'Add a barista first.':'Your account is not linked to a barista profile yet.';return}
  if(S.yn.checked==null||S.yn.recipe==null||S.yn.brew==null){msg.textContent='Answer all three questions.';return}
  var doc={date:$('#ckDate').value||today(),baristaId:who,coffee:$('#ckCoffee').value.trim(),checked:S.yn.checked,recipeProblem:S.yn.recipe,brewingWell:S.yn.brew,fix:$('#ckFix').value.trim()};
  var flag=isFlag(doc);
  if(S.editing&&S.editing.coll==='checks'){
    var patch=Object.assign({},doc);if(!S.admin)delete patch.baristaId;
    db.doc('checks/'+S.editing.id).update(patch).then(function(){resetCheckForm();msg.textContent='Changes saved.';toast('Check updated')}).catch(fail);
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
function startEdit(id){
  var e=null;S.checks.forEach(function(x){if(x.id===id)e=x});if(!e)return;
  S.editing={coll:'checks',id:id};go('checks',null,true);
  $('#ckDate').value=e.date||today();if(S.admin)$('#ckWho').value=e.baristaId;
  $('#ckCoffee').value=e.coffee||'';$('#ckFix').value=e.fix||e.taste||'';
  S.yn={checked:!!e.checked,recipe:!!e.recipeProblem,brew:e.brewingWell!==false};syncYn();
  $('#checkForm').scrollIntoView({behavior:REDUCE?'auto':'smooth',block:'start'});
}
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

/* ---------- sample data ---------- */
var SAMPLE=[
 {n:'Maya',r:'Senior barista',l:0,v:[3,3,3,3,3,2,3,3]},{n:'Dario',r:'Barista',l:0,v:[2,3,1,3,2,2,2,1]},
 {n:'Priya',r:'Barista',l:1,v:[3,2,2,2,3,3,2,2]},{n:'Tom',r:'Trainee',l:1,v:[1,1,1,2,2,1,0,0]}
];
function loadSample(){
  toast('Loading sample team…');
  var chain=Promise.resolve(),lids=[newId(),newId()],ids=[],keys=DEF_SKILLS.map(function(s){return s.k});
  ['Downtown','Harbour'].forEach(function(n,i){chain=chain.then(function(){return db.doc('locations/'+lids[i]).set({name:n,createdAt:Date.now(),sample:true})})});
  SAMPLE.forEach(function(p,i){chain=chain.then(function(){
    var id=newId();ids[i]=id;var sk={};keys.forEach(function(k,j){sk[k]=p.v[j]});
    return db.doc('baristas/'+id).set({name:p.n,role:p.r,locationId:lids[p.l],createdAt:Date.now(),sample:true}).then(function(){return db.doc('staff/'+id).set({skills:sk,sample:true})});
  })});
  [[0,0,'House espresso',1,0,1,''],[1,0,'House espresso',1,1,0,'Sour and thin, ground finer and re-pulled'],[2,1,'Single origin',1,0,1,''],[3,0,'House espresso',0,0,1,'Forgot, will check at close'],[0,2,'Batch filter',1,0,1,''],[2,0,'House espresso',1,0,1,'']].forEach(function(c,i){
    chain=chain.then(function(){return db.doc('checks/'+newId()).set({date:daysAgo(c[1]),baristaId:ids[c[0]],coffee:c[2],checked:!!c[3],recipeProblem:!!c[4],brewingWell:!!c[5],fix:c[6],createdAt:Date.now()+i,sample:true})});
  });
  chain.then(function(){toast('Sample team loaded. Remove it any time from the Locations page.')}).catch(fail);
}
function clearSample(){
  var jobs=[];
  S.baristas.filter(function(b){return b.sample}).forEach(function(b){jobs.push('baristas/'+b.id,'staff/'+b.id)});
  S.locations.filter(function(l){return l.sample}).forEach(function(l){jobs.push('locations/'+l.id)});
  S.checks.filter(function(c){return c.sample}).forEach(function(c){jobs.push('checks/'+c.id)});
  var chain=Promise.resolve();
  jobs.forEach(function(p){chain=chain.then(function(){return db.doc(p).delete()})});
  chain.then(function(){toast('Sample data removed.')}).catch(fail);
}

/* ---------- export ---------- */
function exportData(kind){
  if(S.exporting)return;
  S.exporting=true;renderSetup();
  fetchAllDocs().then(function(docs){
    var stamp=today();
    if(kind==='json'){
      download('crew-book-backup-'+stamp+'.json',new Blob([JSON.stringify({format:'crewbook-backup',version:3,exported:new Date().toISOString(),docs:docs},null,1)],{type:'application/json'}));
      toast('Backup downloaded ('+docs.length+' records)');return;
    }
    return loadSheetJs().then(function(){
      var by={};docs.forEach(function(d){(by[d.collection]=by[d.collection]||[]).push(Object.assign({id:d.id},d.data))});
      var staff={},bn={},ln={};(by.staff||[]).forEach(function(s){staff[s.id]=s});(by.baristas||[]).forEach(function(b){bn[b.id]=b});(by.locations||[]).forEach(function(l){ln[l.id]=l.name});
      var nm=function(id){return bn[id]?bn[id].name:'Former barista'},sk=skillsList(),wb=XLSX.utils.book_new();
      function add(name,rows){XLSX.utils.book_append_sheet(wb,XLSX.utils.json_to_sheet(rows.length?rows:[{Note:'No records'}]),name)}
      add('Baristas',(by.baristas||[]).sort(byName).map(function(b){var s=staff[b.id]||{},o={Name:b.name,Role:b.role,Location:ln[b.locationId]||b.location||'',Notes:s.notes||''};sk.forEach(function(k){var v=s.skills&&s.skills[k.k];o[k.n]=typeof v==='number'?v:''});return o}));
      add('Coffee checks',(by.checks||[]).sort(function(a,b){return String(b.date).localeCompare(String(a.date))}).map(function(c){return {Date:c.date,Location:ln[(bn[c.baristaId]||{}).locationId]||'',Barista:nm(c.baristaId),Coffee:c.coffee,Checked:c.checked?'Yes':'No','Recipe problem':c.recipeProblem?'Yes':'No','Brewing well':c.brewingWell===false?'No':'Yes',Notes:c.fix||c.taste||''}}));
      add('Locations',(by.locations||[]).map(function(l){return {Location:l.name}}));
      XLSX.writeFile(wb,'crew-book-'+stamp+'.xlsx');toast('Excel file downloaded');
    });
  }).catch(function(e){toast((e&&e.message)||'Export failed. Try again.')}).then(function(){S.exporting=false;if(S.tab==='setup')renderSetup()});
}

/* ---------- events ---------- */
document.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');if(!t)return;
  var act=t.dataset.act;
  if(act==='tab'){setTab(t.dataset.tab)}
  else if(act==='theme'){setTheme(effTheme()==='dark'?'light':'dark')}
  else if(act==='theme-set'){setTheme(t.dataset.v)}
  else if(act==='menu'){S.menuOpen?closeMenu():openMenu()}
  else if(act==='menu-close'){closeMenu()}
  else if(act==='menu-tab'){var mt=t.dataset.tab;closeMenu();setTimeout(function(){setTab(mt)},REDUCE?0:120)}
  else if(act==='open-loc'){go('locations',t.dataset.id)}
  else if(act==='loc-back'){go('locations',null)}
  else if(act==='goto-check'){S.ckLoc=t.dataset.loc==='_'?'':t.dataset.loc;go('checks',null)}
  else if(act==='team-loc'){S.teamLoc=t.dataset.v;renderTeam()}
  else if(act==='open-b'){S.openId=t.dataset.id;S.confirm=null;renderDrawer()}
  else if(act==='close-drawer'){S.openId=null;S.confirm=null;renderDrawer()}
  else if(act==='rate'){rate(t.dataset.key,parseInt(t.dataset.v,10))}
  else if(act==='yn'){S.yn[t.dataset.q]=t.dataset.v==='1';syncYn()}
  else if(act==='ckfilter'){S.ckFilter=t.dataset.v;$$('[data-act=ckfilter]').forEach(function(c){c.setAttribute('aria-pressed',c.dataset.v===S.ckFilter?'true':'false')});renderChecks()}
  else if(act==='signout'){sb.auth.signOut().then(function(){location.reload()},function(){location.reload()})}
  else if(act==='auth-mode'){showAuth(t.dataset.mode)}
  else if(act==='auth-refresh'){loadProfile()}
  else if(act==='person-approve'){sb.from('profiles').update({approved:t.dataset.v==='1'}).eq('id',t.dataset.id).then(function(r){if(r.error)toast('Could not update that person.');else{toast(t.dataset.v==='1'?'Approved':'Access removed');loadPeople()}})}
  else if(act==='sample-load'){loadSample()}
  else if(act==='sample-clear'){clearSample()}
  else if(act==='del'){var key=t.dataset.coll+'/'+t.dataset.id;if(S.confirm===key){S.confirm=null;if(S.editing&&S.editing.id===t.dataset.id)S.editing=null;delDoc(key).then(function(){S.checks=S.checks.filter(function(x){return x.id!==t.dataset.id});schedule()})}else{S.confirm=key;renderAll()}}
  else if(act==='del-b'){var k='b/'+t.dataset.id;if(S.confirm===k){S.confirm=null;var id=t.dataset.id,jobs=['baristas/'+id,'staff/'+id];S.checks.filter(function(c){return c.baristaId===id}).forEach(function(c){jobs.push('checks/'+c.id)});S.openId=null;var ch=Promise.resolve();jobs.forEach(function(p){ch=ch.then(function(){return db.doc(p).delete()})});ch.catch(fail)}else{S.confirm=k;var ae=document.activeElement;if(ae&&ae.blur)ae.blur();renderDrawer()}}
  else if(act==='loc-del'){var lk='loc/'+t.dataset.id;if(S.confirm===lk){S.confirm=null;delDoc('locations/'+t.dataset.id).then(function(){S.locations=S.locations.filter(function(l){return l.id!==t.dataset.id});schedule()})}else{S.confirm=lk;renderSetup()}}
  else if(act==='import-loc'){importLocations()}
  else if(act==='edit-entry'){startEdit(t.dataset.id)}
  else if(act==='cancel-edit'){resetCheckForm();S.editing=null;renderAll()}
  else if(act==='list-add'){var L=getSkills();L.push({k:'s'+newId().replace(/-/g,'').slice(0,6),n:'New skill',g:(L[L.length-1]||{}).g||'Other'});saveSkills(L)}
  else if(act==='list-del'){var kk='skills/'+t.dataset.i;if(S.confirm===kk){S.confirm=null;var L2=getSkills();L2.splice(parseInt(t.dataset.i,10),1);saveSkills(L2)}else{S.confirm=kk;renderSetup()}}
  else if(act==='list-move'){var L3=getSkills(),ix=parseInt(t.dataset.i,10),to=ix+parseInt(t.dataset.d,10);if(to>=0&&to<L3.length){var tmp=L3[ix];L3[ix]=L3[to];L3[to]=tmp;saveSkills(L3)}}
  else if(act==='export-xlsx'){exportData('xlsx')}
  else if(act==='export-json'){exportData('json')}
  else if(act==='inv-del'){sb.from('invites').delete().eq('email',t.dataset.email).then(function(){loadPeople()})}
  else if(act==='copy'){var v=t.dataset.v;(navigator.clipboard?navigator.clipboard.writeText(v):Promise.reject()).then(function(){toast('Copied')},function(){toast('Select the code and copy it by hand.')})}
});
document.addEventListener('change',function(e){
  var t=e.target;if(!db)return;
  if(t.dataset.person){sb.from('profiles').update({role:t.value}).eq('id',t.dataset.person).then(function(r){if(r.error)toast('Could not change that role.');else{toast('Role updated');loadPeople()}});return}
  if(t.dataset.personB!==undefined){sb.from('profiles').update({barista_id:t.value||null}).eq('id',t.dataset.personB).then(function(r){if(r.error)toast('Could not link that profile.');else{toast(t.value?'Login linked':'Link removed');loadPeople()}});return}
  if(t.id==='signupMode'){sb.from('app_settings').upsert({key:'signup_mode',value:t.value}).then(function(r){if(r.error)toast('Could not change that setting.');else{S.signupMode=t.value;toast(t.value==='open'?'Anyone can ask for access. You approve them.':'Sign-ups need an invite code.')}});return}
  if(t.id==='ckLoc'){S.ckLoc=t.value;renderChecks();return}
  if(t.dataset.f&&t.closest('.drawer')){
    var id=S.openId;if(!id)return;
    var v=t.value;
    if(t.dataset.f==='name'&&!String(v).trim()){toast('A name is needed.');renderDrawer();return}
    setField(id,t.dataset.f,v).catch(fail);return;
  }
  if(t.dataset.locn){var nv=t.value.trim();if(!nv){toast('A name is needed.');renderSetup();return}upsertDoc('locations/'+t.dataset.locn,{name:nv}).catch(fail);return}
  if(t.dataset.list){var L=getSkills(),it=L[parseInt(t.dataset.i,10)];if(!it)return;it[t.dataset.f]=t.value.trim();if(t.dataset.f==='n'&&!it.n)it.n='Untitled';saveSkills(L);return}
  if(t.id==='ckWho'){try{localStorage.setItem('crew.ckWho',t.value)}catch(x){}}
});
document.addEventListener('submit',function(e){
  e.preventDefault();var f=e.target;if(f.id==='authForm'){doAuth();return}if(!db)return;
  if(f.id==='addForm'){var i=$('#addName'),n=i.value.trim();if(!n){i.focus();return}var sel=$('#addLoc'),loc=sel?sel.value:(f.dataset.loc||'');i.value='';addBarista(n,loc)}
  else if(f.id==='locForm'||f.id==='locForm2'){var li=$(f.id==='locForm'?'#locName':'#locName2'),ln=li.value.trim();if(!ln){li.focus();return}li.value='';addLocation(ln)}
  else if(f.id==='checkForm')saveCheck();
  else if(f.id==='inviteForm'){
    var em=$('#invEmail').value.trim().toLowerCase();if(!/^\S+@\S+\.\S+$/.test(em)){toast('Enter a valid email address.');return}
    var al='ABCDEFGHJKMNPQRSTUVWXYZ23456789',code='',a=new Uint8Array(6);crypto.getRandomValues(a);for(var k=0;k<6;k++)code+=al[a[k]%al.length];
    sb.from('invites').upsert({email:em,code:code,role:$('#invRole').value,barista_id:$('#invBarista').value||null,used_at:null,created_at:new Date().toISOString()}).then(function(r){
      if(r.error){toast('Could not create the invite.');return}
      S.lastInvite={email:em,code:code};$('#invEmail').value='';loadPeople();
    });
  }
});
document.addEventListener('keydown',function(e){if(e.key==='Escape'){if(S.menuOpen){closeMenu();return}if(S.openId){S.openId=null;renderDrawer()}}});
window.addEventListener('online',flushQueue);

/* ---------- start ---------- */
function startApp(p){
  if(S.started)return;
  S.started=true;S.admin=p.role==='manager';S.myBarista=p.barista_id||null;S.db=true;
  S.tab=initialTab();
  if(pendTimer){clearInterval(pendTimer);pendTimer=null}
  $('#auth').hidden=true;$('#app').hidden=false;
  db=makeDb(sb);loadQueue();startTicker();
  sub('baristas','baristasRaw',null,rebuild);
  subMap('staff','staff',rebuild);
  sub('checks','checks',{sinceDays:150});
  sub('locations','locations');
  subMap('settings','settings');
  if(S.admin){loadPeople();peopleTimer=setInterval(loadPeople,20000)}
  profTimer=setInterval(function(){if(S.uid)loadProfile()},30000);
  setInterval(flushQueue,15000);flushQueue();
  schedule();
}

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
  syncYn();
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
