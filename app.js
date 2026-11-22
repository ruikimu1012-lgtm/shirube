// シルベ v6 — 行動／戦略／記録／受け取り（＋羅針盤シート・AI相棒・自動の状況カード）
import { createStore } from './store.js?v=202611222226';

/* ================= 基本 ================= */
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// 1日の区切りは朝4時（夜更かしのしめくくりが翌日扱いにならないように）
const logical = () => new Date(Date.now() - 4 * 3600e3);
const dkey = (d = logical()) => d.toLocaleDateString('sv-SE');
const now = () => Date.now();
const addDays = (n, d = logical()) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const weekKey = (d = logical()) => { const x = new Date(d); x.setDate(x.getDate() - ((x.getDay() + 6) % 7)); return dkey(x); }; // 月曜始まり
const yen = n => '¥' + Number(n || 0).toLocaleString('ja-JP');
const device = () => /iPhone|iPad|Android/i.test(navigator.userAgent) ? 'phone' : 'pc';

const COLORS = { red: '赤・表現', blue: '青・実現', green: '緑・回復' };
const COLOR_SHORT = { red: '赤', blue: '青', green: '緑' };
const col = c => (c in COLORS ? c : 'blue');
const SIZE_XP = { 1: 10, 2: 20, 3: 40 };
const TITLES = [[1, '見習い'], [3, '旅人'], [6, '冒険者'], [10, '探求者'], [15, '開拓者'], [22, '賢者'], [30, '伝説の人']];
const SRC = { claude: 'Claude Code', codex: 'Codex', phone: 'スマホ', pc: 'PC' };
const KIND = { task: 'タスク', now: 'いまの作業', mood: '気分', idea: '思いつき', memo: 'メモ' };
const STYLES = { coop: ['協', '協力', 'AIや仲間と一緒にボスを倒す'], pvp: ['対', '対戦', '過去の自分・時間と勝負'], quest: ['挑', '挑戦', '難易度ハードのクエスト'], sandbox: ['探', '自由探索', '寄り道して新しいやり方を探す'] };
const SLOTS = { morning: '朝', work: '仕事中', evening: '夕', night: '夜', any: 'いつでも' };
const STATES = {
  normal: { name: '通常', msg: '今、この瞬間の積み重ね', plan: '青5時間 ＋ 自由2時間', tip: 'バイブル通りのルーティンを遂行' },
  high: { name: '躁', msg: 'このエネルギーは、誰かの笑顔のために。', plan: '青「最低5時間」 ＋ 自由2時間', tip: '深呼吸を忘れずに' },
  low: { name: '鬱', msg: '無答流。あやふやなままでいい。', plan: '自由 7時間', tip: 'きちんとしなくて大丈夫' },
};
const MODES = {
  muteki: { name: '無敵', c: 'gold', act: '握り拳を作り、親指を下に向け突き立てる「唯我独尊ポーズ」をとり、「唯我独尊」と唱える。', msg: '唯我独尊' },
  red: { name: '赤', c: 'red', act: '胸のエンジンをひねる動作＋メロイックサイン。', msg: '世界を遊べ／ロックンロール' },
  blue: { name: '青', c: 'blue', act: '空中のスイッチを「カチッ」と入れる仕草。', msg: '殺すと俺最強' },
  green: { name: '緑', c: 'green', act: '深呼吸をしながら、風を受け流すように両手を広げる。', msg: '流れのままに（風の流れるままに）' },
  gm: { name: 'GM', c: 'violet', act: '指を「パチン」と力強く鳴らす。', msg: 'ゲーム開始' },
};
const TIMERS = { wana: { name: 'ワナ', work: 25, rest: 5 }, jissen: { name: '実践', work: 50, rest: 10 } };
const SEED_HABITS = [
  ['さんぽ', 'morning', 'green'], ['瞑想', 'morning', 'green'], ['運動', 'morning', 'red'], ['ボイトレ', 'morning', 'red'], ['計画（しおり作成）', 'morning', 'blue'],
  ['さんぽ', 'evening', 'green'], ['筋トレ', 'evening', 'red'], ['復習', 'evening', 'blue'],
  ['瞑想', 'night', 'green'], ['明日のイメージング', 'night', 'blue'],
];
const SEED_GOALS = [
  ['健康（体・心・数字）', '健康が最重要。体（食事・睡眠・運動、格闘技など実用的な体と健康寿命）、心（やりがい・楽しさ・精神的負荷）、数字（実績・他者貢献・稼いだ額）', 'green'],
  ['稼げる状態を作る', '生活保護から抜け出して稼げる状態を作る', 'blue'],
  ['アーティストとしての表現活動', 'アーティストとしての表現活動（音楽・絵・動画）', 'red'],
  ['価値観に基づく習慣', '習慣：価値観に基づく普遍的な習慣＋計画的偶発性の枠（思いつきを取り込む余白）', 'green'],
];

let store, tab = 'act';
try { tab = localStorage.getItem('shirube_tab') || 'act'; } catch {}
if (['home', 'today', 'now'].includes(tab)) tab = 'act'; if (tab === 'compass') tab = 'plan';
// 4枚のボード（左右にスワイプ／下のバー／←→キー／1〜4キー）。前に見ていたボードを覚える
// 見る場面で分ける：行動＝作業中に開きっぱなし／戦略＝優先順位と全体／記録＝見返す／受け取り＝候補の仕分け
const BOARDS = [['act', '行動'], ['plan', '戦略'], ['log', '記録'], ['inbox', '受け取り']];
if (!BOARDS.some(b => b[0] === tab)) tab = 'act';
const S = { tasks: [], inbox: [], logs: [], ideas: [], meta: [], habits: [], goals: [], reviews: [] };
const prefs = (() => { try { return JSON.parse(localStorage.getItem('shirube_prefs') || '{}'); } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem('shirube_prefs', JSON.stringify(prefs)); } catch {} };
const meta = id => S.meta.find(m => m.id === id) || {};
const todayLog = () => S.logs.find(x => x.id === dkey()) || {};
const write = p => { p?.catch?.(e => toast('保存に失敗しました：' + e.message)); return p; };
const setLog = data => write(store.set('logs', dkey(), { ...data, updatedAt: now() }));

/* ================= 時間帯の空 ================= */
const timeOfDay = (h = new Date().getHours()) => h >= 5 && h < 10 ? 'morning' : h >= 10 && h < 16 ? 'day' : h >= 16 && h < 19 ? 'evening' : 'night';
function paintSky() {
  const t = timeOfDay();
  if (document.body.dataset.time !== t) document.body.dataset.time = t;
  $('meta[name=theme-color]').content = { morning: '#fbe8d6', day: '#dcecf6', evening: '#f3c9a5', night: '#1a1f40' }[t];
}
const greet = () => ({ morning: 'おはようございます', day: 'こんにちは', evening: 'おつかれさまです', night: 'こんばんは' })[timeOfDay()];

/* ================= XP ================= */
// 完了したことから毎回計算する。取り消せば自然に戻る。罰で減ることはない
const need = l => Math.round(50 + 30 * Math.pow(l - 1, 1.3));
const taskXp = t => t.score ? (t.score.r + t.score.b + t.score.g) * 5 : (SIZE_XP[t.size] || 10);
function xpTotal() {
  let xp = 0;
  S.tasks.forEach(t => { if (t.status === 'done') xp += taskXp(t); });
  S.logs.forEach(l => { if (l.energy != null) xp += 5; xp += Object.values(l.habits || {}).filter(Boolean).length * 3; });
  xp += S.inbox.filter(x => x.status === 'accepted').length * 2;
  xp += S.reviews.filter(r => r.good || r.next).length * 20;
  return xp;
}
function levelInfo(xp) {
  let l = 1, rest = xp;
  while (rest >= need(l)) { rest -= need(l); l++; }
  return { l, rest, need: need(l), title: [...TITLES].reverse().find(([n]) => l >= n)[1] };
}
let lastLevel = null, booting = true;
function paintHud() {
  const info = levelInfo(xpTotal());
  $('#lv').textContent = info.l;
  $('#title').textContent = info.title;
  $('#xptext').textContent = moodState() === 'low' ? '今日は数字は気にしなくてOK' : `次のレベルまで ${info.need - info.rest} XP`;
  $('#xpfill').style.transform = `scaleX(${info.rest / info.need})`;
  if (lastLevel != null && info.l > lastLevel && !booting) levelUp(info);
  lastLevel = info.l;
  const n = S.inbox.filter(x => x.status === 'pending').length;
  $('#inboxBadge').hidden = !n; $('#inboxBadge').textContent = n > 99 ? '99+' : n;
}
function levelUp(info) {
  const el = document.createElement('div'); el.className = 'levelup';
  el.innerHTML = `<div><span class="muted">LEVEL UP</span><b>Lv ${info.l}</b><span>${esc(info.title)}</span></div>`;
  document.body.append(el); setTimeout(() => el.remove(), 2500);
  burst(innerWidth / 2, innerHeight / 2, 30); if (prefs.sound) chime(); buzz([30, 40, 60]);
}
function burst(x, y, n = 12) {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const cs = ['#e0675a', '#4f8fd8', '#45a879', '#f2b66b'];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('i'); s.className = 'spark';
    const a = Math.random() * Math.PI * 2, d = 40 + Math.random() * 90;
    s.style.cssText = `left:${x}px;top:${y}px;background:${cs[i % 4]};--dx:${Math.cos(a) * d}px;--dy:${Math.sin(a) * d}px`;
    document.body.append(s); setTimeout(() => s.remove(), 1200);
  }
}
let ac;
function chime(notes = [523, 659, 784, 1047]) {
  try {
    ac ||= new AudioContext();
    notes.forEach((f, i) => {
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'square'; o.frequency.value = f; g.gain.value = .045;
      o.connect(g).connect(ac.destination);
      o.start(ac.currentTime + i * .09); o.stop(ac.currentTime + i * .09 + .12);
    });
  } catch {}
}
document.addEventListener('pointerdown', () => { try { ac ||= new AudioContext(); ac.state === 'suspended' && ac.resume(); } catch {} }, { once: true, passive: true });
const buzz = p => { try { navigator.vibrate?.(p); } catch {} };

/* ================= 状態の見立て ================= */
// 本人が選んだ状態が最優先。選んでいない日は直近の気分から控えめに推測する
function moodState() {
  const t = todayLog();
  if (t.state) return t.state;
  const recent = S.logs.filter(x => x.energy != null && x.id >= dkey(addDays(-3))).sort((a, b) => b.id.localeCompare(a.id)).slice(0, 3);
  if (recent.length >= 3 && recent.every(x => x.energy >= 2)) return 'high';
  const last = t.energy != null ? t : recent[0];
  if (last && last.energy <= -1 && last.pleasant <= -1 && last.id >= dkey(addDays(-1))) return 'low';
  return 'normal';
}
let loadErr = null;
function paintBand() {
  const st = moodState(), b = $('#band');
  if (loadErr) { b.hidden = false; b.dataset.state = 'err'; b.textContent = loadErr; return; }
  const txt = st === 'high' ? '元気の高い日です。新しい約束や大きな支払いは、ひと晩おいてから。思いつきは「思いつき箱」へ。'
    : st === 'low' ? '今日は1つだけで十分です。きちんとしなくて大丈夫。休むことも緑のクエストです。' : '';
  b.hidden = !txt; b.textContent = txt; b.dataset.state = st;
}
// 数日あいたら、責めずにリセット・プロトコルを案内する
function needsReset() {
  const days = new Set([
    ...S.logs.filter(l => l.energy != null || Object.values(l.habits || {}).some(Boolean)).map(l => l.id),
    ...S.tasks.filter(t => t.doneDay).map(t => t.doneDay)]);
  if (!days.size || days.has(dkey())) return false;
  return !days.has(dkey(addDays(-1))) && !days.has(dkey(addDays(-2)));
}

