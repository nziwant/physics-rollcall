
let audioCtx = null;
let audioUnlocked = false;
const SFX_FILES = {
  unlock: './sounds/unlock.wav',
  summon: './sounds/summon.wav',
  lock: './sounds/lock.wav'
};
const sfxPool = {};

function getSfx(name){
  if(!sfxPool[name]){
    const a = new Audio(SFX_FILES[name]);
    a.preload = 'auto';
    a.volume = 0.95;
    sfxPool[name] = a;
  }
  return sfxPool[name];
}

function playSfx(name){
  if(!settings.sound) return false;
  try{
    const base = getSfx(name);
    const a = base.cloneNode(true);
    a.volume = 0.95;
    const p = a.play();
    if(p && p.catch) p.catch(()=>{});
    return true;
  }catch(e){
    return false;
  }
}

function preloadSfx(){
  Object.keys(SFX_FILES).forEach(k=>{
    try{ getSfx(k).load(); }catch(e){}
  });
}


function getChineseVoice(){
  if(!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices ? window.speechSynthesis.getVoices() : [];
  return voices.find(v => /zh|Chinese|中文|Mandarin/i.test((v.lang||'') + ' ' + (v.name||''))) || voices[0] || null;
}

function speakText(text, opts={}){
  if(!settings.sound) return false;
  if(!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') return false;
  try{
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = 'zh-CN';
    const voice = getChineseVoice();
    if(voice) utter.voice = voice;
    utter.rate = opts.rate ?? 0.96;
    utter.pitch = opts.pitch ?? 0.92;
    utter.volume = opts.volume ?? 1;
    window.speechSynthesis.speak(utter);
    return true;
  }catch(e){
    return false;
  }
}

function speakIntro(){
  return speakText('有请爱卿——', { rate: 0.9, pitch: 0.88, volume: 1 });
}

function speakPraise(){
  return speakText('陛下万岁万岁万万岁', { rate: 0.96, pitch: 0.92, volume: 1 });
}

function ensureAudio(){
  if(!settings.sound) return false;
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if(!AudioContext) return false;
  if(!audioCtx) audioCtx = new AudioContext();
  if(audioCtx.state === 'suspended'){
    audioCtx.resume().catch(()=>{});
  }
  audioUnlocked = audioCtx.state === 'running';
  return true;
}

function soundButtonLabel(){
  return settings.sound ? '🔊 声音：开' : '🔇 声音：关';
}

function toggleSound(){
  settings.sound = !settings.sound;
  save();
  if(settings.sound){
    ensureAudio();
    preloadSfx();
    playUnlockSound();
    showToast('声音已开启');
  }else{
    try{ window.speechSynthesis?.cancel(); }catch(e){}
    showToast('声音已关闭');
  }
  render();
}

function playTone(freq=660, duration=0.08, volume=0.035, type='sine'){
  if(!settings.sound) return;
  if(!ensureAudio()) return;
  if(!audioCtx || audioCtx.state !== 'running') return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + duration + 0.02);
}

function playChord(freqs=[440,660], duration=0.12, volume=0.028, type='sine', delay=0){
  freqs.forEach(f=>setTimeout(()=>playTone(f, duration, volume, type), delay));
}

function playUnlockSound(){
  preloadSfx();
  if(playSfx('unlock')) return;
  playTone(523.25, 0.08, 0.03, 'triangle');
  setTimeout(()=>playTone(659.25, 0.08, 0.032, 'triangle'), 80);
  setTimeout(()=>playChord([783.99,1046.5], 0.14, 0.024, 'sine'), 170);
}

function playRollStart(){
  preloadSfx();
  if(speakIntro()) return;
  if(playSfx('summon')) return;
}

function playLockSound(){
  preloadSfx();
  if(playSfx('lock')) return;
  playTone(220.00, 0.06, 0.026, 'square');
  setTimeout(()=>playTone(329.63, 0.08, 0.03, 'triangle'), 55);
  setTimeout(()=>playChord([659.25,987.77], 0.14, 0.03, 'sine'), 125);
  setTimeout(()=>playChord([783.99,1174.66], 0.18, 0.034, 'triangle'), 245);
}

function playTapSound(){ /* 已按需求去掉点击音 */ }

const STORAGE_KEY = 'tgz_physics_rollcall_v1';
const $ = (id) => document.getElementById(id);
const app = $('app');
const modal = $('modal');
const modalTitle = $('modalTitle');
const modalBody = $('modalBody');
const toast = $('toast');

let state = loadState();
let currentClassId = state.currentClassId || null;
let lastCandidate = null;
let rollingTimer = null;
let settings = state.settings || { sound: true, speed: 'standard' };
let presentationMode = false;
let dismissedPwaTip = localStorage.getItem('tgz_pwa_tip_dismissed') === '1';

function isStandalone(){
  return window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true;
}
function markStandalone(){ document.body.classList.toggle('standalone', isStandalone()); }
markStandalone();
window.matchMedia?.('(display-mode: standalone)').addEventListener?.('change', markStandalone);
function dismissPwaTip(){ dismissedPwaTip=true; localStorage.setItem('tgz_pwa_tip_dismissed','1'); render(); }
function pwaTipHtml(){
  if(isStandalone() || dismissedPwaTip) return '';
  return `<div class="pwa-tip"><div><b>iPad 使用提醒</b><p>部署到网址后，用 iPad Safari 打开，点分享按钮 → 添加到主屏幕，即可像 App 一样使用。</p></div><button class="icon-btn" onclick="dismissPwaTip()">×</button></div>`;
}

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,7); }
function today(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}
function currentTime(){
  const d = new Date();
  return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}
