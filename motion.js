/* Crew Book motion layer. Purely cosmetic: everything here is skipped under prefers-reduced-motion. */
(function(){
'use strict';
var reduce=window.matchMedia&&window.matchMedia('(prefers-reduced-motion: reduce)').matches;
if(reduce||!('IntersectionObserver' in window))return;
var $=function(s,r){return (r||document).querySelector(s)};
document.documentElement.classList.add('motion');

/* 1. boot sequence, once per browser session, over the app while it loads */
var STEPS=['Initialize crew book','Connect database','Load team','Load coffee checks','Build today','Start'];
function boot(){
  try{if(sessionStorage.getItem('crew.booted'))return;sessionStorage.setItem('crew.booted','1')}catch(e){}
  var el=document.createElement('div');el.className='bootseq';el.setAttribute('aria-hidden','true');
  el.innerHTML='<div class="bs-in"><div class="bs-list mono">'+STEPS.map(function(s,i){return '<div class="bs-row" style="--i:'+i+'"><span>'+String(i+1).padStart(2,'0')+'</span> '+s.toUpperCase()+'</div>'}).join('')+'</div><div class="bs-pct mono"><b id="bsPct">0</b>%</div><div class="bs-bar"><i id="bsBar"></i></div></div>';
  document.body.appendChild(el);
  var t0=performance.now(),dur=1300,pct=$('#bsPct',el),bar=$('#bsBar',el),rows=el.querySelectorAll('.bs-row');
  (function tick(t){
    var k=Math.min(1,(t-t0)/dur),e=1-Math.pow(1-k,2),v=Math.round(e*100);
    pct.textContent=v;bar.style.transform='scaleX('+e+')';
    rows.forEach(function(r,i){r.classList.toggle('on',v>=Math.round(i/rows.length*100))});
    if(k<1)requestAnimationFrame(tick);
    else{el.classList.add('out');setTimeout(function(){el.remove()},500)}
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
  var t=e.target.closest&&e.target.closest('#nav [data-tab]');if(!t||!main)return;
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
    hx=e.clientX;hy=e.clientY;
    if(!hq){hq=true;requestAnimationFrame(function(){hq=false;hud.textContent='X:'+String(hx).padStart(4,'0')+' Y:'+String(hy).padStart(4,'0');hud.classList.add('on')})}
  });
  document.addEventListener('pointerleave',function(){hud.classList.remove('on')});
}
})();
