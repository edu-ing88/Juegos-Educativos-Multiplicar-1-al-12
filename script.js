'use strict';
/* ===== Configuración ===== */
const TOTAL = 12;            // operaciones por partida (multiplicadores 1 a 12)
const PTS = 10;              // puntos por acierto (máximo 120)
const PRAISE = ['¡Excelente!','¡Maravilloso!','¡Fantástico!','¡Eres genial!','¡Muy bien!','¡Lo lograste!'];
const $ = id => document.getElementById(id);
const wait = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random()*n);

let table = 0;  // tabla elegida (0 = ninguna)
let G = null;   // estado de la partida
let run = 0;    // identificador de ejecución: invalida temporizadores al reiniciar o salir

/* ===== Audio (Web Audio API). Solo suena un efecto a la vez ===== */
let ac = null, live = [];
function stopSound(){
  live.forEach(o=>{ try{o.stop();}catch(e){} }); live = [];
  try{ window.speechSynthesis && speechSynthesis.cancel(); }catch(e){}   // también corta la voz anterior
}
/* Voz en español (síntesis de voz del navegador, sin conexión si el equipo tiene voz instalada).
   El retraso deja terminar primero el sonido para que no se superpongan. */
function say(txt, delay=0){
  const id = run;
  setTimeout(()=>{
    if(id!==run || !window.speechSynthesis) return;
    try{
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(txt);
      u.lang = 'es-ES'; u.rate = .95; u.pitch = 1.1;
      const v = speechSynthesis.getVoices().find(x=>/^es/i.test(x.lang));
      if(v) u.voice = v;
      speechSynthesis.speak(u);
    }catch(e){}
  }, delay);
}
function play(notes, type='triangle', vol=.18){
  try{
    ac = ac || new (window.AudioContext||window.webkitAudioContext)();
    if(ac.state==='suspended') ac.resume();
    stopSound();                                   // corta el sonido anterior
    notes.forEach(([f,t,d])=>{
      const o = ac.createOscillator(), g = ac.createGain(), s = ac.currentTime+t;
      o.type = type; o.frequency.value = f; o.connect(g); g.connect(ac.destination);
      g.gain.setValueAtTime(vol,s); g.gain.exponentialRampToValueAtTime(.001,s+d);
      o.start(s); o.stop(s+d+.02); live.push(o);
    });
  }catch(e){}
}
const sCount = () => play([[660,0,.2]]);
const sGo    = () => play([[784,0,.15],[1047,.15,.3]]);
const sOk    = () => play([[523,0,.15],[659,.13,.15],[784,.26,.3]]);
const sBad   = () => play([[250,0,.25],[200,.22,.35]],'sine',.12);
const sWin   = () => play([[523,0,.18],[659,.16,.18],[784,.32,.18],[1047,.48,.2],[784,.7,.15],[1047,.85,.15],[1319,1,.6]]);

/* ===== Pantallas ===== */
function screen(id){ document.querySelectorAll('.screen').forEach(s=>s.classList.toggle('active',s.id===id)); }
function closeAll(){ document.querySelectorAll('dialog[open]').forEach(d=>d.close()); }
function home(){ run++; stopSound(); closeAll(); $('rain').innerHTML=''; $('warn').textContent=''; screen('sHome'); }

/* ===== Selector de tabla ===== */
function buildGrid(){
  $('grid').innerHTML = Array.from({length:12},(_,i)=>
    `<button class="tb" data-t="${i+1}" aria-pressed="false"><small>Tabla del</small><b>${i+1}</b></button>`).join('');
  $('grid').querySelectorAll('.tb').forEach(b=>b.onclick=()=>{
    table = +b.dataset.t; $('warn').textContent='';
    $('grid').querySelectorAll('.tb').forEach(x=>x.setAttribute('aria-pressed',x===b));   // resalta la elegida; se puede cambiar
  });
}

/* ===== Generación de operaciones =====
   12 multiplicaciones de la tabla elegida, multiplicadores 1..12 sin repetir, orden aleatorio */
function genOps(t){
  const m = Array.from({length:12},(_,i)=>i+1);
  for(let i=m.length-1;i>0;i--){ const j=rnd(i+1); [m[i],m[j]]=[m[j],m[i]]; }
  return m.map(x=>[t,x]);
}

/* ===== Inicio: cuenta regresiva 3, 2, 1 ===== */
async function begin(){
  if(!table){                                       // la tabla es obligatoria
    $('warn').textContent = '👆 Primero elige una tabla de multiplicar';
    $('grid').classList.add('shake'); setTimeout(()=>$('grid').classList.remove('shake'),400); return;
  }
  const id = ++run;
  closeAll(); $('rain').innerHTML='';
  G = {q:0, ok:0, bad:0, score:0, locked:true, ops:genOps(table), cur:null};
  screen('sCount');
  const cd = $('cd');
  for(const t of ['3','2','1']){
    cd.className=''; void cd.offsetWidth; cd.className='pop';
    cd.textContent = t; sCount();
    await wait(800); if(id!==run) return;
  }
  cd.className='go'; cd.textContent='¡COMENZAMOS!'; sGo();
  await wait(650); if(id!==run) return;
  screen('sGame'); $('tT').textContent = table; nextQ();
}