function loadState(){
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || { classes: [], settings: {sound:true,speed:'standard'} };
  } catch {
    return { classes: [], settings:{sound:true,speed:'standard'} };
  }
}
function save(){
  state.currentClassId = currentClassId;
  state.settings = settings;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function showToast(msg){ toast.textContent = msg; toast.classList.remove('hidden'); setTimeout(()=>toast.classList.add('hidden'),1800); }
function openModal(title, html, wide=false){
  modalTitle.textContent = title;
  modalBody.innerHTML = html;
  modal.querySelector('.modal-card')?.classList.toggle('modal-wide', wide);
  modal.classList.remove('hidden');
}
function closeModal(){ modal.classList.add('hidden'); modalBody.innerHTML=''; modal.querySelector('.modal-card')?.classList.remove('modal-wide'); }
$('modalClose').onclick = closeModal;
modal.onclick = e => { if(e.target === modal) closeModal(); };

function getClass(){ return state.classes.find(c=>c.id===currentClassId); }
function ensureClassData(c){
  c.students ||= [];
  c.sessions ||= {};
  c.answered ||= {};
  c.rollLogs ||= {};
}
function todaySession(c){ ensureClassData(c); const d=today(); c.sessions[d] ||= { date:d, absentIds: [] }; return c.sessions[d]; }
function answeredSet(c){ ensureClassData(c); const d=today(); c.answered[d] ||= []; return new Set(c.answered[d]); }
function setAnswered(c, set){ ensureClassData(c); c.answered[today()] = [...set]; }
function absentSet(c){ return new Set(todaySession(c).absentIds || []); }
function presentStudents(c){ const abs = absentSet(c); return c.students.filter(s=>!abs.has(s.id)); }
function remainingStudents(c){ const ans=answeredSet(c); return presentStudents(c).filter(s=>!ans.has(s.id)); }
function rollLogList(c, date=today()){ ensureClassData(c); c.rollLogs[date] ||= []; return c.rollLogs[date]; }
function stats(c){
  const total=c.students.length;
  const absent=absentSet(c).size;
  const present=presentStudents(c).length;
  const answered=answeredSet(c).size;
  return {total, absent, present, answered, remaining: Math.max(present-answered,0), rolls: rollLogList(c).length};
}
function render(){ currentClassId && getClass() ? renderClass() : renderHome(); }

function renderHome(){
  document.body.classList.remove('presentation-mode');
  presentationMode = false;
  app.innerHTML = `
    ${pwaTipHtml()}
    <section class="panel">
      <div class="row"><div><h2>班级</h2><p class="muted">先建立班级，再导入学生名单。</p></div><button class="primary-btn" onclick="createClass()">新建班级</button></div>
    </section>
    <div class="grid home-grid" style="margin-top:18px">
      ${state.classes.length ? state.classes.map(c=>`<section class="panel class-card"><div><div class="class-title">${esc(c.name)}</div><p class="muted">${c.students?.length||0} 名学生</p></div><div class="actions"><button class="gold-btn" onclick="enterClass('${c.id}')">进入</button><button class="ghost-btn" onclick="renameClass('${c.id}')">改名</button><button class="danger-btn" onclick="deleteClass('${c.id}')">删除</button></div></section>`).join('') : `<section class="panel empty">还没有班级，先新建一个暑假班吧。</section>`}
    </div>`;
}

function renderClass(){
  const c=getClass(); ensureClassData(c); const st=stats(c);
  document.body.classList.toggle('presentation-mode', presentationMode);
  app.innerHTML = `
    ${pwaTipHtml()}
    <section class="panel class-head">
      <div class="row"><div><button class="link-btn" onclick="backHome()">← 返回班级</button><h2>${esc(c.name)}</h2><p class="muted">${today()} · 唐高祖讲物理</p></div><button class="primary-btn" onclick="openStudents()">学生管理</button></div>
    </section>
    <div class="stats">
      <div class="stat"><b>${st.total}</b><span>总人数</span></div><div class="stat"><b>${st.present}</b><span>今日出勤</span></div><div class="stat"><b>${st.absent}</b><span>未出勤</span></div><div class="stat"><b>${st.answered}</b><span>已回答</span></div><div class="stat"><b>${st.remaining}</b><span>剩余</span></div>
    </div>
    <section id="rollStage" class="panel big-stage">
      <button class="exit-presentation hidden" onclick="togglePresentationMode(false)">退出投屏</button>
      <div class="stage-mesh"></div>
      <div class="stage-scan"></div>
      <div class="wave-line"></div>
      <svg class="field-svg" viewBox="0 0 1000 420" preserveAspectRatio="none" aria-hidden="true">
        <path d="M40,210 C210,40 380,380 520,210 C650,60 820,360 960,190" />
        <path class="gold" d="M70,110 C260,250 360,70 520,190 C680,330 780,80 940,240" />
        <path d="M80,320 C260,180 400,350 560,230 C720,110 830,310 960,130" />
        <path class="gold" d="M120,60 C250,120 320,290 500,260 C690,230 760,40 920,100" />
      </svg>
      <div class="reticle"></div>
      <div class="orbit"></div><div class="orbit two"></div><div class="orbit three"></div>
      <div class="energy-core"></div>
      <div class="formula-cloud" aria-hidden="true">
        <span>F=ma</span><span>E=mc²</span><span>a=Δv/Δt</span><span>Eₖ=½mv²</span><span>v=ωr</span><span>Φ=∫E·dS</span>
      </div>
      <div class="stage-content">
        <div class="result-title">今日点卿</div>
        <div id="targetName" class="target">待命</div>
        <div class="target-sub">ENERGY FIELD · TARGET LOCKED</div>
        <div class="toolbar stage-actions">
          <button class="gold-btn" onclick="rollCall()">⚛️ 智能点卿</button><button class="ghost-btn sound-unlock-btn" onclick="toggleSound()">${soundButtonLabel()}</button>
          <button class="ghost-btn" onclick="reroll()">重新抽取</button>
        </div>
      </div>
      <div class="formula-strip"><span>F=ma</span><span>E=mc²</span><span>v=ωr</span><span>Φ=∫E·dS</span></div>
    </section>
    <div class="toolbar class-toolbar">
      <button class="primary-btn" onclick="openAttendance()">课堂签到</button>
      <button class="ghost-btn" onclick="resetRound()">本轮重置</button>
      <button class="ghost-btn" onclick="openHistory()">签到记录</button>
      <button class="ghost-btn" onclick="openRollRecords()">课堂记录</button>
      <button class="ghost-btn" onclick="togglePresentationMode(true)">投屏模式</button>
    </div>
    <section class="panel student-panel"><div class="row"><h3>学生状态</h3><span class="muted">本节已点卿 ${st.rolls} 次</span></div><div class="student-list">${renderStudentCards(c)}</div></section>`;
}

function renderStudentCards(c){
  if(!c.students.length) return `<div class="empty">暂无学生，请先导入名单。</div>`;
  const abs=absentSet(c), ans=answeredSet(c);
  return c.students.map(s=>{
    const cls=abs.has(s.id)?'absent':ans.has(s.id)?'answered':'';
    const tag=abs.has(s.id)?'未出勤':ans.has(s.id)?'已回答':'未回答';
    return `<div class="student ${cls}"><span>${esc(s.name)}</span><span class="tag">${tag}</span></div>`;
  }).join('');
}

function createClass(){
  const name=prompt('请输入班级名称，例如：高一暑假班');
  if(!name?.trim()) return;
  state.classes.push({id:uid(), name:name.trim(), students:[], sessions:{}, answered:{}, rollLogs:{}});
  save(); render();
}
function enterClass(id){ currentClassId=id; save(); render(); }
function backHome(){ currentClassId=null; save(); render(); }
function renameClass(id){ const c=state.classes.find(x=>x.id===id); const name=prompt('修改班级名称', c.name); if(!name?.trim()) return; c.name=name.trim(); save(); render(); }
function deleteClass(id){ if(!confirm('确定删除这个班级？学生和记录都会删除。')) return; state.classes=state.classes.filter(c=>c.id!==id); if(currentClassId===id) currentClassId=null; save(); render(); }

function openStudents(){
  const c=getClass();
  openModal('学生管理', `<div class="form"><textarea id="bulkNames" placeholder="每行一个姓名，例如：\n张三\n李四\n王五"></textarea><button class="primary-btn" onclick="importStudents()">批量导入并追加</button><div class="divider"></div><div id="studentManageList">${c.students.map(s=>`<div class="attendance-row"><input value="${escAttr(s.name)}" onchange="editStudent('${s.id}', this.value)"><button class="danger-btn" onclick="removeStudent('${s.id}')">删除</button></div>`).join('') || '<p class="muted">暂无学生</p>'}</div></div>`);
}
function importStudents(){
  const c=getClass();
  const names=$('bulkNames').value.split(/\n|,|，|\s{2,}/).map(x=>x.trim()).filter(Boolean);
  const existing = new Set(c.students.map(s=>s.name));
  let added = 0;
  names.forEach(name=>{ if(!existing.has(name)){ c.students.push({id:uid(),name}); existing.add(name); added++; }});
  save(); openStudents(); renderClass(); showToast(`已导入 ${added} 名学生`);
}
function editStudent(id, name){ const c=getClass(); const s=c.students.find(x=>x.id===id); if(s && name.trim()){ s.name=name.trim(); save(); renderClass(); }}
function removeStudent(id){
  const c=getClass();
  c.students=c.students.filter(s=>s.id!==id);
  Object.values(c.sessions||{}).forEach(se=>se.absentIds=(se.absentIds||[]).filter(x=>x!==id));
  Object.keys(c.answered||{}).forEach(d=>c.answered[d]=c.answered[d].filter(x=>x!==id));
  Object.keys(c.rollLogs||{}).forEach(d=>c.rollLogs[d]=c.rollLogs[d].filter(x=>x.studentId!==id));
  save(); openStudents(); renderClass();
}

function openAttendance(){
  const c=getClass(); const abs=absentSet(c);
  openModal('课堂签到', `<p class="muted">默认全部出勤，把没来的学生切换为“未出勤”。未出勤学生不会参与今日点卿。</p><div id="attendanceList">${c.students.map(s=>`<div class="attendance-row"><strong>${esc(s.name)}</strong><button class="switch ${abs.has(s.id)?'absent':''}" onclick="toggleAbsent('${s.id}', this)">${abs.has(s.id)?'未出勤':'出勤'}</button></div>`).join('') || '<p class="muted">暂无学生</p>'}</div><div class="attendance-summary" id="attendanceSummary">${attendanceSummaryText(c)}</div><div class="divider"></div><button class="primary-btn" onclick="saveAttendance()">保存签到</button>`);
}
function attendanceSummaryText(c){ const st=stats(c); return `总人数 ${st.total} · 出勤 ${st.present} · 未出勤 ${st.absent}`; }
function toggleAbsent(id, btn){
  const c=getClass(); const se=todaySession(c); const list=new Set(se.absentIds||[]);
  if(list.has(id)){
    list.delete(id); btn.textContent='出勤'; btn.classList.remove('absent');
  } else {
    list.add(id); btn.textContent='未出勤'; btn.classList.add('absent');
    const ans=answeredSet(c); ans.delete(id); setAnswered(c, ans);
    if(lastCandidate?.id === id) lastCandidate = null;
  }
  se.absentIds=[...list];
  save(); renderClass();
  const summary=$('attendanceSummary'); if(summary) summary.textContent = attendanceSummaryText(c);
}
function saveAttendance(){ const c=getClass(); todaySession(c).savedAt = new Date().toISOString(); save(); closeModal(); renderClass(); showToast('签到已保存'); }

function rollCall(){
  playRollStart();
  const c=getClass();
  if(!c.students.length){ showToast('请先导入学生'); return; }
  const pool=remainingStudents(c);
  if(!pool.length){
    if(confirm('本轮点卿完成，是否开启新一轮？')){ setAnswered(c,new Set()); lastCandidate=null; save(); renderClass(); }
    return;
  }
  animatePick(pool, (picked)=>{
    const ans=answeredSet(c); ans.add(picked.id); setAnswered(c, ans);
    lastCandidate=picked;
    addRollLog(c, picked);
    save(); renderClass();
    const finalTarget=$('targetName');
    if(finalTarget){ finalTarget.textContent=picked.name; finalTarget.classList.add('locked'); setTimeout(()=>finalTarget?.classList.remove('locked'),760); }
    setTimeout(()=>{ if(!speakPraise()) playLockSound(); }, 120);
  });
}
function addRollLog(c, picked){
  const list = rollLogList(c);
  list.push({ id: uid(), studentId: picked.id, name: picked.name, time: currentTime(), date: today() });
}
function removeLastLogFor(c, studentId){
  const list = rollLogList(c);
  for(let i=list.length-1; i>=0; i--){
    if(list[i].studentId === studentId){ list.splice(i,1); return; }
  }
}
function reroll(){
  const c=getClass();
  if(!lastCandidate){ rollCall(); return; }
  const ans=answeredSet(c); ans.delete(lastCandidate.id); setAnswered(c, ans);
  removeLastLogFor(c, lastCandidate.id);
  save(); lastCandidate=null; rollCall();
}
function animatePick(pool, done){
  const targetEl=$('targetName');
  const stage=$('rollStage');
  const ms={fast:850,standard:1450,slow:2100}[settings.speed]||1450;
  const start=Date.now();
  targetEl.classList.remove('locked');
  targetEl.classList.add('locking');
  stage?.classList.add('rolling');
  clearInterval(rollingTimer);
  const formulas=['F=ma','E=mc²','p=mv','v=ωr','W=Fs','Φ=∫E·dS','a=Δv/Δt','Ek=½mv²'];
  let tick=0;
  rollingTimer=setInterval(()=>{
    const candidate=pool[Math.floor(Math.random()*pool.length)];
    const prefix = tick % 5 === 0 ? formulas[Math.floor(Math.random()*formulas.length)] + '  ·  ' : '';
    targetEl.textContent=prefix + candidate.name;
    tick++;
    if(Date.now()-start>ms){
      clearInterval(rollingTimer);
      const picked=pool[Math.floor(Math.random()*pool.length)];
      targetEl.textContent=picked.name;
      targetEl.classList.remove('locking');
      targetEl.classList.add('locked');
      stage?.classList.remove('rolling');
      setTimeout(()=>targetEl.classList.remove('locked'),760);
      done(picked);
    }
  },58);
}
function resetRound(){ const c=getClass(); if(!confirm('清空本轮已回答记录？课堂点卿记录也会清空。')) return; setAnswered(c,new Set()); c.rollLogs[today()] = []; lastCandidate=null; save(); render(); }

function openHistory(){
  const c=getClass();
  const rows=Object.values(c.sessions||{}).sort((a,b)=>b.date.localeCompare(a.date)).map(se=>{
    const abs=new Set(se.absentIds||[]);
    const absentNames = c.students.filter(s=>abs.has(s.id)).map(s=>esc(s.name)).join('、') || '无';
    return `<div class="record-card"><div class="row"><h3>${se.date}</h3><span class="record-badge">出勤 ${c.students.length-abs.size} / ${c.students.length}</span></div><p>未出勤：${absentNames}</p></div>`;
  }).join('') || '<p class="muted">暂无签到记录</p>';
  openModal('签到记录', `<div class="actions"><button class="primary-btn" onclick="exportAttendanceCsv()">导出签到表 CSV</button></div><div class="divider"></div>${rows}`, true);
}
function exportAttendanceCsv(){
  const c=getClass();
  const dates = Object.keys(c.sessions||{}).sort();
  const rows = [['班级','日期','总人数','出勤人数','未出勤人数','未出勤学生','出勤学生']];
  dates.forEach(date=>{
    const se = c.sessions[date];
    const abs = new Set(se.absentIds||[]);
    const absentNames = c.students.filter(s=>abs.has(s.id)).map(s=>s.name).join('、') || '无';
    const presentNames = c.students.filter(s=>!abs.has(s.id)).map(s=>s.name).join('、') || '无';
    rows.push([c.name,date,c.students.length,c.students.length-abs.size,abs.size,absentNames,presentNames]);
  });
  downloadText(`${c.name}_签到记录_${today()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  showToast('签到表已导出');
}

function openRollRecords(){
  const c=getClass(); ensureClassData(c);
  const dates = Object.keys(c.rollLogs||{}).sort((a,b)=>b.localeCompare(a));
  const html = dates.length ? dates.map(date=>{
    const logs = c.rollLogs[date] || [];
    return `<div class="record-card"><div class="row"><h3>${date}</h3><span class="record-badge">${logs.length} 次点卿</span></div>${logs.length ? `<ol class="record-list">${logs.map(x=>`<li><span>${esc(x.time)}</span><strong>${esc(x.name)}</strong></li>`).join('')}</ol>` : '<p class="muted">暂无记录</p>'}</div>`;
  }).join('') : '<p class="muted">暂无课堂点卿记录</p>';
  openModal('课堂记录', `<div class="actions"><button class="primary-btn" onclick="exportRollCsv()">导出课堂记录 CSV</button></div><div class="divider"></div>${html}`, true);
}
function exportRollCsv(){
  const c=getClass();
  const rows = [['班级','日期','时间','点卿学生']];
  Object.keys(c.rollLogs||{}).sort().forEach(date=>{
    (c.rollLogs[date]||[]).forEach(log=>rows.push([c.name,date,log.time,log.name]));
  });
  downloadText(`${c.name}_课堂记录_${today()}.csv`, toCsv(rows), 'text/csv;charset=utf-8');
  showToast('课堂记录已导出');
}
function toCsv(rows){ return '\ufeff' + rows.map(row=>row.map(cell=>`"${String(cell ?? '').replace(/"/g,'""')}"`).join(',')).join('\n'); }
function downloadText(filename, content, type='text/plain;charset=utf-8'){
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),800);
}