/* ================= 聖典（原文のまま表示する） ================= */
let bible = null;
async function loadBible() {
  const m = meta('bible');
  if (m.seiten) { bible = m; return; }
  if (store.mode === 'local' && !bible) {
    try { const r = await fetch('private/bible.json', { cache: 'no-store' }); if (r.ok) { bible = await r.json(); render(); } } catch {}
  }
}
function bibleLines() {
  if (!bible?.seiten) return [];
  const out = []; let head = '';
  for (const l of bible.seiten.split('\n')) {
    if (/^#/.test(l)) { head = l.replace(/^#+\s*/, '').replace(/^■\s*/, '').replace(/[【】]/g, ''); continue; }
    const t = l.trim();
    if (/^\|/.test(t) || /^```/.test(t) || /^>/.test(t)) continue;
    const text = t.replace(/^[-*]\s+/, '').replace(/^\d+\.\s+/, '').replace(/\*\*/g, '');
    if (text.length < 18 || !/[。！」]/.test(text)) continue;
    out.push({ head, text });
  }
  return out;
}
let cardShift = 0;
function todaysWord() {
  const ls = bibleLines(); if (!ls.length) return null;
  let h = 0; for (const c of dkey()) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return ls[(h + cardShift) % ls.length];
}
// 小さなマークダウン表示（見出し・太字・箇条書き・表・引用）
function md(src = '') {
  const inl = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const lines = src.split('\n'), out = []; let i = 0;
  while (i < lines.length) {
    const l = lines[i];
    if (/^\s*\|/.test(l)) {
      const rows = []; while (i < lines.length && /^\s*\|/.test(lines[i])) { if (!/^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) rows.push(lines[i]); i++; }
      out.push('<div class="md-table"><table>' + rows.map((r, ri) => '<tr>' + r.trim().replace(/^\||\|$/g, '').split('|').map(c => ri ? `<td>${inl(c.trim())}</td>` : `<th>${inl(c.trim())}</th>`).join('') + '</tr>').join('') + '</table></div>');
      continue;
    }
    if (/^#{1,4}\s/.test(l)) { const n = l.match(/^#+/)[0].length; out.push(`<h${Math.min(n + 2, 6)} class="md-h">${inl(l.replace(/^#+\s*/, ''))}</h${Math.min(n + 2, 6)}>`); }
    else if (/^\s*([-*]|\d+\.)\s/.test(l)) { const ind = l.match(/^\s*/)[0].length; out.push(`<p class="md-li" style="padding-left:${12 + ind * 4}px">${inl(l.replace(/^\s*([-*]|\d+\.)\s/, ''))}</p>`); }
    else if (/^>/.test(l)) out.push(`<p class="md-note">${inl(l.replace(/^>\s?/, ''))}</p>`);
    else if (/^---/.test(l)) out.push('<hr>');
    else if (l.trim()) out.push(`<p>${inl(l)}</p>`);
    i++;
  }
  return out.join('');
}

/* ================= 画面 ================= */
const views = { act: viewAct, plan: viewPlan, inbox: viewInbox, log: viewLog };
function render() {
  paintHud(); paintBand();
  document.querySelectorAll('.dock button').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'); });
  const drafts = {};
  document.querySelectorAll('#view [data-form] input[name], #view [data-form] textarea[name]').forEach(e => { if (e.type !== 'checkbox' && e.value && e.dataset.typed) drafts[e.closest('[data-form]').dataset.form + '|' + e.name] = e.value; });
  const openD = [...document.querySelectorAll('#view details[open] summary')].map(x => x.textContent);
  $('#view').innerHTML = views[tab]();
  for (const [k, v] of Object.entries(drafts)) { const [f, n] = k.split('|'); const e = $(`#view [data-form="${f}"] [name="${n}"]`); if (e) { e.value = v; e.dataset.typed = '1'; } }
  document.querySelectorAll('#view details summary').forEach(x => { if (openD.includes(x.textContent)) x.parentElement.open = true; });
  $('#fab').hidden = !['act', 'plan'].includes(tab);
  const i = BOARDS.findIndex(b => b[0] === tab);
  const dots = $('#dots'); if (dots) dots.innerHTML = BOARDS.map((b, j) => `<button class="${j === i ? 'on' : ''}" data-act="go" data-v="${b[0]}" aria-label="${b[1]}"></button>`).join('');
  tickTimer();
}

function ago(ts, suffix = '前から') {
  if (!ts) return '';
  const m = Math.round((now() - ts) / 60000);
  if (m < 1) return 'たった今';
  if (m < 60) return `${m}分${suffix}`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}時間${m % 60 ? (m % 60) + '分' : ''}${suffix}` : `${Math.floor(h / 24)}日${suffix}`;
}
const todayTasks = () => {
  const k = dkey();
  return S.tasks.filter(t => t.today && t.today <= k && (t.status === 'todo' || (t.status === 'done' && t.doneDay === k)))
    .sort((a, b) => (a.status === 'done') - (b.status === 'done') || (b.urgency || 0) - (a.urgency || 0) || (a.createdAt || 0) - (b.createdAt || 0));
};
const activeHabits = () => S.habits.filter(h => !h.archived).sort((a, b) => Object.keys(SLOTS).indexOf(a.slot) - Object.keys(SLOTS).indexOf(b.slot) || (a.order || 0) - (b.order || 0));



/* ================= v6 のボード ================= */
// ---- 行動：作業中に開きっぱなしにする（いまやること・今日のクエスト・日課） ----
function viewAct() {
  const st = moodState(), mode = meta('mode'), ai = meta('ai');
  const aiFresh = ai.text && now() - (ai.updatedAt || 0) < 3 * 3600e3;
  const fresh = !prefs.onboarded && (!S.tasks.length || !S.habits.length || !S.goals.length);
  const list = todayTasks(), todo = list.filter(t => t.status === 'todo'), doneN = list.length - todo.length;
  const shown = st === 'low' ? list.filter(t => t.status === 'done').concat(todo.slice(0, 1)) : list;
  const laterN = S.tasks.filter(t => t.status === 'todo' && !t.today).length;
  const t = todayLog(), tod = timeOfDay(), h = new Date().getHours();
  const ritualMorning = (tod === 'morning' || tod === 'day') && t.energy == null, ritualNight = h >= 20 || h < 3;
  return `
  <div class="col">
    <div class="greet"><span>${greet()}</span><small>${new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</small>
      <button class="state-pill s-${st}" data-act="compass-open">${STATES[st].name}${mode.mode && MODES[mode.mode] ? `・${MODES[mode.mode].name}モード` : ''}</button></div>
    ${fresh ? onboarding() : ''}
    ${needsReset() ? `<section class="card reset"><div class="eyebrow">リセット・プロトコル</div>
      <p>ルーティンが崩れた時は、「翌朝の散歩と瞑想」を完了させた時点でOSが完全に再起動（リセット）されたとみなす。</p>
      <p class="muted" style="margin-top:6px">何日空いても、記録は1つも減っていません。</p></section>` : ''}
    ${nowCard()}
    <section class="card">
      <div class="eyebrow">今日のクエスト <small>${list.length ? `${doneN} / ${list.length} 達成` : ''}${todo.length > 3 && st !== 'low' ? '・3つで十分です' : ''}</small></div>
      ${list.length ? `<div class="progress"><i style="transform:scaleX(${doneN / list.length})"></i></div>` : ''}
      ${shown.length ? shown.map(x => taskRow(x)).join('') : '<div class="empty">まだありません。下に書くか、「戦略」ボードの目標から＋で今日へ</div>'}
      ${st === 'low' && todo.length > 1 ? `<div class="muted" style="margin-top:8px">ほかの${todo.length - 1}件は今日は隠しています（鬱の日モード）</div>` : ''}
      ${list.length && !todo.length ? '<div class="clear-all">今日のクエスト、ぜんぶ達成。🎉</div>' : ''}
      <form class="field quick" data-form="quick"><input name="t" placeholder="＋ 今日のクエストを足す" autocomplete="off" enterkeyhint="done"><button class="btn primary" aria-label="足す">足す</button></form>
      ${laterN && st !== 'low' ? `<button class="link-row" data-act="go" data-v="plan">あとでの${laterN}件は「戦略」ボードに <span>→</span></button>` : ''}
    </section>
  </div>
  <div class="col">
    ${ritualMorning ? `<section class="card ritual"><div class="eyebrow">朝の儀 <small>2タップで終わります</small></div>
      <p class="muted">ゆうべの睡眠</p>${sleepChips(t)}
      <p class="muted" style="margin-top:12px">いまの気分は？</p>
      <div class="quick-mood">${[[2, 2, '絶好調'], [1, 1, 'いい感じ'], [0, 0, 'ふつう'], [-1, -1, 'いまいち'], [-2, -2, 'しんどい']].map(([e, p, w]) => `<button data-act="mood" data-e="${e}" data-p="${p}" style="--m:${moodColor(e, p)}"><i></i>${w}</button>`).join('')}</div></section>` : ''}
    ${habitsCard()}
    ${aiFresh ? `<section class="card ai-card"><div class="ai-dot">AI</div><div style="min-width:0">
        <div class="eyebrow">ターミナルで進行中 <small>${esc(SRC[ai.tool] || ai.tool || '')}・${ago(ai.updatedAt, '前')}</small></div>
        <div>${esc(ai.text)}</div>${ai.project ? `<div class="muted">${esc(ai.project)}</div>` : ''}</div></section>` : ''}
    <section class="card">
      <div class="eyebrow">思いついたら投げ込む <small>あとで受け取り箱で仕分け</small></div>
      <form data-form="memo"><div class="memo-wrap"><textarea class="full" name="t" rows="2" placeholder="タスクでも、思いつきでも、気持ちでも"></textarea>
      ${speechOK ? `<button type="button" class="mic" data-act="mic" aria-label="声で入力"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : ''}</div>
      <div class="row end"><button class="btn primary">受け取り箱へ</button></div></form>
    </section>
    ${ritualNight ? `<section class="card ritual"><div class="eyebrow">夜のしめくくり</div>
      <form data-form="night"><input class="full" name="t" value="${esc(t.night || '')}" placeholder="今日いちばん良かったこと、ひとことだけ" autocomplete="off" enterkeyhint="done">
      <div class="row end"><button class="btn primary">しめくくる</button></div></form></section>` : ''}
  </div>`;
}

// ---- 戦略：価値観 → 目標ごとの列（Boards のように）→ 自動で更新される状況 ----
let tutorToday = null, tutorAt = 0;
function loadTutor() {
  if (!store.readOther || Date.now() - tutorAt < 30 * 60e3) return; tutorAt = Date.now();
  store.readOther('ai-tutor-data', `briefs/${new Date().toLocaleDateString('sv-SE')}.json`).then(b => { if (b) { tutorToday = b; if (tab === 'plan') safeRender(); } }).catch(() => {});
}
function kanban() {
  const low = moodState() === 'low';
  const gs = S.goals.filter(g => !g.archived).sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0));
  const k = dkey();
  const card = t => `<div class="kcard c-${col(t.color)}"><button class="kc-body" data-act="task-edit" data-id="${t.id}">${t.today && t.today <= k ? '<span class="kc-tag">今日</span>' : ''}${esc(t.title)}${t.steps?.length ? `<small>ステップ ${t.steps.filter(x => x.done).length}/${t.steps.length}</small>` : ''}</button>
    ${t.today && t.today <= k ? '' : `<button class="kc-today" data-act="to-today" data-id="${t.id}" aria-label="今日へ">今日へ</button>`}</div>`;
  const cols = gs.map(g => {
    const ts = S.tasks.filter(t => t.goalId === g.id && t.status !== 'stored'), d = ts.filter(t => t.status === 'done').length;
    const todo = ts.filter(t => t.status === 'todo').sort((a, b) => (!!(b.today && b.today <= k) - !!(a.today && a.today <= k)) || (b.urgency || 0) - (a.urgency || 0));
    return `<div class="kcol c-${col(g.color)}">
      <button class="kcol-head" data-act="goal-open" data-id="${g.id}"><span class="dot"></span><b>${esc(g.title)}</b><span class="goal-n">${ts.length ? `${d}/${ts.length}` : ''}</span></button>
      ${ts.length ? `<div class="progress thin"><i style="transform:scaleX(${d / ts.length})"></i></div>` : ''}
      ${todo.length ? todo.slice(0, low ? 1 : 8).map(card).join('') : '<div class="kc-empty">次の一手がまだありません</div>'}
      ${todo.length > 8 && !low ? `<button class="kc-more" data-act="goal-open" data-id="${g.id}">ほか${todo.length - 8}件</button>` : ''}
      ${low ? '' : `<div class="kcol-acts"><button class="btn sm ai-btn" data-act="ai-goal" data-id="${g.id}">✦ AIで分ける</button><button class="btn sm ghost" data-act="goal-add-task" data-id="${g.id}" aria-label="自分で足す">＋</button></div>`}
    </div>`;
  });
  const loose = S.tasks.filter(t => t.status === 'todo' && !t.goalId && !t.today).sort((a, b) => (b.urgency || 0) - (a.urgency || 0) || (b.createdAt || 0) - (a.createdAt || 0));
  if (loose.length && !low) cols.push(`<div class="kcol loose"><div class="kcol-head"><span class="dot"></span><b>あとで（目標なし）</b><span class="goal-n">${loose.length}</span></div>${loose.slice(0, 10).map(card).join('')}${loose.length > 10 ? `<div class="kc-empty">ほか${loose.length - 10}件</div>` : ''}</div>`);
  if (!gs.length) return `<section class="card"><div class="eyebrow">目標</div><div class="empty">まだ目標がありません。目標を入れると、ここに目標ごとの列ができます</div>
    <div class="row"><button class="btn primary" data-act="seed-goals">目標一覧から入れる</button><button class="btn" data-act="goal-new">自分で書く</button></div></section>`;
  return `<section class="card kanban-card"><div class="eyebrow">目標とクエスト <small>${low ? '今日は1つずつだけ' : '横にスクロール・カードを押すと開く'}</small><button class="eyebrow-act" data-act="goal-new">＋ 目標</button></div>
    <div class="kanban no-swipe">${cols.join('')}</div></section>`;
}
function statusCards() {
  const pj = meta('status-projects'), os = meta('status-kimuraos'), tu = tutorToday;
  const list = (pj.list || []).slice(0, 8);
  const today = new Date(now() - 4 * 3600e3).toLocaleDateString('sv-SE');
  return `
    <section class="card">
      <div class="eyebrow">進行中の取り組み <small>${pj.updatedAt ? `会話から自動・${ago(pj.updatedAt, '前に更新')}` : '会話から自動で更新されます'}</small></div>
      ${list.length ? list.map(p => `<div class="proj"><div class="proj-top"><b>${esc(p.project)}</b>${p.stage ? `<span class="stage">${esc(p.stage)}</span>` : ''}<span class="muted proj-t">${ago(p.updatedAt, '前')}</span></div>
        <div class="proj-s">${esc(p.status)}</div>${p.next ? `<div class="proj-n"><span>次</span>${esc(p.next)}</div>` : ''}</div>`).join('')
        : '<div class="empty">Claude Code・Codexで話した取り組みが、30分ごとにここへ並びます（a-TOPは除く）</div>'}
    </section>
    <section class="card">
      <div class="eyebrow">木村OS <small>${os.date ? (os.date === today ? '今朝の作戦会議' : `${esc(os.date)}の作戦会議`) : '朝の作戦会議から自動'}</small></div>
      ${(os.three || []).length ? `<ol class="os-three">${os.three.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '<div class="empty">毎朝7時の作戦会議のあと、今日の3つがここに出ます</div>'}
      ${os.asks ? `<div class="os-asks">判断待ち <b>${os.asks}</b>件 <span class="muted">（7:30・20:00の承認ウィンドウ）</span></div>` : ''}
    </section>
    <section class="card">
      <div class="eyebrow">AI家庭教師 <small>${tu ? '今日の号' : '今日の号はまだ'}</small><a class="eyebrow-act" href="https://ruikimu1012-lgtm.github.io/ai-tutor/" target="_blank" rel="noopener">ひらく ↗</a></div>
      ${tu ? `<p class="tutor-head">${esc(tu.headline || '')}</p>${tu.lesson?.title ? `<p class="muted">今日のミニ講座：${esc(tu.lesson.title)}</p>` : ''}` : '<div class="empty">毎朝6:35ごろに届きます</div>'}
    </section>`;
}
function viewPlan() {
  loadTutor();
  const word = todaysWord();
  return `
  <div class="wide">
    <section class="card values-hero">
      <div class="eyebrow">価値観 <button class="eyebrow-act" data-act="compass-open">羅針盤をひらく</button></div>
      <div class="three">${valueWords().map(w => `<span>${esc(w)}</span>`).join('')}</div>
      ${word ? `<p class="hero-word">${esc(word.text)}</p><p class="muted hero-src">${esc(word.head)}（聖典）</p>` : ''}
    </section>
    ${kanban()}
  </div>
  <div class="col">
    ${statusCards()}
  </div>
  <div class="col">
    <section class="card buddy">
      <div class="eyebrow">相棒に聞く <small>${store.ask ? 'MacのClaudeが答えます' : 'クラウドにつなぐと使えます'}</small></div>
      <form class="field" data-form="askAI"><input name="t" placeholder="例：今週なにを優先する？" autocomplete="off" enterkeyhint="send"><button class="btn primary">聞く</button></form>
      ${chat.length ? `<div class="row"><button class="btn sm" data-act="chat-open">${chatBusy ? '答えを待っています…' : '続きを見る'}（${chat.filter(m => m.role === 'user').length}）</button></div>` : ''}
      <div class="chips no-swipe">${['今週なにを優先する？', '目標の中で、いま一番効く一手は？', '今の自分に合う休み方は？'].map(q => `<button type="button" class="chip" data-act="ask-quick" data-v="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    </section>
    ${summaryCard()}
  </div>`;
}

/* ---------- 旧ボード1（v5・部品として残す） ---------- */
/* ---------- ボード1：ひと目で分かる（価値観 → 目標 → いまやること） ---------- */
// 価値観の3語は原文の行をそのまま使う（言い換えない）。読めない時は原文と同じ3語
function valueWords() {
  const v = bible?.values; if (!v) return ['おもろさ', '無敵', '自然'];
  const lines = v.split('\n').map(l => l.trim()).filter(l => l && !/^[#>]/.test(l));
  const out = []; for (const raw of lines) { if (/^\p{Extended_Pictographic}/u.test(raw)) break; const l = raw.replace(/^[-・]\s*/, ''); if (!l || l.length > 12) break; out.push(l); }
  return out.length ? out : ['おもろさ', '無敵', '自然'];
}
function nowCard() {
  const n = meta('now');
  const open = todayTasks().filter(x => x.status === 'todo' && x.id !== n.taskId);
  return `<section class="card now-card ${n.text ? 'active' : ''}">
      <div class="eyebrow">いまやってること</div>
      ${n.text ? `<h2 class="big">${esc(n.text)}</h2>
        <div class="now-meta"><span class="pulse"></span>${ago(n.since)}</div>
        ${timerBlock(n)}
        <div class="row">
          ${n.taskId ? `<button class="btn primary" data-act="now-done">終わった！</button>` : ''}
          <button class="btn" data-act="now-edit">変える</button>
          <button class="btn ghost" data-act="now-clear">ひと区切り</button>
        </div>`
      : `<form class="field" data-form="now"><input name="t" placeholder="いま、何をやる？" autocomplete="off" enterkeyhint="go"><button class="btn primary">始める</button></form>
        ${open.length ? `<div class="pick-label">今日のクエストから選ぶ</div><div class="pick">${open.slice(0, moodState() === 'low' ? 1 : 3).map(x => `<button data-act="now-from" data-id="${x.id}"><span class="dot c-${col(x.color)}"></span><span>${esc(x.title)}</span><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>`).join('')}</div>` : ''}`}
    </section>`;
}
function goalBoard() {
  const gs = S.goals.filter(g => !g.archived).sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0));
  if (!gs.length) return `<section class="card"><div class="eyebrow">目標</div><div class="empty">まだ目標がありません。目標を入れると、そのためのクエストがここに並びます</div>
    <div class="row"><button class="btn primary" data-act="seed-goals">目標一覧から入れる</button><button class="btn" data-act="goal-new">自分で書く</button></div></section>`;
  const low = moodState() === 'low'; let shownNext = false;
  return `<section class="card goals-board">
    <div class="eyebrow">目標と、次の一手 ${low ? '<small>今日は1つだけ</small>' : ''}<button class="eyebrow-act" data-act="goal-new">＋ 目標</button></div>
    ${gs.map(g => {
      const ts = S.tasks.filter(t => t.goalId === g.id && t.status !== 'stored'), d = ts.filter(t => t.status === 'done').length;
      const next = ts.filter(t => t.status === 'todo').sort((a, b) => (!!b.today - !!a.today) || (b.urgency || 0) - (a.urgency || 0))[0];
      return `<div class="gb c-${col(g.color)}">
        <button class="gb-head" data-act="goal-open" data-id="${g.id}"><span class="dot"></span><b>${esc(g.title)}</b><span class="goal-n">${ts.length ? `${d}/${ts.length}` : ''}</span></button>
        ${ts.length ? `<div class="progress thin"><i style="transform:scaleX(${d / ts.length})"></i></div>` : ''}
        ${low && (shownNext || !next) ? '' : next ? (shownNext = true, `<div class="gb-next"><span class="muted">次</span><button class="gb-q" data-act="task-edit" data-id="${next.id}">${esc(next.title)}</button><button class="t-play sm" data-act="now-from" data-id="${next.id}" aria-label="いまやる"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></button></div>`)
          : `<div class="gb-next"><span class="muted">次の一手がまだありません</span></div>`}
        ${low ? '' : `<div class="gb-acts"><button class="btn sm ai-btn" data-act="ai-goal" data-id="${g.id}">✦ AIに分けてもらう</button><button class="btn sm ghost" data-act="goal-add-task" data-id="${g.id}">＋ 自分で足す</button></div>`}
      </div>`;
    }).join('')}
  </section>`;
}
function viewHome() {
  const st = moodState(), mode = meta('mode'), ai = meta('ai'), word = todaysWord();
  const aiFresh = ai.text && now() - (ai.updatedAt || 0) < 3 * 3600e3;
  const fresh = !prefs.onboarded && (!S.tasks.length || !S.habits.length || !S.goals.length);
  const list = todayTasks(), todo = list.filter(t => t.status === 'todo'), doneN = list.length - todo.length;
  const top = (st === 'low' ? todo.slice(0, 1) : todo.slice(0, 3));
  return `
  <div class="col">
    <div class="greet"><span>${greet()}</span><small>${new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</small>
      <button class="state-pill s-${st}" data-act="compass-open">${STATES[st].name}${mode.mode && MODES[mode.mode] ? `・${MODES[mode.mode].name}モード` : ''}</button></div>
    ${fresh ? onboarding() : ''}
    ${needsReset() ? `<section class="card reset"><div class="eyebrow">リセット・プロトコル</div>
      <p>ルーティンが崩れた時は、「翌朝の散歩と瞑想」を完了させた時点でOSが完全に再起動（リセット）されたとみなす。</p>
      <p class="muted" style="margin-top:6px">何日空いても、記録は1つも減っていません。</p></section>` : ''}
    <section class="card values-hero">
      <div class="eyebrow">価値観 <button class="eyebrow-act" data-act="compass-open">羅針盤をひらく</button></div>
      <div class="three">${valueWords().map(w => `<span>${esc(w)}</span>`).join('')}</div>
      ${word ? `<p class="hero-word">${esc(word.text)}</p><p class="muted hero-src">${esc(word.head)}（聖典）</p>` : ''}
    </section>
    ${nowCard()}
    <section class="card">
      <div class="eyebrow">今日やること <small>${list.length ? `${doneN} / ${list.length} 達成` : ''}</small><button class="eyebrow-act" data-act="go" data-v="act">すべて →</button></div>
      ${list.length ? `<div class="progress"><i style="transform:scaleX(${doneN / list.length})"></i></div>` : ''}
      ${top.length ? top.map(t => taskRow(t)).join('') : list.length ? '<div class="clear-all">今日のクエスト、ぜんぶ達成。🎉</div>' : '<div class="empty">まだありません。下に書くか、目標の「AIに分けてもらう」から</div>'}
      ${st === 'low' && todo.length > 1 ? `<div class="muted" style="margin-top:8px">今日は1つだけ見せています（鬱の日モード）</div>` : ''}
      <form class="field quick" data-form="quick"><input name="t" placeholder="＋ 今日のクエストを足す" autocomplete="off" enterkeyhint="done"><button class="btn primary" aria-label="足す">足す</button></form>
    </section>
  </div>
  <div class="col">
    ${goalBoard()}
    <section class="card buddy">
      <div class="eyebrow">相棒に聞く <small>${store.ask ? 'MacのClaudeが答えます' : 'クラウドにつなぐと使えます'}</small></div>
      <form class="field" data-form="askAI"><input name="t" placeholder="例：今日なにから手をつける？" autocomplete="off" enterkeyhint="send"><button class="btn primary">聞く</button></form>
      ${chat.length ? `<div class="row"><button class="btn sm" data-act="chat-open">${chatBusy ? '答えを待っています…' : '続きを見る'}（${chat.filter(m => m.role === 'user').length}）</button></div>` : ''}
      <div class="chips no-swipe">${['今日なにから手をつける？', '今の自分に合う休み方は？', '目標に向けて、今週やるべき1つは？'].map(q => `<button type="button" class="chip" data-act="ask-quick" data-v="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    </section>
    ${aiFresh ? `<section class="card ai-card"><div class="ai-dot">AI</div><div style="min-width:0">
        <div class="eyebrow">ターミナルで進行中 <small>${esc(SRC[ai.tool] || ai.tool || '')}・${ago(ai.updatedAt, '前')}</small></div>
        <div>${esc(ai.text)}</div>${ai.project ? `<div class="muted">${esc(ai.project)}</div>` : ''}</div></section>` : ''}
  </div>`;
}

/* ---------- 旧「いま」（今日ボードの部品として使う） ---------- */
function viewNow() {
  const n = meta('now'), ai = meta('ai'), mode = meta('mode'), st = moodState(), t = todayLog();
  const aiFresh = ai.text && now() - (ai.updatedAt || 0) < 3 * 3600e3;
  const open = todayTasks().filter(x => x.status === 'todo' && x.id !== n.taskId);
  const fresh = !prefs.onboarded && (!S.tasks.length || !S.habits.length || !S.goals.length);
  const tod = timeOfDay(), h = new Date().getHours();
  const ritualMorning = (tod === 'morning' || tod === 'day') && t.energy == null;
  const ritualNight = h >= 20 || h < 3;
  const word = todaysWord();
  return `
  <div class="col">
    <div class="greet"><span>${greet()}</span><small>${new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</small>
      <button class="state-pill s-${st}" data-act="compass-open">${STATES[st].name}${mode.mode && MODES[mode.mode] ? `・${MODES[mode.mode].name}モード` : ''}</button></div>
    ${fresh ? onboarding() : ''}
    ${needsReset() ? `<section class="card reset"><div class="eyebrow">リセット・プロトコル</div>
      <p>ルーティンが崩れた時は、「翌朝の散歩と瞑想」を完了させた時点でOSが完全に再起動（リセット）されたとみなす。</p>
      <p class="muted" style="margin-top:6px">何日空いても、記録は1つも減っていません。</p></section>` : ''}
    <section class="card now-card ${n.text ? 'active' : ''}">
      <div class="eyebrow">いまやってること</div>
      ${n.text ? `<h2 class="big">${esc(n.text)}</h2>
        <div class="now-meta"><span class="pulse"></span>${ago(n.since)}</div>
        ${timerBlock(n)}
        <div class="row">
          ${n.taskId ? `<button class="btn primary" data-act="now-done">終わった！</button>` : ''}
          <button class="btn" data-act="now-edit">変える</button>
          <button class="btn ghost" data-act="now-clear">ひと区切り</button>
        </div>`
      : `<form class="field" data-form="now"><input name="t" placeholder="いま、何をやる？" autocomplete="off" enterkeyhint="go"><button class="btn primary">始める</button></form>
        ${open.length ? `<div class="pick-label">今日のクエストから選ぶ</div><div class="pick">${open.slice(0, 3).map(x => `<button data-act="now-from" data-id="${x.id}"><span class="dot c-${col(x.color)}"></span><span>${esc(x.title)}</span><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></button>`).join('')}</div>` : ''}`}
    </section>
    ${aiFresh ? `<section class="card ai-card"><div class="ai-dot">AI</div><div style="min-width:0">
        <div class="eyebrow">ターミナルで進行中 <small>${esc(SRC[ai.tool] || ai.tool || '')}・${ago(ai.updatedAt, '前')}</small></div>
        <div>${esc(ai.text)}</div>${ai.project ? `<div class="muted">${esc(ai.project)}</div>` : ''}</div></section>` : ''}
    ${ritualMorning ? `<section class="card ritual"><div class="eyebrow">朝の儀 <small>2タップで終わります</small></div>
      <p class="muted">ゆうべの睡眠</p>${sleepChips(t)}
      <p class="muted" style="margin-top:12px">いまの気分は？</p>
      <div class="quick-mood">${[[2, 2, '絶好調'], [1, 1, 'いい感じ'], [0, 0, 'ふつう'], [-1, -1, 'いまいち'], [-2, -2, 'しんどい']].map(([e, p, w]) => `<button data-act="mood" data-e="${e}" data-p="${p}" style="--m:${moodColor(e, p)}"><i></i>${w}</button>`).join('')}</div>
      <p class="muted" style="margin-top:8px;font-size:11px">細かく残したい時は「記録」ボードのマスで</p></section>` : ''}
    ${ritualNight ? `<section class="card ritual"><div class="eyebrow">夜のしめくくり</div>
      <form data-form="night"><input class="full" name="t" value="${esc(t.night || '')}" placeholder="今日いちばん良かったこと、ひとことだけ" autocomplete="off" enterkeyhint="done">
      <div class="row end"><button class="btn primary">しめくくる</button></div></form></section>` : ''}
  </div>
  <div class="col">
    ${word ? `<section class="card word"><div class="eyebrow">今日の言葉 <small>${esc(word.head)}</small></div><p class="word-text">${esc(word.text)}</p></section>` : ''}
    <section class="card">
      <div class="eyebrow">思いついたら投げ込む</div>
      <form data-form="memo"><div class="memo-wrap"><textarea class="full" name="t" rows="3" placeholder="タスクでも、思いつきでも、気持ちでも。あとで受け取り箱で仕分けます"></textarea>
      ${speechOK ? `<button type="button" class="mic" data-act="mic" aria-label="声で入力"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : ''}</div>
      <div class="row end"><button class="btn primary">受け取り箱へ</button></div></form>
    </section>
    ${summaryCard()}
  </div>`;
}
function onboarding() {
  const st = [activeHabits().length > 0, S.goals.some(g => !g.archived), S.tasks.length > 0];
  const step = (i, act, title, sub) => `<button data-act="${st[i] ? '' : act}" class="${st[i] ? 'done' : ''}"><b>${st[i] ? '✓' : i + 1}</b><span>${title}<small>${sub}</small></span></button>`;
  return `<section class="card onboard"><div class="eyebrow">はじめの3歩 <small>${st.filter(Boolean).length} / 3</small><button class="eyebrow-act" data-act="onboard-skip">あとで</button></div>
    <p>シルベへようこそ。下の3つで準備が終わります。</p>
    <div class="steps">
      ${step(0, 'seed-habits', '聖典の時間割から日課を入れる', `朝・夕・夜のルーティン${SEED_HABITS.length}個`)}
      ${step(1, 'seed-goals', '目標一覧から目標を入れる', '健康・稼ぐ・表現・習慣の4つ')}
      ${step(2, 'add-open', '最初のクエストを1つ足す', '右下の＋からいつでも')}
    </div></section>`;
}
function timerBlock(n) {
  if (!n.timerEnd) return `<div class="timer-pick">${Object.entries(TIMERS).map(([k, v]) => `<button class="btn sm" data-act="timer" data-v="${k}">${v.name} ${v.work}分</button>`).join('')}</div>`;
  const T = TIMERS[n.timerKind] || TIMERS.wana, total = (n.timerPhase === 'rest' ? T.rest : T.work) * 60e3;
  return `<div class="timer" data-end="${n.timerEnd}" data-total="${total}">
    <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="tr-bg"/><circle cx="60" cy="60" r="52" class="tr-fg" pathLength="100"/></svg>
    <div class="timer-in"><b id="timerText">--:--</b><span>${n.timerPhase === 'rest' ? '休憩' : T.name}</span></div>
    <button class="btn sm ghost" data-act="timer-stop">止める</button></div>${device() === 'phone' ? '<p class="muted" style="font-size:11px;margin-top:6px">iPhoneはアプリを閉じていると終了の通知が届きません。画面を開いたままにするか、時計アプリのタイマーも併用してください</p>' : ''}`;
}
function summaryCard() {
  const k = dkey(), m = k.slice(0, 7);
  const days = new Set([
    ...S.tasks.filter(t => t.status === 'done' && t.doneDay?.startsWith(m)).map(t => t.doneDay),
    ...S.logs.filter(x => x.id.startsWith(m) && (x.energy != null || Object.values(x.habits || {}).some(Boolean))).map(x => x.id)]);
  const month = S.tasks.filter(t => t.status === 'done' && t.doneDay?.startsWith(m));
  const c = col => month.filter(t => t.color === col).length;
  const earned = S.logs.filter(l => l.id.startsWith(m)).reduce((a, l) => a + (+l.earned || 0), 0);
  return `<section class="card">
    <div class="eyebrow">今月の歩み <small>途切れても0には戻りません</small></div>
    <div class="stat-row">
      <div class="stat"><b>${days.size}</b><span>動いた日</span></div>
      <div class="stat"><b>${month.length}</b><span>クエスト達成</span></div>
      <div class="stat"><b>${earned ? yen(earned) : '—'}</b><span>稼いだ額</span></div>
    </div>
    <div class="bal-head"><span>赤・青・緑のバランス</span><span>${month.length ? `${c('red')}・${c('blue')}・${c('green')}` : 'まだ記録なし'}</span></div>
    <div class="balance">${month.length ? `<i style="flex:${c('red')};background:var(--red)"></i><i style="flex:${c('blue')};background:var(--blue)"></i><i style="flex:${c('green')};background:var(--green)"></i>` : ''}</div>
    ${month.length && !c('green') ? '<p class="muted" style="margin-top:8px">緑（回復）がまだゼロ。休むこともクエストです</p>' : ''}
  </section>`;
}

/* ---------- 今日 ---------- */
function taskRow(t, opts = {}) {
  const carried = t.status === 'todo' && t.today && t.today < dkey();
  const goal = t.goalId && S.goals.find(g => g.id === t.goalId);
  const bits = [COLOR_SHORT[t.color] || '', `${taskXp(t)}XP`];
  if (t.urgency === 3) bits.unshift('急ぎ');
  if (t.style && STYLES[t.style]) bits.push(STYLES[t.style][1]);
  if (goal) bits.push(goal.title);
  if (carried) bits.push('前の日から');
  if (t.steps?.length) bits.push(`ステップ ${t.steps.filter(x => x.done).length}/${t.steps.length}`);
  if (t.source === 'claude' || t.source === 'codex') bits.push(SRC[t.source]);
  return `<div class="task c-${col(t.color)} ${t.status === 'done' ? 'done' : ''}" data-id="${t.id}">
    <button class="chk" data-act="${opts.later ? 'to-today' : 'toggle'}" data-id="${t.id}" aria-label="${opts.later ? '今日へ移す' : '完了にする'}">
      ${opts.later ? '<svg viewBox="0 0 24 24" class="plus"><path d="M12 6v12M6 12h12"/></svg>' : '<svg viewBox="0 0 24 24"><path d="M5 12l4 4 10-10"/></svg>'}</button>
    <button class="t-body" data-act="task-edit" data-id="${t.id}"><div class="t-title">${esc(t.title)}</div>
      <div class="t-meta">${bits.map(esc).join('・')}${t.reward ? `<span class="reward">🎁 ${esc(t.reward)}</span>` : ''}</div></button>
    ${!opts.later && t.status === 'todo' ? `<button class="t-play" data-act="now-from" data-id="${t.id}" aria-label="いまやる"><svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg></button>` : ''}
  </div>`;
}
function viewToday() {
  const list = todayTasks(), st = moodState();
  const todo = list.filter(t => t.status === 'todo');
  const shown = st === 'low' ? list.filter(t => t.status === 'done').concat(todo.slice(0, 1)) : list;
  const later = S.tasks.filter(t => t.status === 'todo' && !t.today).sort((a, b) => (b.urgency || 0) - (a.urgency || 0) || (b.createdAt || 0) - (a.createdAt || 0));
  const doneN = list.length - todo.length;
  const t = todayLog(), tod = timeOfDay(), h = new Date().getHours();
  const ritualMorning = (tod === 'morning' || tod === 'day') && t.energy == null, ritualNight = h >= 20 || h < 3;
  return `
  <div class="col">
    ${ritualMorning ? `<section class="card ritual"><div class="eyebrow">朝の儀 <small>2タップで終わります</small></div>
      <p class="muted">ゆうべの睡眠</p>${sleepChips(t)}
      <p class="muted" style="margin-top:12px">いまの気分は？</p>
      <div class="quick-mood">${[[2, 2, '絶好調'], [1, 1, 'いい感じ'], [0, 0, 'ふつう'], [-1, -1, 'いまいち'], [-2, -2, 'しんどい']].map(([e, p, w]) => `<button data-act="mood" data-e="${e}" data-p="${p}" style="--m:${moodColor(e, p)}"><i></i>${w}</button>`).join('')}</div></section>` : ''}
    <section class="card">
      <div class="eyebrow">今日のクエスト <small>${list.length ? `${doneN} / ${list.length} 達成` : ''}${todo.length > 3 ? '・3つで十分です' : ''}</small></div>
      ${list.length ? `<div class="progress"><i style="transform:scaleX(${list.length ? doneN / list.length : 0})"></i></div>` : ''}
      ${shown.length ? shown.map(t => taskRow(t)).join('') : '<div class="empty">今日のクエストはまだありません。下に書くか、「あとで」から＋で移せます</div>'}
      ${st === 'low' && todo.length > 1 ? `<div class="muted" style="margin-top:8px">ほかの${todo.length - 1}件は今日は隠しています（鬱の日モード）</div>` : ''}
      ${list.length && !todo.length ? '<div class="clear-all">今日のクエスト、ぜんぶ達成。🎉</div>' : ''}
      <form class="field quick" data-form="quick"><input name="t" placeholder="＋ 今日のクエストを足す" autocomplete="off" enterkeyhint="done"><button class="btn primary" aria-label="足す">足す</button></form>
    </section>
    ${habitsCard()}
  </div>
  <div class="col">
    <section class="card">
      ${st === 'low' && later.length ? `<details><summary>あとで（${later.length}件）・今日は見なくて大丈夫</summary>${later.slice(0, 40).map(t => taskRow(t, { later: true })).join('')}</details>` : `<div class="eyebrow">あとで <small>${later.length}件・急ぎの順</small></div>
      ${later.length ? later.slice(0, 40).map(t => taskRow(t, { later: true })).join('') : '<div class="empty">「いつかやる」をここに置いておけます</div>'}`}
    </section>
    <section class="card">
      <div class="eyebrow">思いついたら投げ込む</div>
      <form data-form="memo"><div class="memo-wrap"><textarea class="full" name="t" rows="3" placeholder="タスクでも、思いつきでも、気持ちでも。あとで受け取り箱で仕分けます"></textarea>
      ${speechOK ? `<button type="button" class="mic" data-act="mic" aria-label="声で入力"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : ''}</div>
      <div class="row end"><button class="btn primary">受け取り箱へ</button></div></form>
    </section>
    ${ritualNight ? `<section class="card ritual"><div class="eyebrow">夜のしめくくり</div>
      <form data-form="night"><input class="full" name="t" value="${esc(t.night || '')}" placeholder="今日いちばん良かったこと、ひとことだけ" autocomplete="off" enterkeyhint="done">
      <div class="row end"><button class="btn primary">しめくくる</button></div></form></section>` : ''}
    ${summaryCard()}
  </div>`;
}
function habitsCard() {
  const hs = activeHabits(), done = todayLog().habits || {};
  if (!hs.length) return `<section class="card"><div class="eyebrow">日課</div><div class="empty">聖典の時間割から日課を作れます</div>
    <div class="row"><button class="btn primary" data-act="seed-habits">時間割から作る</button><button class="btn" data-act="habit-edit">自分で作る</button></div></section>`;
  const m = dkey().slice(0, 7), monthCount = id => S.logs.filter(l => l.id.startsWith(m) && l.habits?.[id]).length;
  const slots = Object.keys(SLOTS).filter(s => hs.some(h => h.slot === s));
  const doneN = hs.filter(h => done[h.id]).length;
  return `<section class="card">
    <div class="eyebrow">日課 <small>${doneN} / ${hs.length}・ルーティンは自由を守るための鎖</small><button class="eyebrow-act" data-act="habit-edit">編集</button></div>
    ${slots.map(s => `<div class="slot"><span class="slot-name">${SLOTS[s]}</span><div class="habits">${hs.filter(h => h.slot === s).map(h => `<button class="habit c-${col(h.color)} ${done[h.id] ? 'on' : ''}" data-act="habit" data-id="${h.id}"><i></i>${esc(h.title)}<small>${monthCount(h.id)}</small></button>`).join('')}</div></div>`).join('')}
    <p class="muted" style="font-size:11px;margin-top:8px">右の数字は今月の回数。途切れても減りません</p>
  </section>`;
}

/* ---------- 受け取り箱 ---------- */
function viewInbox() {
  const pend = S.inbox.filter(x => x.status === 'pending').sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const done = S.inbox.filter(x => x.status !== 'pending').sort((a, b) => (b.decidedAt || 0) - (a.decidedAt || 0)).slice(0, 10);
  return `
  <div class="col">
    <section class="card">
      <div class="eyebrow">受け取り箱 <small>${pend.length ? `${pend.length}件・決めるのは木村さん` : ''}</small></div>
      ${pend.length ? pend.map(inboxRow).join('') : `<div class="empty-big"><svg viewBox="0 0 24 24"><path d="M3 13l3-8h12l3 8v6H3z"/><path d="M3 13h5l1 3h6l1-3h5"/></svg><p>空っぽです</p><span>ターミナルでClaude CodeやCodexと話した内容から、タスクや思いつきの候補が30分ごとに届きます。「行動」ボードの投げ込みもここへ。</span></div>`}
    </section>
  </div>
  <div class="col">
    ${pend.length > 1 ? `<section class="card"><div class="eyebrow">まとめて</div><p class="muted">採用するとそれぞれ+2XP。迷ったら捨ててOK（あとで戻せます）</p><div class="row"><button class="btn" data-act="inbox-dismiss-all">残りを全部捨てる</button></div></section>` : ''}
    <section class="card">
      <details><summary>最近仕分けたもの（${done.length}）</summary>
      ${done.map(x => `<div class="idea"><span class="kind">${x.status === 'accepted' ? '採用' : '捨てた'}</span><p>${esc(x.text)}</p>${x.status === 'dismissed' ? `<button class="btn sm ghost" data-act="inbox-restore" data-id="${x.id}">戻す</button>` : ''}</div>`).join('') || '<div class="empty">まだありません</div>'}
      </details>
    </section>
  </div>`;
}
function inboxRow(x) {
  const k = x.kind || 'memo';
  const primary = { task: ['as-task', 'タスクにする'], now: ['as-now', 'いまの作業にする'], mood: ['as-mood', '記録に残す'], idea: ['as-idea', '思いつき箱へ'], memo: ['as-task', 'タスクにする'] }[k] || ['as-task', 'タスクにする'];
  const extra = (k === 'memo' || k === 'task') ? `<button class="btn sm" data-act="as-idea" data-id="${x.id}">思いつき箱へ</button>` : k === 'idea' ? `<button class="btn sm" data-act="as-task" data-id="${x.id}">タスクにする</button>` : '';
  const when = x.createdAt ? new Date(x.createdAt).toLocaleString('ja-JP', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  return `<div class="inbox-item">
    <div class="inbox-head"><span class="kind k-${esc(k)}">${esc(KIND[k] || k)}</span><span class="src">${esc(SRC[x.source] || x.source || '')}${x.project ? '・' + esc(x.project) : ''}・${when}</span></div>
    <div class="inbox-text">${esc(x.text)}</div>
    ${x.detail ? `<div class="inbox-detail">${esc(x.detail)}</div>` : ''}
    <div class="row"><button class="btn sm primary" data-act="${primary[0]}" data-id="${x.id}">${primary[1]}</button>${extra}<button class="btn sm ghost" data-act="inbox-dismiss" data-id="${x.id}">捨てる</button></div>
  </div>`;
}

/* ---------- 記録 ---------- */
const moodColor = (e, p) => {
  if (e == null) return 'var(--hair)';
  if (e === 0 && p === 0) return 'var(--q-mid)';
  const base = e >= 0 ? (p >= 0 ? 'var(--q-hi-pl)' : 'var(--q-hi-un)') : (p >= 0 ? 'var(--q-lo-pl)' : 'var(--q-lo-un)');
  return `color-mix(in srgb, ${base} ${45 + Math.max(Math.abs(e), Math.abs(p)) * 27}%, var(--q-mid))`;
};
const moodWord = (e, p) => `${['ぐったり', '低め', 'ふつう', '高め', '全開'][e + 2]}・${['しんどい', 'やや不快', 'ニュートラル', 'わりと快', 'いい感じ'][p + 2]}`;
const sleepChips = t => `<div class="chips">${[4, 5, 6, 7, 7.5, 8, 9].map(h => `<button class="chip ${t.sleep === h ? 'on' : ''}" data-act="sleep" data-h="${h}">${h}h</button>`).join('')}</div>`;
function viewLog() {
  const t = todayLog(), grid = [];
  for (let e = 2; e >= -2; e--) for (let p = -2; p <= 2; p++)
    grid.push(`<button style="background:${moodColor(e, p)}" class="${t.energy === e && t.pleasant === p ? 'on' : ''}" data-act="mood" data-e="${e}" data-p="${p}" aria-label="${moodWord(e, p)}"></button>`);
  return `
  <div class="col">
    <section class="card">
      <div class="eyebrow">今日の気分 <small>マスを1タップ・+5XP</small></div>
      <div class="mood-wrap"><div class="axis-y"><span>元気 ↑</span><span>↓ 静か</span></div>
        <div class="mood-grid">${grid.join('')}</div>
        <div class="axis-x"><span>← しんどい</span><span>いい感じ →</span></div></div>
      <div class="mood-label">${t.energy != null ? moodWord(t.energy, t.pleasant) : '<span class="muted">縦が元気さ、横が気持ちよさ</span>'}</div>
      <div class="sub-label">ゆうべの睡眠 <small>聖典の目安は7.5時間</small></div>${sleepChips(t)}
      <form data-form="lognote" class="log-form">
        <div class="two"><label>稼いだ額<input name="earned" inputmode="numeric" value="${+t.earned || ''}" placeholder="0" autocomplete="off"></label>
        <label>他者貢献<input name="contrib" value="${esc(t.contrib || '')}" placeholder="誰かの役に立ったこと" autocomplete="off"></label></div>
        <label>ひとことメモ<input name="note" value="${esc(t.note || '')}" placeholder="なくてOK" autocomplete="off"></label>
        <div class="row end"><button class="btn primary">残す</button></div></form>
    </section>
    ${weekCard()}
  </div>
  <div class="col">
    <section class="card">
      <div class="eyebrow">${new Date().getFullYear()}年の気分 <small>1日＝1マス</small></div>
      ${pixels()}
      <div class="legend"><span><i class="dot" style="--c:var(--q-hi-pl)"></i>元気・快</span><span><i class="dot" style="--c:var(--q-hi-un)"></i>元気・不快</span><span><i class="dot" style="--c:var(--q-lo-pl)"></i>静か・快</span><span><i class="dot" style="--c:var(--q-lo-un)"></i>静か・不快</span></div>
    </section>
    <section class="card">
      <div class="eyebrow">睡眠 <small>直近14日</small></div>${sleepBars()}
    </section>
    ${ideasCard()}
  </div>`;
}
function weekCard() {
  const wk = weekKey(), days = [...Array(7)].map((_, i) => dkey(addDays(i, new Date(wk + 'T00:00'))));
  const logs = S.logs.filter(l => days.includes(l.id));
  const done = S.tasks.filter(t => t.status === 'done' && days.includes(t.doneDay));
  const avg = (arr, f) => { const v = arr.map(f).filter(x => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const sl = avg(logs, l => l.sleep), en = avg(logs, l => l.energy), habitN = logs.reduce((a, l) => a + Object.values(l.habits || {}).filter(Boolean).length, 0);
  const r = S.reviews.find(x => x.id === wk) || {};
  const pendIdeas = S.ideas.filter(i => !i.archived && !i.score).length;
  return `<section class="card">
    <div class="eyebrow">今週の振り返り <small>${days[0].slice(5).replace('-', '/')}〜${days[6].slice(5).replace('-', '/')}・週次PDCA</small></div>
    <div class="stat-row four">
      <div class="stat"><b>${done.length}</b><span>達成</span></div>
      <div class="stat"><b>${habitN}</b><span>日課</span></div>
      <div class="stat"><b>${sl != null ? sl.toFixed(1) + 'h' : '—'}</b><span>平均睡眠</span></div>
      <div class="stat"><b>${en != null ? (en > .5 ? '高め' : en < -.5 ? '低め' : 'ふつう') : '—'}</b><span>元気さ</span></div>
    </div>
    <div class="bal-head"><span>赤・青・緑</span><span>${['red', 'blue', 'green'].map(c => done.filter(t => t.color === c).length).join('・')}</span></div>
    ${pendIdeas ? `<p class="muted" style="margin-top:8px">思いつき箱に、まだ採点していないものが${pendIdeas}件あります</p>` : ''}
    <form data-form="review" class="log-form">
      <label>よかったこと<input name="good" value="${esc(r.good || '')}" autocomplete="off"></label>
      <label>もっとこうしたい<input name="more" value="${esc(r.more || '')}" autocomplete="off"></label>
      <label>来週ひとつだけ試すこと<input name="next" value="${esc(r.next || '')}" autocomplete="off"></label>
      <div class="row end"><button class="btn primary">振り返りを残す（+20XP）</button></div></form>
  </section>`;
}
function ideasCard() {
  const list = S.ideas.filter(i => !i.archived).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  return `<section class="card">
    <div class="eyebrow">思いつき箱 <small>計画的偶発性の枠・[委ねる]</small></div>
    <form class="field" data-form="idea" style="margin-top:0"><input name="t" placeholder="すぐやらないけど、捨てたくないもの" autocomplete="off"><button class="btn">入れる</button></form>
    ${list.map(i => `<button class="idea idea-btn" data-act="idea-open" data-id="${i.id}"><p>${esc(i.text)}</p>${i.score ? verdictTag(i.score) : '<span class="kind">未採点</span>'}</button>`).join('') || '<div class="empty">まだありません</div>'}
  </section>`;
}
function pixels() {
  const y = new Date().getFullYear(), k = dkey(), by = Object.fromEntries(S.logs.map(x => [x.id, x]));
  let h = '<span></span>' + [1, 5, 10, 15, 20, 25, 30].map(d => `<span class="px-d" style="grid-column:${d + 1}">${d}</span>`).join('');
  for (let m = 0; m < 12; m++) {
    h += `<span style="grid-column:1">${m + 1}</span>`;
    const dim = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= 31; d++) {
      if (d > dim) { h += '<i class="void"></i>'; continue; }
      const id = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`, x = by[id];
      h += `<i class="${id === k ? 'today' : ''}" ${x && x.energy != null ? `style="background:${moodColor(x.energy, x.pleasant)}" title="${id} ${moodWord(x.energy, x.pleasant)}"` : ''}></i>`;
    }
  }
  return `<div class="pixels">${h}</div>`;
}
function sleepBars() {
  const by = Object.fromEntries(S.logs.map(x => [x.id, x])), out = [];
  for (let i = 13; i >= 0; i--) {
    const d = addDays(-i), x = by[dkey(d)], h = x?.sleep;
    out.push(`<div><i class="${h != null && h < 6 ? 'low' : h >= 7.5 ? 'good' : ''}" style="height:${h != null ? Math.min(h / 10, 1) * 100 : 0}%"></i><span>${d.getDate()}</span></div>`);
  }
  return S.logs.some(x => x.sleep != null) ? `<div class="bars"><em class="goal-line" style="bottom:calc(75% + 14px)">7.5h</em>${out.join('')}</div>` : '<div class="empty">記録するとここに棒が並びます</div>';
}

/* ---------- 羅針盤 ---------- */
function viewCompass() {
  const st = moodState(), mode = meta('mode'), word = todaysWord(), M = MODES[mode.mode];
  return `
  <div class="col">
    ${word ? `<section class="card word big-word"><div class="eyebrow">今日の言葉 <small>${esc(word.head)}</small><button class="eyebrow-act" data-act="word-next">ほかの言葉</button></div><p class="word-text">${esc(word.text)}</p></section>`
      : `<section class="card"><div class="eyebrow">今日の言葉</div><div class="empty">聖典がまだ読み込まれていません。朝のセットアップで ~/life/ から自動で入ります</div></section>`}
    <section class="card">
      <div class="eyebrow">いまの自分 <small>選ぶとアプリの量が合わせて変わります</small></div>
      <div class="seg">${Object.entries(STATES).map(([k, v]) => `<button class="${st === k ? 'on' : ''} s-${k}" data-act="state" data-v="${k}">${v.name}</button>`).join('')}</div>
      <div class="state-box s-${st}"><p class="state-msg">「${esc(STATES[st].msg)}」</p>
        <p class="muted">${esc(STATES[st].tip)}・作業配分 ${esc(STATES[st].plan)}</p></div>
    </section>
    <section class="card">
      <div class="eyebrow">モードスイッチ <small>物理スイッチで切り替える</small></div>
      <div class="modes">${Object.entries(MODES).map(([k, v]) => `<button class="mode m-${v.c} ${mode.mode === k ? 'on' : ''}" data-act="mode" data-v="${k}">${v.name}</button>`).join('')}</div>
      ${M ? `<div class="mode-box m-${M.c}"><p class="mode-msg">${esc(M.msg)}</p><p class="muted">${esc(M.act)}</p><p class="muted" style="font-size:11px;margin-top:6px">${ago(mode.since, '前に切り替え')}</p></div>` : '<p class="muted" style="margin-top:10px">ボタンを押すと、そのモードの所作と言葉が出ます</p>'}
    </section>
  </div>
  <div class="col">
    ${goalsCard()}
    <section class="card values">
      <div class="eyebrow">価値観</div>
      <div class="three"><span>おもろさ</span><span>無敵</span><span>自然</span></div>
      ${bible?.values ? `<details><summary>興味の3カテゴリ（原文）</summary><div class="md">${md(bible.values.split('\n').filter(l => !/^>/.test(l) && !/^# 価値観/.test(l)).join('\n'))}</div></details>` : ''}
    </section>
    ${bible?.seiten ? `<section class="card"><details><summary class="eyebrow-like">聖典をひらく（原文のまま）</summary><div class="md">${md(bible.seiten.split('\n').filter(l => !/^>/.test(l)).join('\n'))}</div></details></section>` : ''}
  </div>`;
}
function goalsCard() {
  const gs = S.goals.filter(g => !g.archived).sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0));
  return `<section class="card">
    <div class="eyebrow">目標の地図 <small>目標 → クエスト</small><button class="eyebrow-act" data-act="goal-new">＋ 目標</button></div>
    ${gs.length ? gs.map(g => {
      const ts = S.tasks.filter(t => t.goalId === g.id && t.status !== 'stored'), d = ts.filter(t => t.status === 'done').length;
      return `<button class="goal c-${col(g.color)}" data-act="goal-open" data-id="${g.id}">
        <div class="goal-top"><span class="dot"></span><b>${esc(g.title)}</b><span class="goal-n">${ts.length ? `${d}/${ts.length}` : 'クエストなし'}</span></div>
        <div class="progress thin"><i style="transform:scaleX(${ts.length ? d / ts.length : 0})"></i></div></button>`;
    }).join('') : `<div class="empty">まだ目標がありません</div><div class="row"><button class="btn primary" data-act="seed-goals">目標一覧から入れる</button><button class="btn" data-act="goal-new">自分で書く</button></div>`}
  </section>`;
}

/* ================= フォーム部品 ================= */
function chipGroup(name, options, value) {
  return `<div class="chips" data-group="${name}">${options.map(([k, label]) => `<button type="button" class="chip ${String(k) === String(value) ? 'on' : ''}" data-v="${k}">${label}</button>`).join('')}</div>`;
}
const verdict = s => { const n = s.r + s.b + s.g; return n >= 7 ? ['即刻採用', 'go'] : n >= 5 ? ['戦略的保留', 'hold'] : ['即刻廃棄', 'drop']; };
const verdictTag = s => { const [w, c] = verdict(s); return `<span class="verdict v-${c}">${s.r + s.b + s.g}点 ${w}</span>`; };
function judgeBlock(score) {
  const s = score || { r: 2, b: 2, g: 2 };
  return `<div class="judge" data-judge>
    ${[['r', '赤（感情）', 'red'], ['b', '青（社会性）', 'blue'], ['g', '緑（精神負担の軽さ）', 'green']].map(([k, l, c]) => `<div class="judge-row"><span><i class="dot c-${c}"></i>${l}</span>${chipGroup('j' + k, [[1, '1'], [2, '2'], [3, '3']], s[k])}</div>`).join('')}
    <div class="judge-out">${verdictTag(s)}</div></div>`;
}
function readJudge(f) { const g = k => +(f.querySelector(`[data-group=j${k}] .on`)?.dataset.v || 2); return { r: g('r'), b: g('b'), g: g('g') }; }
function taskForm(t = {}) {
  const color = t.color || 'blue', size = t.size || 1, today = t.id ? !!t.today : (t.today !== null);
  const goals = S.goals.filter(g => !g.archived);
  const adv = !!(t.style || t.reward || t.score || t.goalId || t.urgency);
  return `<form data-form="task" data-id="${t.id || ''}" class="task-form">
    <input class="full title-in" name="title" value="${esc(t.title || '')}" placeholder="例：鋼のメンタル・防衛戦（メール返信）" autocomplete="off" required enterkeyhint="done">
    <div class="sub-label">色</div>${chipGroup('color', Object.entries(COLORS).map(([k, v]) => [k, `<span class="dot c-${k}"></span>${v}`]), color)}
    <div class="sub-label">いつ</div>${chipGroup('when', [['today', '今日やる'], ['later', 'あとで']], today ? 'today' : 'later')}
    <details ${adv ? 'open' : ''}><summary>くわしく設定（目標・判断エンジン・プレイスタイル・報酬）</summary>
      ${goals.length ? `<div class="sub-label">つながる目標</div>${chipGroup('goal', [['', 'なし'], ...goals.map(g => [g.id, esc(g.title)])], t.goalId || '')}` : ''}
      <div class="sub-label">緊急度</div>${chipGroup('urg', [[1, 'Lv.1 いつでも'], [2, 'Lv.2 今日中'], [3, 'Lv.3 即時']], t.urgency || 1)}
      <div class="sub-label">判断エンジン <small>採点するとXP＝合計×5</small></div>
      <label class="switch"><input type="checkbox" name="useScore" ${t.score ? 'checked' : ''}><span>採点する</span></label>
      <div class="judge-wrap" ${t.score ? '' : 'hidden'}>${judgeBlock(t.score)}</div>
      <div class="size-wrap" ${t.score ? 'hidden' : ''}><div class="sub-label">大きさ</div>${chipGroup('size', [[1, '小 10XP'], [2, '中 20XP'], [3, '大 40XP']], size)}</div>
      <div class="sub-label">プレイスタイル</div>${chipGroup('style', [['', 'なし'], ...Object.entries(STYLES).map(([k, v]) => [k, `${v[1]}`])], t.style || '')}
      <div class="sub-label">勝利報酬 <small>倒したら何をする？</small></div><input class="full" name="reward" value="${esc(t.reward || '')}" placeholder="例：サウナという名の回復ポーション" autocomplete="off">
    </details>
    <div class="row end">${t.id ? `<button type="button" class="btn ghost" data-act="task-store" data-id="${t.id}">しまう</button>` : ''}<button class="btn primary">${t.id ? '保存' : '足す'}</button></div>
  </form>
  ${t.id ? `<div class="steps-box"><div class="sub-label">ステップ <small>小さく分けると始めやすい</small></div>
    ${(t.steps || []).map((x, i) => `<button class="step ${x.done ? 'done' : ''}" data-act="step-toggle" data-id="${t.id}" data-i="${i}"><i></i><span>${esc(x.t)}</span></button>`).join('') || '<div class="empty">まだありません</div>'}
    <div class="row"><button class="btn sm ai-btn" data-act="ai-quest" data-id="${t.id}">✦ AIでステップに分ける</button>${t.steps?.length ? `<button class="btn sm ghost" data-act="steps-clear" data-id="${t.id}">ステップを消す</button>` : ''}</div></div>` : ''}`;
}

/* ================= 操作 ================= */
function addTask(data) {
  return write(store.add('tasks', { color: 'blue', size: 1, status: 'todo', createdAt: now(), source: device(), ...data, today: data.today === undefined ? dkey() : data.today }));
}
const seeding = {};
const decide = (x, status) => write(store.set('inbox', x.id, { status, decidedAt: now() }));
const undoDone = id => store.set('tasks', id, { status: 'todo', doneAt: null, doneDay: null });

const actions = {
  go(_, el) { setTab(el.dataset.v); },

  'compass-open'() { openSheet(`<h3>羅針盤</h3><div class="sheet-cols">${viewCompass()}</div>`); },
  'ask-quick'(_, el) { askBuddy(el.dataset.v); },
  'ai-goal'(id) { const g = S.goals.find(x => x.id === id); if (g) aiSuggest({ kind: 'goal', g }); },
  'ai-quest'(id) { const t = S.tasks.find(x => x.id === id); if (t) aiSuggest({ kind: 'quest', t }); },
  'ai-retry'() { if (aiCtx) aiSuggest(aiCtx, $('#aiHint')?.value || ''); },
  'sug-toggle'(_, el) { el.classList.toggle('off'); buzz(5); },
  'sug-adopt'() {
    const picked = [...document.querySelectorAll('#sheet .sug:not(.off)')].map(b => aiSug[+b.dataset.i]).filter(Boolean);
    if (!picked.length) return toast('採用するものを残してください');
    if (aiCtx.kind === 'goal') {
      Promise.all(picked.map(q => addTask({ title: q.title, color: ['red', 'blue', 'green'].includes(q.color) ? q.color : 'blue', size: [1, 2, 3].includes(+q.size) ? +q.size : 1, goalId: aiCtx.g.id, today: null, source: 'ai', note: q.why || '' })))
        .then(ids => toast(`${picked.length}件を「あとで」に足しました`, '取り消す', () => ids.filter(Boolean).forEach(id => store.del('tasks', id))));
      closeSheet(); buzz(15);
    } else {
      const t = S.tasks.find(x => x.id === aiCtx.t.id); const prev = t.steps || [];
      write(store.set('tasks', t.id, { steps: [...prev, ...picked.map(q => ({ t: q.title, done: false }))] }));
      closeSheet(); toast(`${picked.length}個のステップを足しました`, '取り消す', () => store.set('tasks', t.id, { steps: prev })); buzz(15);
      setTimeout(() => actions['task-edit'](t.id), 250);
    }
  },
  'step-toggle'(id, el) {
    const t = S.tasks.find(x => x.id === id); if (!t) return; const i = +el.dataset.i;
    const steps = (t.steps || []).map((x, j) => j === i ? { ...x, done: !x.done } : x);
    write(store.set('tasks', id, { steps })); el.classList.toggle('done'); buzz(8);
    const m = el.closest('.steps-box')?.querySelector('.sub-label small'); if (m) m.textContent = `${steps.filter(x => x.done).length} / ${steps.length}`;
  },
  'steps-clear'(id) { const t = S.tasks.find(x => x.id === id); if (!t) return; const prev = t.steps; write(store.set('tasks', id, { steps: [] })); closeSheet(); toast('ステップを消しました', '取り消す', () => store.set('tasks', id, { steps: prev })); },

  toggle(id, el) {
    const t = S.tasks.find(x => x.id === id); if (!t) return;
    if (t.status === 'done') { write(undoDone(id)); return; }
    write(store.set('tasks', id, { status: 'done', doneAt: now(), doneDay: dkey() }));
    const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); buzz(15);
    if (prefs.sound) chime([784, 1047]);
    if (meta('now').taskId === id) write(store.set('meta', 'now', { text: '', taskId: null, since: null, timerEnd: null }));
    toast(`+${taskXp(t)}XP　${t.title}${t.reward ? `　🎁 ${t.reward}` : ''}`, '取り消す', () => undoDone(id));
  },
  'to-today'(id) { write(store.set('tasks', id, { today: dkey() })); toast('今日のクエストに入れました'); buzz(10); },
  'task-edit'(id) { const t = S.tasks.find(x => x.id === id); if (t) openSheet(`<h3>クエストを直す</h3>${taskForm(t)}`); },
  'task-store'(id) { write(store.set('tasks', id, { status: 'stored' })); closeSheet(); toast('しまいました（消してはいません）', '戻す', () => store.set('tasks', id, { status: 'todo' })); },
  'add-open'() { openSheet(`<h3>クエストを足す</h3>${taskForm({})}`); },
  'now-from'(id) { const t = S.tasks.find(x => x.id === id); if (t) { write(store.set('meta', 'now', { text: t.title, taskId: id, since: now(), timerEnd: null })); buzz(10); if (tab !== 'act') toast(`いまやること：${t.title}`, '行動ボードへ', () => setTab('act')); } },
  'now-done'() { const n = meta('now'); if (n.taskId) actions.toggle(n.taskId, $('.now-card')); },
  'now-edit'() { const n = meta('now'); openSheet(`<h3>いまやってること</h3><form data-form="now"><input class="full" name="t" value="${esc(n.text)}" autocomplete="off" enterkeyhint="done"><div class="row end"><button class="btn primary">変える</button></div></form>`); },
  'now-clear'() { write(store.set('meta', 'now', { text: '', taskId: null, since: null, timerEnd: null })); toast('ひと区切り。おつかれさまでした'); },
  timer(_, el) {
    const k = el.dataset.v; askNotify();
    write(store.set('meta', 'now', { timerKind: k, timerPhase: 'work', timerEnd: now() + TIMERS[k].work * 60e3 }));
    toast(`${TIMERS[k].name}スタート。この${TIMERS[k].work}分で倒す`);
  },
  'timer-stop'() { write(store.set('meta', 'now', { timerEnd: null, timerPhase: null })); },
  'as-task'(id) { const x = S.inbox.find(i => i.id === id); if (x) openSheet(`<h3>タスクにする</h3>${taskForm({ title: x.text, color: x.color })}`, f => { f.dataset.inbox = id; }); },
  'as-now'(id) { const x = S.inbox.find(i => i.id === id); if (!x) return; write(store.set('meta', 'now', { text: x.text, taskId: null, since: now(), timerEnd: null })); decide(x, 'accepted'); toast('いまやってることにしました'); },
  'as-mood'(id) {
    const x = S.inbox.find(i => i.id === id); if (!x) return; const cur = todayLog();
    setLog({ note: [cur.note, x.text].filter(Boolean).join(' / '), ...(x.energy != null && cur.energy == null ? { energy: x.energy, pleasant: x.pleasant ?? 0 } : {}) });
    decide(x, 'accepted'); toast('今日の記録に残しました');
  },
  'as-idea'(id) { const x = S.inbox.find(i => i.id === id); if (!x) return; write(store.add('ideas', { text: x.text, createdAt: now(), source: x.source || '' })); decide(x, 'accepted'); toast('思いつき箱へ入れました'); },
  'inbox-dismiss'(id) { const x = S.inbox.find(i => i.id === id); if (x) { decide(x, 'dismissed'); toast('捨てました', '戻す', () => store.set('inbox', id, { status: 'pending' })); } },
  'inbox-dismiss-all'() {
    const ids = S.inbox.filter(x => x.status === 'pending').map(x => x.id);
    ids.forEach(id => store.set('inbox', id, { status: 'dismissed', decidedAt: now() }));
    toast(`${ids.length}件捨てました`, '戻す', () => ids.forEach(id => store.set('inbox', id, { status: 'pending' })));
  },
  'inbox-restore'(id) { write(store.set('inbox', id, { status: 'pending' })); },
  mood(_, el) {
    setLog({ energy: +el.dataset.e, pleasant: +el.dataset.p });
    const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2, 8); buzz(10);
    if (tab === 'act') toast('気分を残しました（+5XP）');
  },
  sleep(_, el) { setLog({ sleep: +el.dataset.h }); buzz(8); },
  habit(id, el) {
    const cur = todayLog().habits || {}, on = !cur[id];
    setLog({ habits: { ...cur, [id]: on } }); buzz(on ? 12 : 5);
    if (on) { const r = el.getBoundingClientRect(); burst(r.left + 14, r.top + r.height / 2, 6); }
  },
  'habit-edit'() { openSheet(habitSheet()); },
  'habit-del'(id) { write(store.set('habits', id, { archived: true })); setTimeout(() => openSheet(habitSheet()), 60); },
  'seed-habits'() {
    if (activeHabits().length) return toast('日課はもう入っています');
    if (seeding.h) return; seeding.h = true; setTimeout(() => seeding.h = false, 4000);
    SEED_HABITS.forEach(([title, slot, color], i) => store.add('habits', { title, slot, color, order: i, createdAt: now() }));
    toast('聖典の時間割から日課を入れました。「行動」ボードに並んでいます');
  },
  'seed-goals'() {
    if (S.goals.some(g => !g.archived)) return toast('目標はもう入っています');
    if (seeding.g) return; seeding.g = true; setTimeout(() => seeding.g = false, 4000);
    SEED_GOALS.forEach(([title, why, color], i) => store.add('goals', { title, why, color, order: i, createdAt: now() }));
    toast('目標一覧から4つ入れました');
  },
  'goal-new'() { openSheet(goalSheet({})); },
  'goal-open'(id) { const g = S.goals.find(x => x.id === id); if (g) openSheet(goalSheet(g)); },
  'goal-arch'(id) { write(store.set('goals', id, { archived: true })); closeSheet(); toast('目標をしまいました', '戻す', () => store.set('goals', id, { archived: false })); },
  'goal-add-task'(id) { openSheet(`<h3>クエストを足す</h3>${taskForm({ goalId: id, today: null })}`); },
  state(_, el) { setLog({ state: el.dataset.v }); buzz(10); repaintCompass(); },
  mode(_, el) {
    const k = el.dataset.v, cur = meta('mode');
    write(store.set('meta', 'mode', cur.mode === k ? { mode: null, since: null } : { mode: k, since: now() }));
    if (cur.mode !== k) { buzz([20, 30, 20]); if (prefs.sound) chime(k === 'gm' ? [392, 784] : [523, 784]); }
    repaintCompass();
  },
  'onboard-skip'() { prefs.onboarded = true; savePrefs(); render(); },
  'word-next'() { cardShift++; render(); repaintCompass(); },
  'idea-open'(id) { const i = S.ideas.find(x => x.id === id); if (i) openSheet(ideaSheet(i)); },
  'idea-task'(id) { const i = S.ideas.find(x => x.id === id); if (i) openSheet(`<h3>タスクにする</h3>${taskForm({ title: i.text, score: i.score })}`, f => { f.dataset.idea = id; }); },
  'idea-arch'(id) { write(store.set('ideas', id, { archived: true })); closeSheet(); toast('しまいました', '戻す', () => store.set('ideas', id, { archived: false })); },
  mic(_, el) { listen(el.closest('form').querySelector('textarea')); },
  'pref-sound'() { prefs.sound = !prefs.sound; savePrefs(); if (prefs.sound) chime(); openSettings(); },
  'notify-on'() { askNotify(true); },
  export() {
    const blob = new Blob([JSON.stringify({ exportedAt: new Date().toISOString(), ...S }, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `シルベ_${dkey()}.json`; a.click();
  },
  async signout() {
    const left = store.pending?.() || 0;
    if (left && !confirm(`まだ保存できていない記録が${left}件あります。ログアウトすると消えます。それでもログアウトしますか？`)) return;
    await store.signOut(); closeSheet();
  },
  'chat-new'() { if (chatBusy) return toast('いまの答えを待っています'); chat = []; closeSheet(); safeRender(); toast('新しく話せます'); },
  'chat-open'() { openChat(); },
};

function habitSheet() {
  const hs = activeHabits();
  return `<h3>日課の編集</h3>
    ${hs.map(h => `<div class="idea"><span class="dot c-${col(h.color)}"></span><p>${esc(h.title)} <span class="muted">${SLOTS[h.slot] || ''}</span></p><button class="btn sm ghost" data-act="habit-del" data-id="${h.id}">外す</button></div>`).join('') || '<div class="empty">まだありません</div>'}
    <form data-form="habit" class="log-form"><label>新しい日課<input name="title" required autocomplete="off" placeholder="例：ギター10分"></label>
      <div class="sub-label">時間帯</div>${chipGroup('slot', Object.entries(SLOTS), 'morning')}
      <div class="sub-label">色</div>${chipGroup('color', Object.entries(COLORS).map(([k, v]) => [k, `<span class="dot c-${k}"></span>${v}`]), 'green')}
      <div class="row end">${hs.length ? '' : '<button type="button" class="btn" data-act="seed-habits">聖典の時間割から作る</button>'}<button class="btn primary">足す</button></div></form>`;
}
function goalSheet(g) {
  const ts = g.id ? S.tasks.filter(t => t.goalId === g.id && t.status !== 'stored').sort((a, b) => (a.status === 'done') - (b.status === 'done')) : [];
  return `<h3>${g.id ? '目標' : '目標を足す'}</h3>
    <form data-form="goal" data-id="${g.id || ''}" class="log-form">
      <label>目標<input name="title" value="${esc(g.title || '')}" required autocomplete="off" placeholder="例：オリジナル曲を1曲完成させる"></label>
      <label>なぜ（自分の言葉で）<textarea class="full" name="why" rows="3">${esc(g.why || '')}</textarea></label>
      <div class="sub-label">色</div>${chipGroup('color', Object.entries(COLORS).map(([k, v]) => [k, `<span class="dot c-${k}"></span>${v}`]), g.color || 'blue')}
      <div class="row end">${g.id ? `<button type="button" class="btn ghost" data-act="goal-arch" data-id="${g.id}">しまう</button>` : ''}<button class="btn primary">保存</button></div></form>
    ${g.id ? `<div class="sub-label" style="margin-top:18px">この目標のクエスト</div>${ts.map(t => taskRow(t, { later: t.status === 'todo' && !t.today })).join('') || '<div class="empty">まだありません</div>'}
      <div class="row"><button class="btn" data-act="goal-add-task" data-id="${g.id}">＋ クエストを足す</button></div>` : ''}`;
}
function ideaSheet(i) {
  return `<h3>思いつきを採点する</h3><p class="idea-big">${esc(i.text)}</p>
    <form data-form="ideaScore" data-id="${i.id}">${judgeBlock(i.score)}
    <p class="muted" style="font-size:11px;margin-top:8px">9〜7点：即刻採用 / 6〜5点：戦略的保留 / 4点以下：即刻廃棄</p>
    <div class="row end"><button type="button" class="btn ghost" data-act="idea-arch" data-id="${i.id}">しまう</button><button type="button" class="btn" data-act="idea-task" data-id="${i.id}">タスクにする</button><button class="btn primary">採点を残す</button></div></form>`;
}

const pick = (f, g) => f.querySelector(`[data-group=${g}] .on`)?.dataset.v;
const forms = {
  askAI(f) { const q = f.t.value.trim(); f.t.value = ''; askBuddy(q); },
  now(f) { const t = f.t.value.trim(); if (!t) return; write(store.set('meta', 'now', { text: t, taskId: null, since: now(), timerEnd: null })); closeSheet(); buzz(10); },
  quick(f) { const t = f.t.value.trim(); if (!t) return; addTask({ title: t }); f.t.value = ''; toast('今日のクエストに足しました'); buzz(10); },
  memo(f) {
    const t = f.t.value.trim(); if (!t) return;
    write(store.add('inbox', { kind: 'memo', text: t, source: device(), createdAt: now(), status: 'pending' }));
    f.reset(); toast('受け取り箱へ入れました'); buzz(10);
  },
  night(f) { setLog({ night: f.t.value.trim() }); toast('今日もおつかれさまでした。明日のイメージングをして、おやすみなさい'); },
  lognote(f) {
    const earned = +String(f.earned.value).replace(/[^\d]/g, '') || 0, prev = +todayLog().earned || 0;
    setLog({ earned, contrib: f.contrib.value.trim(), note: f.note.value.trim() });
    if (earned > prev) { burst(innerWidth / 2, innerHeight / 3, 24); toast(`${yen(earned - prev)} 稼いだ！ やったね。月1回の申告確認も忘れずに`); }
    else toast('残しました');
  },
  review(f) { write(store.set('reviews', weekKey(), { good: f.good.value.trim(), more: f.more.value.trim(), next: f.next.value.trim(), updatedAt: now() })); toast('振り返りを残しました'); },
  idea(f) { const t = f.t.value.trim(); if (!t) return; write(store.add('ideas', { text: t, createdAt: now(), source: device() })); f.t.value = ''; toast('思いつき箱へ'); },
  ideaScore(f) { write(store.set('ideas', f.dataset.id, { score: readJudge(f) })); closeSheet(); toast('採点しました'); },
  habit(f) {
    const title = f.title.value.trim(); if (!title) return;
    write(store.add('habits', { title, slot: pick(f, 'slot'), color: pick(f, 'color'), order: S.habits.length, createdAt: now() }));
    setTimeout(() => openSheet(habitSheet()), 80);
  },
  goal(f) {
    const data = { title: f.title.value.trim(), why: f.why.value.trim(), color: pick(f, 'color') };
    if (!data.title) return;
    if (f.dataset.id) write(store.set('goals', f.dataset.id, data)); else write(store.add('goals', { ...data, order: S.goals.length, createdAt: now() }));
    closeSheet(); toast('目標を保存しました');
  },
  task(f) {
    const useScore = f.useScore?.checked;
    const data = {
      title: f.title.value.trim(), color: pick(f, 'color'), today: pick(f, 'when') === 'today' ? dkey() : null,
      size: +(pick(f, 'size') || 1), urgency: +(pick(f, 'urg') || 1), style: pick(f, 'style') || '', reward: f.reward?.value.trim() || '',
      goalId: pick(f, 'goal') || '', score: useScore ? readJudge(f) : null,
    };
    if (!data.title) return;
    if (f.dataset.id) { write(store.set('tasks', f.dataset.id, data)); closeSheet(); return; }
    const ib = f.dataset.inbox && S.inbox.find(i => i.id === f.dataset.inbox);
    addTask({ ...data, source: ib ? (ib.source || device()) : device() });
    if (ib) decide(ib, 'accepted');
    if (f.dataset.idea) write(store.set('ideas', f.dataset.idea, { archived: true }));
    closeSheet(); toast(data.today ? '今日のクエストに足しました' : '「あとで」に足しました'); buzz(10);
  },
};

document.addEventListener('click', e => {
  const chip = e.target.closest('[data-group] .chip');
  if (chip) {
    chip.parentElement.querySelectorAll('.chip').forEach(c => c.classList.toggle('on', c === chip));
    const j = chip.closest('[data-judge]'); if (j) j.querySelector('.judge-out').innerHTML = verdictTag(readJudge(j));
    buzz(5); return;
  }
  const b = e.target.closest('[data-act]');
  if (b && actions[b.dataset.act]) { e.preventDefault(); fromSheet = !!b.closest('#sheet'); actions[b.dataset.act](b.dataset.id, b); fromSheet = false; return; }
  const d = e.target.closest('.dock button'); if (d) setTab(d.dataset.tab);
});
document.addEventListener('input', e => { if (e.target.closest?.('#view [data-form]')) e.target.dataset.typed = '1'; });
document.addEventListener('change', e => {
  if (e.target.name === 'useScore') {
    const f = e.target.closest('form');
    f.querySelector('.judge-wrap').hidden = !e.target.checked; f.querySelector('.size-wrap').hidden = e.target.checked;
  }
});
document.addEventListener('submit', e => {
  const f = e.target.closest('[data-form]');
  if (!f || !forms[f.dataset.form]) return;
  e.preventDefault();
  const name = f.dataset.form, inView = !!f.closest('#view');
  if (inView) document.activeElement?.blur?.();
  forms[name](f);
  if (inView) { pending = false; safeRender(); if (name === 'quick' && device() === 'pc') requestAnimationFrame(() => $('[data-form=quick] input')?.focus()); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeSheet();
  if (e.target.matches('input,textarea') || e.metaKey || e.ctrlKey) return;
  const map = { 1: 'act', 2: 'plan', 3: 'log', 4: 'inbox' };
  if (map[e.key]) setTab(map[e.key]);
  if (e.key === 'ArrowRight' && !sheetOpen) stepBoard(1);
  if (e.key === 'ArrowLeft' && !sheetOpen) stepBoard(-1);
  if (e.key === 'n') { e.preventDefault(); actions['add-open'](); }
});
const boardScroll = {};
function setTab(t, dir) {
  if (['now', 'home', 'today'].includes(t)) t = 'act';
  if (t === 'compass') { actions['compass-open'](); return; }
  if (t === tab) { scrollTo({ top: 0, behavior: 'smooth' }); return; }
  boardScroll[tab] = scrollY;
  const from = BOARDS.findIndex(b => b[0] === tab), to = BOARDS.findIndex(b => b[0] === t);
  tab = t; try { localStorage.setItem('shirube_tab', t); } catch {}
  render(); scrollTo({ top: boardScroll[t] || 0 });
  const v = $('#view'); v.classList.remove('in-l', 'in-r'); void v.offsetWidth; v.classList.add((dir || (to - from)) > 0 ? 'in-r' : 'in-l');
}
function stepBoard(d) { const i = BOARDS.findIndex(b => b[0] === tab); const j = i + d; if (j >= 0 && j < BOARDS.length) { setTab(BOARDS[j][0], d); buzz(5); } }
// 左右のスワイプでボードを切り替える（縦のスクロールや横に流れる部品とは取り合わない）
let sw = null;
$('#view').addEventListener('touchstart', e => {
  if (sheetOpen || e.touches.length > 1 || e.target.closest('input,textarea,.chips,.pixels,.mood-grid,.timer,.no-swipe')) { sw = null; return; }
  sw = { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() };
}, { passive: true });
$('#view').addEventListener('touchend', e => {
  if (!sw) return; const dx = e.changedTouches[0].clientX - sw.x, dy = e.changedTouches[0].clientY - sw.y; const quick = Date.now() - sw.t < 600; sw = null;
  if (quick && Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.8) stepBoard(dx < 0 ? 1 : -1);
}, { passive: true });

/* ================= タイマー ================= */
let timerLoop;
function tickTimer() {
  clearInterval(timerLoop);
  const el = document.querySelector('.timer'); if (!el) return;
  const step = () => {
    const end = +el.dataset.end, total = +el.dataset.total, left = Math.max(0, end - now());
    const tx = document.getElementById('timerText'); if (!tx) return clearInterval(timerLoop);
    tx.textContent = `${String(Math.floor(left / 60000)).padStart(2, '0')}:${String(Math.floor(left / 1000) % 60).padStart(2, '0')}`;
    el.querySelector('.tr-fg').style.strokeDashoffset = String(100 - (left / total) * 100);
    if (left <= 0) { clearInterval(timerLoop); timerDone(); }
  };
  step(); timerLoop = setInterval(step, 1000);
}
let lastRing = 0;
function timerDone() {
  const n = meta('now'); if (!n.timerEnd || now() - lastRing < 5000) return;
  if (document.visibilityState !== 'visible') return; // 見えている端末だけが進める（2台で二重に鳴らさない）
  lastRing = now();
  const T = TIMERS[n.timerKind] || TIMERS.wana, late = now() - n.timerEnd;
  if (n.timerPhase === 'rest' || late > T.rest * 60e3) {
    write(store.set('meta', 'now', { timerEnd: null, timerPhase: null }));
    if (late < 60e3) notify(n.timerPhase === 'rest' ? '休憩おわり' : `${T.name}クリア！`, '次のラウンドへ。ゲーム開始');
    else toast(`${T.name}は終わっていました。おつかれさまでした`);
  } else {
    write(store.set('meta', 'now', { timerPhase: 'rest', timerEnd: n.timerEnd + T.rest * 60e3 }));
    notify(`${T.name}クリア！`, `${T.rest}分休憩。深呼吸して、流れのままに`);
  }
  if (late < 60e3) { chime([784, 988, 1175]); buzz([60, 60, 60]); }
}
function askNotify(force) {
  if (!('Notification' in window)) { if (force) toast('この端末ではブラウザの通知が使えません'); return; }
  if (Notification.permission === 'default') Notification.requestPermission().then(() => force && openSettings());
  else if (force) toast(Notification.permission === 'granted' ? '通知はオンです' : '端末の設定で通知が止まっています');
}
function notify(title, body) {
  toast(`${title}　${body}`);
  try { if (Notification.permission === 'granted') navigator.serviceWorker?.ready.then(r => r.showNotification(title, { body, icon: 'icon-180.png', tag: 'shirube-timer' })).catch(() => new Notification(title, { body })); } catch {}
}

/* ================= 音声入力 ================= */
const Speech = window.SpeechRecognition || window.webkitSpeechRecognition;
const speechOK = !!Speech;
let rec;
function listen(ta) {
  if (rec) { rec.stop(); return; }
  rec = new Speech(); rec.lang = 'ja-JP'; rec.interimResults = true; rec.continuous = false;
  const base = ta.value ? ta.value + ' ' : '', btn = document.querySelector('.mic');
  btn?.classList.add('rec');
  rec.onresult = e => { ta.value = base + [...e.results].map(r => r[0].transcript).join(''); };
  rec.onend = rec.onerror = () => { btn?.classList.remove('rec'); rec = null; };
  rec.start();
}


function repaintCompass() { setTimeout(() => { const c = $('#sheet .sheet-cols'); if (c) c.innerHTML = viewCompass(); }, 60); }

/* ================= AI相棒（MacのClaudeが答える。store.ask） ================= */
let aiCtx = null, aiSug = [], chat = [], aiReq = 0, chatBusy = false;
const aiWait = st => ({ sent: 'Macの相棒に渡しました…', working: '相棒が考えています（30秒ほど）…', late: 'Macが眠っているかもしれません。15分以内にMacが起きれば答えます' }[st] || '');
function aiContext() {
  const gs = S.goals.filter(g => !g.archived).map(g => `- ${g.title}${g.why ? `（なぜ：${g.why}）` : ''}`).join('\n') || '（なし）';
  const td = todayTasks().filter(t => t.status === 'todo').map(t => `- ${t.title}`).join('\n') || '（なし）';
  const st = STATES[moodState()].name;
  return `【持ち主の価値観（原文の言葉）】${valueWords().join('・')}\n【目標】\n${gs}\n【今日のクエスト】\n${td}\n【今の状態】${st}${moodState() === 'low' ? '（今日は量を減らす日。1つだけでよい）' : ''}`;
}
function parseJson(text) { const m = text.match(/\{[\s\S]*\}/); if (!m) throw new Error('形が違いました'); return JSON.parse(m[0]); }
async function aiSuggest(ctx, hint = '') {
  if (!store.ask) return toast('AIはクラウドにつないだ時に使えます');
  aiCtx = ctx; const req = ++aiReq;
  const title = ctx.kind === 'goal' ? `「${ctx.g.title}」をクエストに分ける` : `「${ctx.t.title}」をステップに分ける`;
  openSheet(`<h3 data-ai="${req}">✦ ${esc(title)}</h3><div class="ai-wait" id="aiWait"><span class="pulse"></span>${aiWait('sent')}</div>`);
  const mine = () => req === aiReq && !!$(`#sheet [data-ai="${req}"]`);
  const have = ctx.kind === 'goal' ? S.tasks.filter(t => t.goalId === ctx.g.id && t.status !== 'stored').map(t => `- ${t.title}${t.status === 'done' ? '（済）' : ''}`).join('\n') || '（なし）' : (ctx.t.steps || []).map(x => `- ${x.t}`).join('\n') || '（なし）';
  const prompt = ctx.kind === 'goal'
    ? `${aiContext()}\n\n目標「${ctx.g.title}」${ctx.g.why ? `（なぜ：${ctx.g.why}）` : ''}を達成するためのクエストを3〜5個出してください。\n今あるクエスト：\n${have}\n条件：今あるものと重ねない。1つは15分以内で始められる小さいもの。赤＝感情が動く挑戦、青＝社会・仕事、緑＝回復・整える。size は 1=小 2=中 3=大。${hint ? `\n追加の希望：${hint}` : ''}\n形式：{"quests":[{"title":"","color":"red|blue|green","size":1,"why":"なぜ効くか20字以内"}]}`
    : `${aiContext()}\n\nクエスト「${ctx.t.title}」を、上から順にやれば終わるステップ3〜6個に分けてください。最初のステップは2分で始められるものに。\n今あるステップ：\n${have}${hint ? `\n追加の希望：${hint}` : ''}\n形式：{"quests":[{"title":"","why":""}]}`;
  try {
    const text = await store.ask({ kind: 'json', prompt }, st => { const w = mine() && $('#aiWait'); if (w) w.innerHTML = `<span class="pulse"></span>${aiWait(st)}`; }, () => !mine());
    if (!mine()) return;
    aiSug = (parseJson(text).quests || []).filter(q => q && q.title).slice(0, 8);
    $('#sheet').innerHTML = `<div class="grab"></div><button class="sheet-x" data-close aria-label="閉じる">×</button><h3 data-ai="${req}">✦ ${esc(title)}</h3>
      <p class="muted">要らないものはタップで外せます。残したものだけが足されます</p>
      ${aiSug.map((q, i) => `<button class="sug c-${col(q.color || 'blue')}" data-act="sug-toggle" data-i="${i}"><i></i><span><b>${esc(q.title)}</b>${q.why ? `<small>${esc(q.why)}</small>` : ''}</span></button>`).join('')}
      <div class="row end"><button class="btn primary" data-act="sug-adopt">残したものを足す</button></div>
      <div class="sub-label" style="margin-top:16px">出し直す</div>
      <div class="field"><input id="aiHint" placeholder="例：もっと小さく／週末にできるもの" autocomplete="off"><button class="btn" data-act="ai-retry">出し直す</button></div>`;
  } catch (e) {
    if (e.message !== 'cancel' && mine()) $('#sheet').querySelector('#aiWait')?.replaceWith(Object.assign(document.createElement('p'), { className: 'muted', textContent: `うまくいきませんでした：${e.message}。もう一度押してください` }));
  }
}
async function askBuddy(q) {
  if (!q) { if (chat.length) openChat(); return; }
  if (!store.ask) return toast('相棒はクラウドにつないだ時に使えます');
  if (chatBusy) return toast('いまの答えを待っています');
  chatBusy = true;
  chat.push({ role: 'user', content: q }); chat = chat.slice(-8);
  const paint = wait => {
    const body = chat.map(m => `<div class="msg ${m.role}">${m.role === 'user' ? esc(m.content) : md(m.content)}</div>`).join('') + (wait ? `<div class="ai-wait" id="aiWait"><span class="pulse"></span>${wait}</div>` : '');
    const html = `<h3>相棒に聞く</h3><div class="chat">${body}</div><form class="field" data-form="askAI"><input name="t" placeholder="続けて聞く" autocomplete="off" enterkeyhint="send"><button class="btn primary">聞く</button></form>
      ${chat.length > 1 ? '<div class="row end"><button class="btn sm ghost" data-act="chat-new">新しく話す</button></div>' : ''}`;
    if (sheetOpen && $('#sheet .chat')) { $('#sheet').innerHTML = `<div class="grab"></div><button class="sheet-x" data-close aria-label="閉じる">×</button>${html}`; } else if (!wait || !sheetOpen) openSheet(html);
    const c = $('#sheet .chat'); if (c) c.scrollTop = c.scrollHeight;
  };
  paint(aiWait('sent'));
  const msgs = [{ role: 'user', content: aiContext() + '\n\n（ここまでが私の今の状況です）' }, ...chat];
  try {
    const text = await store.ask({ kind: 'chat', messages: msgs }, st => { const w = $('#aiWait'); if (w) w.innerHTML = `<span class="pulse"></span>${aiWait(st)}`; });
    chat.push({ role: 'assistant', content: text }); if ($('#sheet .chat')) paint(''); else toast('相棒が答えました', '開く', openChat);
  } catch (e) { chat.push({ role: 'assistant', content: `（うまくいきませんでした：${e.message}）` }); if ($('#sheet .chat')) paint(''); }
  chatBusy = false; safeRender();
}
function openChat() {
  openSheet(`<h3>相棒に聞く</h3><div class="chat">${chat.map(m => `<div class="msg ${m.role}">${m.role === 'user' ? esc(m.content) : md(m.content)}</div>`).join('')}${chatBusy ? `<div class="ai-wait"><span class="pulse"></span>${aiWait('working')}</div>` : ''}</div>
    <form class="field" data-form="askAI"><input name="t" placeholder="続けて聞く" autocomplete="off" enterkeyhint="send"><button class="btn primary">聞く</button></form>
    <div class="row end"><button class="btn sm ghost" data-act="chat-new">新しく話す</button></div>`);
  const c = $('#sheet .chat'); if (c) c.scrollTop = c.scrollHeight;
}

/* ================= シート・トースト ================= */
let sheetOpen = false, sheetStack = [], fromSheet = false;
function openSheet(html, after) {
  if (sheetOpen && fromSheet && !$('#sheet [data-ai]')) sheetStack.push($('#sheet').innerHTML);
  if (!sheetOpen) { try { history.pushState({ sheet: 1 }, ''); } catch {} }
  $('#sheet').innerHTML = `<div class="grab"></div><button class="sheet-x" data-close aria-label="閉じる">×</button>${html}`;
  $('#sheet').hidden = $('#sheetBg').hidden = false; sheetOpen = true;
  document.body.classList.add('locked');
  const f = $('#sheet form'); if (f && after) after(f);
  if (device() === 'pc') setTimeout(() => $('#sheet input:not([type=checkbox])')?.focus(), 200);
}
function closeSheet(fromPop) {
  if (!sheetOpen) return;
  if (sheetStack.length && fromPop !== 'all') { $('#sheet').innerHTML = sheetStack.pop(); $('#sheet').scrollTop = 0; if (fromPop === true) { try { history.pushState({ sheet: 1 }, ''); } catch {} } return; }
  if (fromPop !== true && history.state?.sheet) { ignorePop = true; try { history.back(); } catch {} }
  sheetOpen = false;
  $('#sheet').hidden = $('#sheetBg').hidden = true; $('#sheet').innerHTML = '';
  document.body.classList.remove('locked'); if (pending) safeRender();
}
$('#sheetBg').onclick = () => closeSheet();
let ignorePop = false;
addEventListener('popstate', () => { if (ignorePop) { ignorePop = false; return; } if (sheetOpen) closeSheet(true); });
$('#sheet').addEventListener('click', e => { if (e.target.closest('[data-close]')) closeSheet(); });
// 下に引っ張って閉じる
let dragY = null;
$('#sheet').addEventListener('touchstart', e => { if ($('#sheet').scrollTop <= 0 && e.target.closest('.grab, h3')) dragY = e.touches[0].clientY; }, { passive: true });
$('#sheet').addEventListener('touchmove', e => { if (dragY != null) { const dy = Math.max(0, e.touches[0].clientY - dragY); $('#sheet').style.transform = `translate(-50%, ${dy}px)`; } }, { passive: true });
$('#sheet').addEventListener('touchend', e => { if (dragY == null) return; const dy = e.changedTouches[0].clientY - dragY; $('#sheet').style.transform = ''; dragY = null; if (dy > 90) closeSheet(); });

let toastTimer;
function toast(msg, label, undo) {
  const t = $('#toast'); clearTimeout(toastTimer);
  t.innerHTML = `<span>${esc(msg)}</span>${label ? `<button>${esc(label)}</button>` : ''}`; t.hidden = false;
  t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  if (label) t.querySelector('button').onclick = () => { undo(); t.hidden = true; };
  toastTimer = setTimeout(() => t.hidden = true, label ? 5000 : 2600);
}

/* ================= 設定 ================= */
const COLLS = ['tasks', 'inbox', 'logs', 'ideas', 'meta', 'habits', 'goals', 'reviews'];
async function restoreFrom(data, label) {
  let n = 0;
  for (const c of COLLS) {
    const rows = Array.isArray(data[c]) ? data[c] : data[c] && typeof data[c] === 'object' ? Object.entries(data[c]).map(([id, v]) => ({ id, ...v })) : [];
    const clean = rows.filter(r => r && typeof r.id === 'string' && !(c === 'meta' && ['ai', 'bible'].includes(r.id)));
    if (clean.length) { await store.batchSet(c, clean); n += clean.length; }
  }
  toast(`${label}：${n}件を戻しました`);
}
function offerLocalImport() {
  if (store.mode !== 'cloud' || prefs.localImported) return;
  let local; try { local = JSON.parse(localStorage.getItem('shirube_v4_local') || 'null'); } catch {}
  if (!local || !COLLS.some(c => Object.keys(local[c] || {}).length)) return;
  setTimeout(() => openSheet(`<h3>お試しのデータが見つかりました</h3><p>この端末の「お試し」で入れた記録やクエストを、クラウドに引っ越しますか？</p>
    <div class="row end"><button class="btn ghost" data-act="local-skip">引っ越さない</button><button class="btn primary" data-act="local-import">引っ越す</button></div>`), 1200);
}
actions['local-import'] = async () => { closeSheet(); try { await restoreFrom(JSON.parse(localStorage.getItem('shirube_v4_local')), 'お試しのデータ'); prefs.localImported = true; savePrefs(); } catch (e) { toast('引っ越しに失敗しました：' + e.message); } };
actions['local-skip'] = () => { prefs.localImported = true; savePrefs(); closeSheet(); };
actions['restore-pick'] = () => {
  const i = document.createElement('input'); i.type = 'file'; i.accept = 'application/json,.json';
  i.onchange = async () => { try { const data = JSON.parse(await i.files[0].text()); closeSheet(); await restoreFrom(data, 'バックアップ'); } catch (e) { toast('読み込めませんでした：' + e.message); } };
  i.click();
};
function openSettings() {
  const url = location.href.split('#')[0];
  openSheet(`<h3>設定</h3>
  <div class="set-row"><span>保存先</span><b>${store.mode === 'cloud' ? 'クラウド（PCとスマホで同期）' : 'この端末だけ（お試し）'}</b></div>
  ${store.mode === 'cloud' ? `<div class="set-row"><span>ログイン中</span><b>${esc(store.user?.name || '')}</b></div>` : ''}
  <div class="set-row"><span>効果音</span><button class="chip ${prefs.sound ? 'on' : ''}" data-act="pref-sound">${prefs.sound ? 'オン' : 'オフ'}</button></div>
  <div class="set-row"><span>タイマーの通知</span><button class="chip ${'Notification' in window && Notification.permission === 'granted' ? 'on' : ''}" data-act="notify-on">${'Notification' in window && Notification.permission === 'granted' ? 'オン' : 'オンにする'}</button></div>
  ${store.mode === 'cloud' && device() === 'pc' ? `<div class="sub-label">スマホで開く</div><div class="qr" id="qr"></div><p class="muted" style="font-size:12px">iPhoneのカメラで読み取り → Safariで開く → 共有ボタン →「ホーム画面に追加」</p>` : ''}
  <div class="sub-label">キーボード操作（PC）</div><p class="muted" style="font-size:12px">1〜4・←→でボード切り替え・Nでクエストを足す・Escで閉じる</p>
  <div class="row" style="justify-content:flex-start"><button class="btn sm" data-act="export">データを書き出す（JSON）</button><button class="btn sm" data-act="restore-pick">書き出したものから戻す</button>${store.mode === 'cloud' ? '<button class="btn sm ghost" data-act="signout">ログアウト</button>' : ''}</div>
  <p class="muted" style="margin-top:16px;font-size:11px">シルベ v5</p>`);
  if ($('#qr')) import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm').then(m => { const q = (m.default || m)(0, 'M'); q.addData(url); q.make(); $('#qr').innerHTML = q.createSvgTag({ cellSize: 4, margin: 2, scalable: true }); }).catch(() => { $('#qr').textContent = url; });
}
$('#settingsBtn').onclick = openSettings;
$('#fab').onclick = () => actions['add-open']();

/* ================= ログイン ================= */
function gate() {
  $('#dock').hidden = true; $('#fab').hidden = true; $('.hud').classList.add('dim');
  $('#view').innerHTML = `<div class="gate"><section class="card">
    <img src="icon.svg" alt="" width="64" height="64" class="gate-icon"><h1>シルベ</h1><p class="muted">自分専用の相棒アプリ</p>
    <form data-form="login" class="log-form" style="text-align:left">
      ${store.kind === 'github' ? `<label>合言葉（AI家庭教師と同じ）<input name="pw" type="password" autocomplete="current-password" required></label>` : `<label>メールアドレス<input name="email" type="email" autocomplete="username" required></label>
      <label>パスワード<input name="pw" type="password" autocomplete="current-password" required></label>`}
      <div class="row" style="justify-content:stretch"><button class="btn primary" style="flex:1">ログイン</button></div>
    </form><p class="muted" style="font-size:11px;margin-top:14px">一度ログインすれば、次からは開くだけです</p></section></div>`;
}
forms.login = f => {
  const b = f.querySelector('button'); b.disabled = true; b.textContent = 'ログイン中…';
  store.signIn((f.email?.value || '').trim(), f.pw.value).catch(e => {
    b.disabled = false; b.textContent = 'ログイン'; console.warn(e);
    toast(/network/.test(e.code || '') ? 'ネットにつながっていないようです。つながったらもう一度どうぞ' : /too-many/.test(e.code || '') ? '少し時間をおいてから、もう一度どうぞ' : store.kind === 'github' ? '合言葉が違うようです' : 'メールアドレスかパスワードが違うようです');
  });
};

/* ================= 起動 ================= */
const online = () => { $('#net').hidden = navigator.onLine; };
addEventListener('online', online); addEventListener('offline', online);
paintSky(); online();
let lastDay = dkey();
setInterval(() => { paintSky(); if (dkey() !== lastDay) { lastDay = dkey(); safeRender(); } else if (tab === 'act' && !sheetOpen) safeRender(); }, 60e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { paintSky(); safeRender(); } });

let raf, pending = false;
// 入力中は描き直さない（書きかけが消えないように）。手を離したら反映する
function safeRender() {
  const a = document.activeElement;
  if (a && a.closest('#view') && /INPUT|TEXTAREA/.test(a.tagName)) { pending = true; paintHud(); return; }
  pending = false; render();
}
document.addEventListener('focusout', () => setTimeout(() => { if (pending && !document.activeElement?.closest?.('#view input, #view textarea')) safeRender(); }, 60));

function showError(e) {
  loadErr = 'データを読み込めませんでした。データは消えていません。ネットの状態を確かめて、アプリを開き直してください' + (e?.code ? `（${e.code}）` : '');
  paintBand();
}
try { store = await createStore(); }
catch (e) {
  console.error(e);
  $('#view').innerHTML = `<div class="gate"><section class="card"><h1>シルベ</h1><p>うまく起動できませんでした。</p><p class="muted">ネットにつながっているか確かめて、開き直してください。データは消えていません。</p><div class="row" style="justify-content:center"><button class="btn primary" onclick="location.reload()">開き直す</button></div></section></div>`;
  $('#dock').hidden = true; $('#fab').hidden = true;
  throw e;
}
store.onAuth(user => {
  if (!user) return gate();
  $('#dock').hidden = false; $('.hud').classList.remove('dim');
  booting = true; const arrived = new Set(); setTimeout(() => { booting = false; }, 15000);
  Object.keys(S).forEach(c => store.watch(c, rows => {
    S[c] = rows; if (c === 'meta') loadBible();
    arrived.add(c); if (arrived.size === Object.keys(S).length) setTimeout(() => { paintHud(); booting = false; }, 300);
    cancelAnimationFrame(raf); raf = requestAnimationFrame(safeRender);
  }, e => showError(e)));
  offerLocalImport();
  loadBible(); safeRender();
});

if ('serviceWorker' in navigator && !['localhost', '127.0.0.1'].includes(location.hostname)) navigator.serviceWorker.register('sw.js');
