/* Crew Book motion layer. Purely cosmetic: everything here is skipped under prefers-reduced-motion. */
(function(){
'use strict';
var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduce||!('IntersectionObserver' in window))return;
var $=function(s,r){return (r||document).querySelector(s)};
document.documentElement.classList.add('motion');

/* 1. opening animation: a V60 pour-over being brewed, once per browser session */
var V60='<svg class="v60" viewBox="0 0 200 250" role="presentation" focusable="false"><defs><clipPath id="v60clip"><path d="M64 168 L136 168 L143 238 L57 238 Z"/></clipPath></defs>'
 +'<path class="v-stream" d="M100 6 L100 74" pathLength="1"/>'
 +'<path class="v-cone" d="M48 76 L152 76 L112 156 L88 156 Z"/>'
 +'<path class="v-rim" d="M44 76 L156 76"/>'
 +'<path class="v-ridge" d="M66 80 L92 154 M82 80 L96 154 M100 80 L100 154 M118 80 L104 154 M134 80 L108 154"/>'
 +'<path class="v-bed" d="M64 90 Q100 104 136 90"/>'
 +'<path class="v-glass" d="M64 168 L136 168 L143 238 L57 238 Z"/>'
 +'<g clip-path="url(#v60clip)"><rect class="v-coffee" x="50" y="168" width="100" height="72"/></g>'
 +'<circle class="v-drip" cx="100" cy="158" r="3"/>'
 +'<path class="v-steam s1" d="M86 150 q-6 -10 0 -20 q6 -10 0 -20"/><path class="v-steam s2" d="M100 150 q-6 -12 0 -24 q6 -12 0 -24"/><path class="v-steam s3" d="M114 150 q-6 -10 0 -20 q6 -10 0 -20"/></svg>';
var STAGES=[[0,'bloom'],[.18,'pour'],[.7,'drawdown'],[.97,'ready']];
function boot(){
  try{if(sessionStorage.getItem('crew.booted'))return;sessionStorage.setItem('crew.booted','1')}catch(e){}
  var el=document.createElement('div');el.className='bootseq';el.setAttribute('aria-hidden','true');
  el.innerHTML='<div class="bs-in">'+V60+'<div class="bs-word"><span id="bsStage">bloom</span></div><div class="bs-meta mono"><span>V60 \u00b7 1:16</span><span><b id="bsG">0</b> g of 288 g</span></div></div>';
  document.body.appendChild(el);
  var t0=performance.now(),dur=3000,stage=$('#bsStage',el),g=$('#bsG',el),last='';
  (function tick(t){
    var k=Math.min(1,(t-t0)/dur),p=k<.12?k*.5:.06+((k-.12)/.88)*.94;
    el.style.setProperty('--p',p.toFixed(4));
    g.textContent=Math.round(Math.min(1,p*1.02)*288);
    var st=STAGES[0][1];STAGES.forEach(function(x){if(p>=x[0])st=x[1]});
    if(st!==last){last=st;stage.textContent=st;stage.classList.remove('sw');void stage.offsetWidth;stage.classList.add('sw')}
    if(k>=.97)el.classList.add('done');
    if(k<1)requestAnimationFrame(tick);
    else setTimeout(function(){el.classList.add('out');setTimeout(function(){el.remove()},650)},350);
  })(t0);
}
var app=$('#app');
if(app){
  var started=false,mo=new MutationObserver(function(){
    if(!started&&!app.hidden){started=true;mo.disconnect();boot()}
  });
  if(!app.hidden){started=true;boot()}else mo.observe(app,{attributes:true,attributeFilter:['hidden']});
}

/* 2. scroll reveal for things that start below the fold */
var io=new IntersectionObserver(function(es){
  es.forEach(function(e){if(e.isIntersecting){e.target.classList.remove('rv');io.unobserve(e.target)}});
},{rootMargin:'0px 0px -8% 0px'});
var queued=false;
function scan(){
  queued=false;
  document.querySelectorAll('main .card:not([data-rv]),main .person:not([data-rv]),main .stat:not([data-rv]),main .item:not([data-rv])').forEach(function(n){
    n.setAttribute('data-rv','1');
    if(n.getBoundingClientRect().top>window.innerHeight*0.95){n.classList.add('rv');io.observe(n)}
  });
}
var main=$('main');
if(main){
  new MutationObserver(function(){if(!queued){queued=true;requestAnimationFrame(scan)}}).observe(main,{childList:true,subtree:true});
  scan();
}

/* 3. tab change: content slides in */
document.addEventListener('click',function(e){
  var t=e.target.closest&&e.target.closest('.mlink, [data-act=tab]');if(!t||!main)return;
  main.classList.remove('tabin');void main.offsetWidth;main.classList.add('tabin');
  setTimeout(function(){main.classList.remove('tabin')},600);
});

/* 4. scroll progress line under the header */
var prog=document.createElement('div');prog.className='scrollbar';prog.setAttribute('aria-hidden','true');document.body.appendChild(prog);
var ticking=false;
function onScroll(){
  if(ticking)return;ticking=true;
  requestAnimationFrame(function(){
    ticking=false;var h=document.documentElement,max=h.scrollHeight-h.clientHeight;
    prog.style.transform='scaleX('+(max>0?Math.min(1,h.scrollTop/max):0)+')';
    document.querySelectorAll('.rv').forEach(function(n){if(n.getBoundingClientRect().top<window.innerHeight){n.classList.remove('rv');io.unobserve(n)}});
  });
}
window.addEventListener('scroll',onScroll,{passive:true});onScroll();

/* 5. cursor readout (mouse only) */
if(window.matchMedia('(hover: hover) and (pointer: fine)').matches){
  var hud=document.createElement('div');hud.className='hud mono';hud.setAttribute('aria-hidden','true');hud.textContent='X:0000 Y:0000';document.body.appendChild(hud);
  var hx=0,hy=0,hq=false;
  document.addEventListener('pointermove',function(e){
    hx=Math.round(e.clientX);hy=Math.round(e.clientY);
    if(!hq){hq=true;requestAnimationFrame(function(){hq=false;hud.textContent='X:'+String(hx).padStart(4,'0')+' Y:'+String(hy).padStart(4,'0');hud.classList.add('on')})}
  });
  document.addEventListener('pointerleave',function(){hud.classList.remove('on')});
}
})();