function togglePresentationMode(on=!presentationMode){
  presentationMode = !!on;
  document.body.classList.toggle('presentation-mode', presentationMode);
  if(presentationMode){ showToast('已进入投屏模式'); }
  else { showToast('已退出投屏模式'); }
}

function openSettings(){
  openModal('设置', `<div class="form">
    <p class="muted">班级页面右侧已提供“声音开/关”快捷开关；这里也可以统一设置默认状态。</p><label>音效<select id="soundSet"><option value="on" ${settings.sound?'selected':''}>开启</option><option value="off" ${!settings.sound?'selected':''}>关闭</option></select></label>
    <label>动画速度<select id="speedSet"><option value="fast" ${settings.speed==='fast'?'selected':''}>快</option><option value="standard" ${settings.speed==='standard'?'selected':''}>标准</option><option value="slow" ${settings.speed==='slow'?'selected':''}>稍慢</option></select></label>
    <button class="primary-btn" onclick="saveSettings()">保存设置</button>
    <div class="install-card">
      <h3>iPad 主屏幕安装</h3>
      <ol>
        <li>先把本项目部署到 GitHub Pages / Vercel 等 HTTPS 网址。</li>
        <li>用 iPad 的 Safari 打开该网址。</li>
        <li>点分享按钮，选择“添加到主屏幕”。</li>
        <li>以后从桌面图标打开，体验更像 App。</li>
      </ol>
      <p class="muted"><span class="status-dot ${navigator.onLine?'':'offline'}"></span>${isStandalone()?'当前已是主屏幕 App 模式':'当前是浏览器模式'} · ${navigator.onLine?'在线':'离线'}</p>
    </div>
    <div class="backup-card">
      <h3>数据备份 / 恢复</h3>
      <p class="muted">班级、学生、签到和点卿记录都存在当前浏览器本地。换设备、清缓存、升级版本前，建议先备份。</p>
      <div class="backup-actions">
        <button class="gold-btn" onclick="downloadBackup()">一键备份全部数据</button>
        <label class="file-input">选择备份文件恢复<input id="backupFile" type="file" accept=".json,application/json" onchange="importBackupFile(this)"></label>
      </div>
      <details>
        <summary class="muted">高级：显示 / 粘贴 JSON</summary>
        <div class="form" style="margin-top:12px">
          <button class="ghost-btn" onclick="exportData()">显示/复制 JSON</button>
          <textarea id="importJson" placeholder="粘贴备份 JSON 后点击恢复"></textarea>
          <button class="ghost-btn" onclick="importData()">恢复全部数据</button>
        </div>
      </details>
    </div>
  </div>`, true);
}
$('settingsBtn').onclick=openSettings;
function saveSettings(){ settings.sound=$('soundSet').value==='on'; settings.speed=$('speedSet').value; save(); closeModal(); render(); showToast('设置已保存'); }
function exportData(){ navigator.clipboard?.writeText(JSON.stringify(state,null,2)); $('importJson').value=JSON.stringify(state,null,2); showToast('数据已复制/显示'); }
function downloadBackup(){ downloadText(`唐高祖课堂助手_数据备份_${today()}.json`, JSON.stringify(state,null,2), 'application/json;charset=utf-8'); showToast('备份文件已下载'); }
function importBackupFile(input){
  const file=input.files?.[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    try{
      const data=JSON.parse(reader.result);
      if(!Array.isArray(data.classes)) throw Error();
      if(!confirm('确定用这个备份文件恢复全部数据？当前浏览器中的数据会被覆盖。')) return;
      state=data; currentClassId=state.currentClassId||null; settings=state.settings||{sound:true,speed:'standard'};
      state.classes.forEach(ensureClassData);
      save(); closeModal(); render(); showToast('备份恢复成功');
    }catch{ showToast('备份文件格式不正确'); }
  };
  reader.readAsText(file,'utf-8');
}
function importData(){
  try{
    const data=JSON.parse($('importJson').value);
    if(!Array.isArray(data.classes)) throw Error();
    state=data; currentClassId=state.currentClassId||null; settings=state.settings||settings;
    state.classes.forEach(ensureClassData);
    save(); closeModal(); render(); showToast('恢复成功');
  }catch{ showToast('JSON 格式不正确'); }
}
function beep(){
  if(!settings.sound) return;
  try{
    const ctx=new (window.AudioContext||window.webkitAudioContext)();
    const o=ctx.createOscillator(); const g=ctx.createGain();
    o.frequency.value=660; g.gain.value=.045; o.connect(g); g.connect(ctx.destination); o.start();
    setTimeout(()=>{o.stop();ctx.close();},90);
  }catch{}
}
function esc(str=''){ return String(str).replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function escAttr(str=''){ return esc(str).replace(/`/g,'&#96;'); }

// V1.4 PWA 离线缓存：部署到 HTTPS 后生效；file:// 双击测试时不会注册。
if('serviceWorker' in navigator && location.protocol.startsWith('http')){
  window.addEventListener('load',()=>{
    navigator.serviceWorker.register('./service-worker.js').catch(()=>{});
  });
}
window.addEventListener('online',()=>showToast('已恢复在线'));
window.addEventListener('offline',()=>showToast('当前离线，可继续使用已缓存页面'));


// background particles + 物理公式/场线背景
const canvas=$('bgCanvas'), ctx=canvas.getContext('2d');
let particles=[];
let formulaGlyphs=[];
const formulaBank=['F=ma','E=mc²','p=mv','v=ωr','W=Fs','Δx=v₀t+½at²','Ek=½mv²','Φ=∫E·dS','λ=c/f'];
function resize(){
  canvas.width=innerWidth*devicePixelRatio; canvas.height=innerHeight*devicePixelRatio;
  particles=Array.from({length:88},()=>({x:Math.random()*canvas.width,y:Math.random()*canvas.height,vx:(Math.random()-.5)*.32*devicePixelRatio,vy:(Math.random()-.5)*.32*devicePixelRatio,r:(Math.random()*1.7+0.55)*devicePixelRatio}));
  formulaGlyphs=Array.from({length:20},(_,i)=>({text:formulaBank[i%formulaBank.length],x:Math.random()*canvas.width,y:Math.random()*canvas.height,vy:(.055+Math.random()*.14)*devicePixelRatio,size:(22+Math.random()*18)*devicePixelRatio,alpha:.105+Math.random()*.095}));
}
addEventListener('resize',resize); resize();
function drawFieldLines(t){
  ctx.save();
  ctx.lineWidth=1*devicePixelRatio;
  for(let k=0;k<7;k++){
    const y=(canvas.height*(k+1)/8)+Math.sin(t/900+k)*12*devicePixelRatio;
    ctx.strokeStyle=k%2?'rgba(217,184,111,.045)':'rgba(80,217,255,.055)';
    ctx.beginPath(); ctx.moveTo(0,y);
    for(let x=0;x<=canvas.width;x+=80*devicePixelRatio){ ctx.lineTo(x,y+Math.sin(x/(115*devicePixelRatio)+t/1400+k)*24*devicePixelRatio); }
    ctx.stroke();
  }
  ctx.restore();
}
function draw(){
  const t=performance.now();
  ctx.clearRect(0,0,canvas.width,canvas.height);
  drawFieldLines(t);
  ctx.save();
  formulaGlyphs.forEach(f=>{
    f.y+=f.vy; if(f.y>canvas.height+60*devicePixelRatio){f.y=-40*devicePixelRatio; f.x=Math.random()*canvas.width;}
    ctx.font=`${f.size}px ui-monospace, SFMono-Regular, Consolas, monospace`;
    ctx.fillStyle=`rgba(238,247,255,${f.alpha})`;
    ctx.shadowBlur=10*devicePixelRatio;
    ctx.shadowColor='rgba(80,217,255,.18)';
    ctx.fillText(f.text,f.x,f.y);
  });
  ctx.restore();
  ctx.fillStyle='rgba(80,217,255,.68)';
  particles.forEach(p=>{ p.x+=p.vx; p.y+=p.vy; if(p.x<0||p.x>canvas.width)p.vx*=-1; if(p.y<0||p.y>canvas.height)p.vy*=-1; ctx.beginPath(); ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); });
  ctx.strokeStyle='rgba(80,217,255,.075)';
  for(let i=0;i<particles.length;i++){
    for(let j=i+1;j<particles.length;j++){
      const a=particles[i],b=particles[j],dx=a.x-b.x,dy=a.y-b.y,d=Math.hypot(dx,dy);
      if(d<150*devicePixelRatio){ ctx.globalAlpha=1-d/(150*devicePixelRatio); ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke(); ctx.globalAlpha=1; }
    }
  }
  requestAnimationFrame(draw);
}
draw(); render();