/* ===== Desarrollo del juego ===== */
function updateStats(){
  const done = G.ok+G.bad;
  $('tQ').textContent = Math.min(G.q,TOTAL);
  $('tOk').textContent = G.ok; $('tBad').textContent = G.bad; $('tScore').textContent = G.score;
  $('tPct').textContent = done ? Math.round(G.ok/done*100) : 0;
  $('bar').style.width = (done/TOTAL*100)+'%';      // avanza tras cada respuesta
}
function setLocked(v){
  G.locked = v;
  ['bSend','bReset','bExit'].forEach(id=>$(id).disabled = v);
  $('ans').readOnly = v;
}
function nextQ(){
  if(G.q>=TOTAL) return finish();
  G.cur = G.ops[G.q++];
  $('nA').textContent = G.cur[0]; $('nB').textContent = G.cur[1];
  const inp = $('ans'); inp.value=''; $('op').className='op';
  $('fb').className=''; $('fb').textContent='';
  setLocked(false); updateStats(); inp.focus();
}
function submit(){
  if(!G || G.locked) return;                       // cada operación se valida una sola vez
  const v = $('ans').value.trim();
  if(v===''){                                       // no se aceptan respuestas vacías
    $('fb').className='r'; $('fb').textContent='Escribe tu respuesta primero 😊';
    $('op').classList.add('shake'); setTimeout(()=>$('op').classList.remove('shake'),400);
    $('ans').focus(); return;
  }
  setLocked(true);
  const [a,b] = G.cur, right = a*b, id = run, fb = $('fb'), ok = Number(v)===right;
  if(ok){
    G.ok++; G.score += PTS;
    $('op').classList.add('ok'); fb.className='g';
    const msg = PRAISE[rnd(PRAISE.length)];
    fb.innerHTML = msg+' ⭐<small style="color:#2a7d0d">¡Respuesta correcta!</small>';
    sOk(); rainStars(18); say(msg+' Respuesta correcta', 600);
  }else{
    G.bad++;
    $('op').classList.add('no'); fb.className='r';
    fb.innerHTML = `¡Vamos, tú puedes!<small>${a} × ${b} = ${right}. La respuesta correcta es ${right}</small>`;
    sBad(); say(`¡Vamos, tú puedes! La respuesta correcta es ${right}`, 650);
  }
  updateStats();
  wait(ok?1700:3000).then(()=>{ if(id===run) nextQ(); });   // pausa para observar la corrección
}

/* ===== Resultados finales ===== */
function finish(){
  setLocked(true);
  const pct = Math.round(G.ok/TOTAL*100), perfect = G.ok===TOTAL;
  const d = $('dRes');
  d.innerHTML = `<h2>¡RESULTADOS DE TU PARTIDA!</h2>
  ${perfect?'<div class="trophy spin">🏆</div><div class="badge">¡Partida perfecta!</div>':'<div class="trophy">🌈</div>'}
  <table class="res" style="margin:.4rem auto">
   <tr><td>Tabla practicada</td><td>Tabla del ${table}</td></tr>
   <tr><td>Total de operaciones</td><td>${TOTAL}</td></tr>
   <tr><td>Respuestas correctas</td><td>${G.ok}</td></tr>
   <tr><td>Respuestas incorrectas</td><td>${G.bad}</td></tr>
   <tr><td>Puntaje</td><td>${G.score} / ${TOTAL*PTS}</td></tr>
   <tr><td>Porcentaje de aciertos</td><td>${pct}%</td></tr></table>
  <p class="msg">${perfect?'¡FELICITACIONES! ¡DOMINAS ESTA TABLA DE MULTIPLICAR!':'¡Vamos, tú puedes! Sigue practicando y pronto dominarás esta tabla'}</p>
  <button class="btn big" id="again">VOLVER A JUGAR</button>
  <button class="btn red" id="out">SALIR</button>`;
  d.showModal();
  $('again').onclick = home; $('out').onclick = () => { table = 0; buildGrid(); home(); };
  if(perfect){ sWin(); rainStars(90); say('¡Felicitaciones! ¡Dominas esta tabla de multiplicar!', 1900); }   // celebración solo en partida perfecta
  else say('¡Vamos, tú puedes! Sigue practicando y pronto dominarás esta tabla', 300);
}
function rainStars(n){
  const box = $('rain'), set = ['⭐','🌟','✨'];
  for(let i=0;i<n;i++){
    const e = document.createElement('i');
    e.textContent = set[rnd(3)];
    e.style.cssText = `left:${rnd(100)}%;font-size:${18+rnd(22)}px;animation-duration:${1.6+Math.random()*1.6}s;animation-delay:${Math.random()*.8}s`;
    box.appendChild(e);
  }
  setTimeout(()=>{ if(box.children.length) box.innerHTML=''; },3800);
}

/* ===== Eventos ===== */
$('bStart').onclick = begin;
$('bSend').onclick = submit;
$('ans').addEventListener('keydown',e=>{ if(e.key==='Enter'){ e.preventDefault(); submit(); } });
$('ans').addEventListener('input',e=>{ e.target.value = e.target.value.replace(/\D/g,'').slice(0,3); }); // solo enteros no negativos
$('bExit').onclick = () => $('dExit').showModal();
$('exitNo').onclick = () => { $('dExit').close(); $('ans').focus(); };
$('exitYes').onclick = () => { table = 0; buildGrid(); home(); };
$('bReset').onclick = () => $('dReset').showModal();
$('resetNo').onclick = () => { $('dReset').close(); $('ans').focus(); };
$('resetYes').onclick = begin;                     // misma tabla, nuevo orden, cuenta regresiva
$('dRes').addEventListener('cancel',e=>e.preventDefault());
buildGrid();
if(window.speechSynthesis) speechSynthesis.getVoices();   // precarga las voces
