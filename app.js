// シルベ v7 — いま／クエスト／記録（＋受け取り箱・羅針盤・AIはシート。v6 までの部品も残してある）
import { createStore } from './store.js?v=202611261507';

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

let store, tab = 'ima';
try { tab = localStorage.getItem('shirube_tab') || 'ima'; } catch {}
// v7（2026-11-25）：ボードは「いま・クエスト・記録」の3枚。前の名前で覚えていても開けるように
const OLD_TAB = { home: 'ima', today: 'ima', now: 'ima', act: 'ima', work: 'ima', inbox: 'ima', plan: 'quest', compass: 'quest' };
if (OLD_TAB[tab]) tab = OLD_TAB[tab];
// 4枚のボード（左右にスワイプ／下のバー／←→キー／1〜4キー）。前に見ていたボードを覚える
// 見る場面で分ける：行動＝作業中に開きっぱなし／戦略＝優先順位と全体／記録＝見返す／受け取り＝候補の仕分け
const BOARDS = [['ima', 'いま'], ['quest', 'クエスト'], ['log', '記録']];
// 作業ボード（2026-11-24）：?board で開くと、それだけを全画面に（作業用モニターに開きっぱなし）
const MONITOR = /[?&]board\b/.test(location.search) || location.hash === '#board';
if (MONITOR) tab = 'ima'; // 全画面の見た目は「作業」を見ている間だけ（render で付け外し。下のバーは薄く残して他のボードへ行けるように・2026-11-25 v6-8）
if (!BOARDS.some(b => b[0] === tab)) tab = 'ima';
const S = { tasks: [], inbox: [], logs: [], ideas: [], meta: [], habits: [], goals: [], reviews: [] };
const prefs = (() => { try { return JSON.parse(localStorage.getItem('shirube_prefs') || '{}'); } catch { return {}; } })();
const savePrefs = () => { try { localStorage.setItem('shirube_prefs', JSON.stringify(prefs)); } catch {} };
const meta = id => S.meta.find(m => m.id === id) || {};
const todayLog = () => S.logs.find(x => x.id === dkey()) || {};
// エラーの控え（直近15件を記録の meta/errlog に残す。木村さんが見た画面の理由をあとでAIが確かめられるように・2026-11-23）
let errBusy = false;
function noteErr(where, e) {
  try {
    const msg = String(e?.message || e || '').slice(0, 300);
    if (!msg || msg === 'cancel' || errBusy || !store?.set) return;
    errBusy = true;
    const list = [...(meta('errlog').list || []), { at: new Date().toISOString(), where, msg, tab, ua: navigator.userAgent.slice(0, 120) }].slice(-15);
    Promise.resolve(store.set('meta', 'errlog', { list })).catch(() => {}).finally(() => { errBusy = false; });
  } catch { errBusy = false; }
}
addEventListener('error', ev => noteErr('画面', ev.error || ev.message));
addEventListener('unhandledrejection', ev => noteErr('画面', ev.reason));
const write = p => { p?.catch?.(e => { toast('保存に失敗しました：' + e.message); noteErr('保存', e); }); return p; };
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
  S.logs.forEach(l => { xp += Math.min(15, (l.runs || []).filter(r => r.done).length * 3); });   // タイムアタックで倒した分（1日15XPまで）
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
const views = { ima: viewIma, quest: viewQuest, log: viewLog };
function render() {
  document.body.classList.toggle('monitor', MONITOR && tab === 'ima');
  paintHud(); paintBand();
  document.querySelectorAll('.dock button').forEach(b => { b.classList.toggle('on', b.dataset.tab === tab); b.setAttribute('aria-current', b.dataset.tab === tab ? 'page' : 'false'); });
  const drafts = {};
  document.querySelectorAll('#view [data-form] input[name], #view [data-form] textarea[name]').forEach(e => { if (e.type !== 'checkbox' && e.value && e.dataset.typed) drafts[e.closest('[data-form]').dataset.form + '|' + e.name] = e.value; });
  const openD = [...document.querySelectorAll('#view details[open] summary')].map(x => x.textContent);
  const kx = $('#view .kanban')?.scrollLeft || 0;
  $('#view').innerHTML = views[tab]();
  for (const [k, v] of Object.entries(drafts)) { const [f, n] = k.split('|'); const e = $(`#view [data-form="${f}"] [name="${n}"]`); if (e) { e.value = v; e.dataset.typed = '1'; } }
  document.querySelectorAll('#view details summary').forEach(x => { if (openD.includes(x.textContent)) x.parentElement.open = true; });
  const kb = $('#view .kanban'); if (kb && kx) kb.scrollLeft = kx;
  $('#fab').hidden = MONITOR || !['ima', 'quest'].includes(tab);
  const i = BOARDS.findIndex(b => b[0] === tab);
  const dots = $('#dots'); if (dots) dots.innerHTML = BOARDS.map((b, j) => `<button class="${j === i ? 'on' : ''}" data-act="go" data-v="${b[0]}" aria-label="${b[1]}"></button>`).join('');
  tickTimer(); tickTA(); initDrag();
  const sb = $('#sheet [data-sheet]'); if (sb) sb.innerHTML = sb.dataset.sheet === 'ai' ? aiSheetBody() : viewInbox();
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



/* ================= 作業ボード（2026-11-24 木村さん「作業中に見る1枚。今と次が分かる・優先順位が分かる」） ================= */
// 並びは AI（木村OSの橋が期限と大事さで並べた board）＋シルベの今日のクエスト。「今にする」で選び直せる
const WB_SRC = { today: '今日の3つ', atop: 'a-TOP', tree: '戦略ツリー', mine: 'シルベ' };
const wbNorm = t => String(t || '').replace(/[\s（）()・、。]/g, '');
function wbDue(d) {
  if (!d) return '';
  const k = dkey(), n = Math.round((Date.parse(d) - Date.parse(k)) / 864e5);
  if (n < 0) return '期限切れ'; if (n === 0) return '今日'; if (n === 1) return '明日';
  return `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}・あと${n}日`;
}
function workItems() {
  const os = meta('status-kimuraos'), wb = meta('workboard'), k = dkey(), done = wb.done || {};
  const titles = new Set(S.tasks.map(t => wbNorm(t.title)));
  const own = S.tasks.filter(t => t.status === 'todo' && t.today && t.today <= k)
    .map(t => ({ id: 't:' + t.id, task: t.id, src: 'mine', text: t.title, due: k, min: t.minutes ? `${t.minutes}分` : '', rank: 1 - (t.urgency || 0) * 0.3 }));
  const ai = (os.board || []).filter(x => !done[x.id] && !titles.has(wbNorm(x.text)));
  const all = [...ai, ...own].sort((a, b) => (a.due || '9999').localeCompare(b.due || '9999') || (a.rank ?? 9) - (b.rank ?? 9));
  const pi = all.findIndex(x => x.id === wb.pin); if (pi > 0) all.unshift(all.splice(pi, 1)[0]);
  const fin = [...(os.board || []).filter(x => done[x.id] && dkey(new Date(done[x.id] - 4 * 3600e3)) === k).map(x => x.text),
    ...S.tasks.filter(t => t.status === 'done' && t.doneDay === k).map(t => t.title)];
  return { all, fin };
}

// 動いているAIの帯（2026-11-24）：Mac の見張り（_system/scripts/ai-running.js・1分ごと・AI不使用）が live/status-running.json に送る
const RUN_ST = { wait: ['返事待ち', 'r-wait'], tool: ['実行中か許可待ち', 'r-tool'], work: ['作業中', 'r-work'], stop: ['止まっている', 'r-stop'] };
function runningBand() {
  const r = meta('status-running'), list = r.list || [];
  if (!r.updatedAt) return '';
  const old = now() - r.updatedAt > 20 * 60e3;
  const live = list.filter(x => x.state !== 'stop'), stop = list.filter(x => x.state === 'stop');
  const waitN = list.filter(x => x.state === 'wait').length;
  const chip = x => `<div class="run ${RUN_ST[x.state][1]}"><i></i><div class="run-t"><b>${esc(x.title)}</b><small>${esc(RUN_ST[x.state][0])}${x.state === 'work' ? '' : `・${ago(x.at, '前')}`}・${esc(x.tool)}${x.place && x.place !== x.title ? `・${esc(x.place)}` : ''}</small></div></div>`;
  return `<section class="card wb-run">
    <div class="eyebrow">動いているAI <small>${live.length}件${waitN ? `・<span class="r-hot">返事待ち ${waitN}件</span>` : ''}${old ? `・見張りが${ago(r.updatedAt, '前')}から止まっています` : ''}</small></div>
    <div class="run-list">${live.length ? live.map(chip).join('') : '<div class="empty">今動いているAIはありません</div>'}</div>
    ${stop.length ? `<details class="os-more"><summary>止まっている会話 ${stop.length}件</summary><div class="run-list">${stop.map(chip).join('')}</div></details>` : ''}
  </section>`;
}
// AIに任せた仕事（2026-11-25）：「AIに任せる」→ meta/workboard.ai[id]。Mac の見張り（_system/scripts/ai-dispatch.js）が
//   順番待ちに入れ、VS Code の新しいタブで Chief_of_Staff の会話を始める。状態は live/status-dispatch.json
const DSP_ST = { waiting: ['順番待ち', 'd-wait'], ready: ['もうすぐ始まる', 'd-wait'], work: ['AIが作業中', 'd-work'], ask: ['AIが確認待ち', 'd-ask'], done: ['AIができた', 'd-done'], stale: ['放置で外した', 'd-off'], cancel: ['取り消した', 'd-off'], sent: ['送りました', 'd-wait'] };
function dispatchOf(id) {
  const j = (meta('status-dispatch').jobs || []).find(x => x.bid === id);
  if (j) return j;
  const a = (meta('workboard').ai || {})[id];
  return a && !a.cancel && now() - (a.at || 0) < 15 * 60e3 ? { state: 'sent', text: a.text } : null;   // 見張りが受け取るまでの間だけ
}
function aiTag(x) {
  const j = dispatchOf(x.id);
  if (!j) return `<button class="btn sm wb-ai" data-act="wb-ai" data-id="${esc(x.id)}" title="VS Code で AI が始めます">AIに任せる</button>`;
  const [l, c] = DSP_ST[j.state] || ['', ''];
  return `<span class="wb-dsp ${c}">${esc(l)}</span>${['waiting', 'sent'].includes(j.state) ? `<button class="btn sm ghost" data-act="wb-ai-cancel" data-id="${esc(x.id)}">取り消す</button>` : ''}`;
}
function dispatchBand() {
  const d = meta('status-dispatch'), jobs = d.jobs || [];
  if (!jobs.length) return '';
  const act = jobs.filter(j => !['done', 'stale', 'cancel'].includes(j.state)), fin = jobs.filter(j => j.state === 'done');
  const askN = jobs.filter(j => j.state === 'ask').length;
  const card = j => { const [l, c] = DSP_ST[j.state] || ['', '']; return `<div class="run ${c}"><i></i><div class="run-t"><b>${esc(j.text)}</b><small>${esc(l)}・${esc(j.tool)}・${ago(j.last || j.at, '前')}${j.first ? `<br>${esc(j.first)}` : ''}</small></div></div>`; };
  return `<section class="card wb-run wb-dspband">
    <div class="eyebrow">AIに任せた仕事 <small>${act.length}件${askN ? `・<span class="r-hot">確認待ち ${askN}件（VS Code のタブへ）</span>` : ''}${d.waitWhy && jobs.some(j => j.state === 'waiting') ? `・待っている理由：${esc(d.waitWhy)}` : ''}</small></div>
    <div class="run-list">${act.length ? act.map(card).join('') : '<div class="empty">今はありません</div>'}</div>
    ${fin.length ? `<details class="os-more"><summary>今日AIができた ${fin.length}件</summary><div class="run-list">${fin.map(card).join('')}</div></details>` : ''}
  </section>`;
}
function viewWork() {
  const os = meta('status-kimuraos'), low = moodState() === 'low', k = dkey(), ai = meta('ai');
  const { all, fin } = workItems(), cur = all[0], rest = all.slice(1);
  const today = rest.filter(x => x.due && x.due <= k), later = rest.filter(x => !x.due || x.due > k);
  const chip = x => `<span class="wb-chip s-${esc(x.src)}">${esc(WB_SRC[x.src] || '')}</span>`;
  const meta1 = x => [chip(x), x.due ? `<span class="${x.due < k ? 'wb-late' : ''}">${esc(wbDue(x.due))}</span>` : '', x.min ? `<span>約${esc(String(x.min).replace(/^約/, ''))}</span>` : ''].filter(Boolean).join('');
  const row = (x, i) => `<div class="wb-row"><b class="wb-n">${i}</b><div class="wb-t"><div>${esc(x.text)}</div><div class="wb-meta">${meta1(x)}${aiTag(x)}</div></div>
    <div class="wb-acts"><button class="btn sm" data-act="wb-now" data-id="${esc(x.id)}">今にする</button><button class="wb-check" data-act="wb-done" data-id="${esc(x.id)}" aria-label="終わった">✓</button></div></div>`;
  const aiFresh = ai.text && now() - (ai.updatedAt || 0) < 3 * 3600e3;
  const tr = os.tree;
  const info = [os.asks ? `<button class="wb-pill" data-act="go" data-v="inbox">判断待ち <b>${os.asks}</b>件</button>` : '',
    today.length + (cur ? 1 : 0) ? `<span class="wb-pill">今日 <b>${today.length + (cur && cur.due && cur.due <= k ? 1 : 0)}</b>件</span>` : '',
    tr && tr.total ? `<span class="wb-pill">今月のタスク <b>${tr.done}/${tr.total}</b></span>` : '',
    os.atop && os.atop.count ? `<span class="wb-pill">a-TOP 夜に${os.atop.count}件</span>` : ''].filter(Boolean).join('');
  const clock = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  let n = 2;
  return `<div class="wb">
    <div class="wb-top"><div><b class="wb-clock">${clock}</b><span class="muted">${new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</span></div><div class="wb-pills">${info}</div></div>
    ${runningBand()}
    ${dispatchBand()}
    <div class="wb-grid">
      <section class="card wb-now">
        <div class="eyebrow">今やること</div>
        ${cur ? `<div class="wb-big">${esc(cur.text)}</div><div class="wb-meta">${meta1(cur)}</div>
          <div class="row"><button class="btn primary wb-go" data-act="wb-done" data-id="${esc(cur.id)}">終わった ✓</button>${rest.length ? `<button class="btn" data-act="wb-skip" data-id="${esc(cur.id)}">あとにする</button>` : ''}${aiTag(cur)}</div>`
          : '<div class="wb-big muted">今やることは、ありません</div><p class="muted">朝7時の作戦会議のあと、ここに並びます。シルベの今日のクエストも出ます。</p>'}
      </section>
      <section class="card wb-col">
        <div class="eyebrow">今日の残り <small>${today.length}件・上から</small></div>
        ${today.length ? today.map(x => row(x, n++)).join('') : '<div class="empty">今日の分はこれだけです</div>'}
      </section>
      ${low ? '' : `<section class="card wb-col">
        <div class="eyebrow">このあと <small>期限の近い順</small></div>
        ${later.length ? later.slice(0, 12).map(x => row(x, n++)).join('') : '<div class="empty">先の予定はまだありません</div>'}
        ${later.length > 12 ? `<div class="muted">ほか${later.length - 12}件</div>` : ''}
      </section>`}
      <section class="card wb-col wb-fin">
        <div class="eyebrow">今日おわった <small>${fin.length}件</small></div>
        ${fin.length ? fin.map(t => `<div class="wb-done">✓ ${esc(t)}</div>`).join('') : '<div class="empty">終わった物がここにたまります</div>'}
      </section>
    </div></div>`;
}

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
let tutorToday = null, tutorAt = 0, tutorNote = '';
function loadTutor() {
  if (!store.readOther || Date.now() - tutorAt < 30 * 60e3) return; tutorAt = Date.now();
  const day = new Date().toLocaleDateString('sv-SE');
  store.readOther('ai-tutor-data', `briefs/${day}.json`).then(b => { tutorToday = b && b.date === day ? b : null; tutorNote = ''; if (tab === 'quest') safeRender(); }).catch(e => { tutorToday = null; tutorNote = e.status === 403 || e.status === 401 ? '家庭教師のデータを読む権限がありません' : ''; });
}
function kanban() {
  const low = moodState() === 'low';
  const gs = S.goals.filter(g => !g.archived).sort((a, b) => (a.order || 0) - (b.order || 0) || (a.createdAt || 0) - (b.createdAt || 0));
  const k = dkey();
  const card = t => `<div class="kcard c-${col(t.color)}"><button class="kc-body" data-act="task-edit" data-id="${t.id}">${t.today && t.today <= k ? '<span class="kc-tag">今日</span>' : ''}${esc(t.title)}${t.steps?.length ? `<small>ステップ ${t.steps.filter(x => x.done).length}/${t.steps.length}</small>` : ''}</button>
    ${t.today && t.today <= k ? '' : `<button class="kc-today" data-act="to-today" data-id="${t.id}" aria-label="今日へ">今日へ</button>`}</div>`;
  const cols = gs.map((g, gi) => {
    const ts = S.tasks.filter(t => t.goalId === g.id && t.status !== 'stored'), d = ts.filter(t => t.status === 'done').length;
    const todo = ts.filter(t => t.status === 'todo').sort((a, b) => (!!(b.today && b.today <= k) - !!(a.today && a.today <= k)) || (b.urgency || 0) - (a.urgency || 0));
    if (low && gi > 1) return '';
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
  const pj = meta('status-projects'), os = meta('status-kimuraos'), tu = tutorToday, low = moodState() === 'low';
  const list = (pj.list || []).slice(0, low ? 3 : 8);
  const today = new Date(now() - 4 * 3600e3).toLocaleDateString('sv-SE');
  return `
    <section class="card">
      <div class="eyebrow">進行中の取り組み <small>${pj.updatedAt ? `会話から自動・${ago(pj.updatedAt, '前に更新')}` : '会話から自動で更新されます'}</small></div>
      ${list.length ? list.map(p => `<div class="proj"><div class="proj-top"><b>${esc(p.project)}</b>${p.stage ? `<span class="stage">${esc(p.stage)}</span>` : ''}<span class="muted proj-t">${ago(p.updatedAt, '前')}</span></div>
        <div class="proj-s">${esc(p.status)}</div>${p.next ? `<div class="proj-n"><span>次の候補</span>${esc(p.next)}<button class="proj-send" data-act="proj-next" data-v="${esc(p.next)}" data-p="${esc(p.project)}">受け取り箱へ</button></div>` : ''}</div>`).join('')
        : '<div class="empty">Claude Code・Codexで話した取り組みが、30分ごとにここへ並びます（a-TOPは除く）</div>'}
    </section>
    <section class="card">
      <div class="eyebrow">木村OS <small>${os.date ? (os.date === today ? '今朝の作戦会議' : `${esc(os.date)}の作戦会議`) : '朝の作戦会議から自動'}</small></div>
      ${(os.three || []).length ? `<ol class="os-three">${os.three.map(x => `<li>${esc(x)}</li>`).join('')}</ol>` : '<div class="empty">毎朝7時の作戦会議のあと、今日の3つがここに出ます</div>'}
      ${os.asks ? (low ? '<div class="os-asks muted">判断はあとででOKです</div>' : `<div class="os-asks">判断待ち <b>${os.asks}</b>件 <span class="muted">（7:30・20:00の承認ウィンドウ）</span></div>`) : ''}
      ${os.summary ? `<p class="os-sum">${esc(os.summary)}</p>` : ''}
      ${os.tree && os.tree.total ? `<div class="eyebrow" style="margin-top:10px">戦略ツリー（今月のタスク） <small>${os.tree.done}/${os.tree.total} 済</small></div>
        <div style="height:6px;border-radius:3px;background:rgba(127,127,127,.2);overflow:hidden"><div style="height:100%;width:${Math.round(100 * os.tree.done / os.tree.total)}%;background:currentColor;opacity:.55"></div></div>
        ${(os.tree.nextMe || []).length ? `<div class="muted" style="margin-top:6px">木村さんの次</div><ul class="os-list">${os.tree.nextMe.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
        ${(os.tree.nextAi || []).length ? `<details class="os-more"><summary>AIの次（${os.tree.nextAi.length}つ）</summary><ul class="os-list">${os.tree.nextAi.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}` : ''}
      ${os.atop && (os.atop.items || []).length ? `<details class="os-more"><summary>a-TOP：夜に${os.atop.count}件進めた（${esc(os.atop.date)}の夜）</summary><ul class="os-list">${os.atop.items.map(x => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
      ${['night', 'ai', 'askList', 'deadlines'].some(k => (os[k] || []).length) ? `<details class="os-more"><summary>ブリーフをひらく（夜の間に終わったこと・AIが進めたこと・判断・期限）</summary>
        ${[['night', '夜の間に終わったこと'], ['ai', 'AIが進めておいたこと'], ['askList', '判断してほしいこと'], ['deadlines', '期限が近いもの']].filter(([k]) => (os[k] || []).length)
          .map(([k, h]) => `<div class="eyebrow" style="margin-top:10px">${h}</div><ul class="os-list">${os[k].map(x => `<li>${esc(x)}</li>`).join('')}</ul>`).join('')}
      </details>` : ''}
    </section>
    <section class="card">
      <div class="eyebrow">AI家庭教師 <small>${tu ? '今日の号' : '今日の号はまだ'}</small><a class="eyebrow-act" href="https://ruikimu1012-lgtm.github.io/ai-tutor/" target="_blank" rel="noopener">ひらく ↗</a></div>
      ${tu ? `<p class="tutor-head">${esc(tu.headline || '')}</p>${tu.lesson?.title ? `<p class="muted">今日のミニ講座：${esc(tu.lesson.title)}</p>` : ''}` : `<div class="empty">${tutorNote ? esc(tutorNote) : '毎朝6:35ごろに届きます'}</div>`}
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
    ${moodState() === 'low' ? `<section class="card"><details><summary>状況（進行中の取り組み・木村OS・家庭教師）は、今日は見なくて大丈夫</summary>${statusCards()}</details></section>` : statusCards()}
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
    ${workoutCard()}
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
    <div class="sub-label">列</div>${chipGroup('lane', LANES.map(l => [l, `<span class="dot c-${LANE_COLOR(l)}"></span>${esc(laneInfo(l).name)}`]), t.id ? taskLane(t) : (t.lane || (t.color && t.color in COLORS ? t.color : 'blue')))}
    ${quests().filter(q => q.status !== 'done').length ? `<div class="sub-label">クエスト</div>${chipGroup('quest', [['', 'なし'], ...quests().filter(q => q.status !== 'done').map(q => [q.id, `${esc(laneInfo(q.lane || 'blue').mark)}・${esc(q.title)}`])], t.questId || '')}` : ''}
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
  'wb-done'(id, el) {
    const x = workItems().all.find(i => i.id === id); if (!x) return;
    if (x.task) { actions.toggle(x.task, el); return; }
    const wb = meta('workboard'), done = { ...(wb.done || {}) }, cut = now() - 30 * 864e5;
    for (const [k, v] of Object.entries(done)) if (v < cut) delete done[k];
    done[id] = now();
    write(store.set('meta', 'workboard', { done, pin: wb.pin === id ? null : wb.pin || null }));
    const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); buzz(15);
    toast(`おわった：${x.text}`, '取り消す', () => { const d2 = { ...(meta('workboard').done || {}) }; delete d2[id]; store.set('meta', 'workboard', { done: d2 }); });
  },
  'wb-ai'(id) {
    const x = workItems().all.find(i => i.id === id); if (!x) return;
    const wb = meta('workboard'), ai = { ...(wb.ai || {}) }, cut = now() - 14 * 864e5;
    for (const [k, v] of Object.entries(ai)) if ((v.at || 0) < cut) delete ai[k];
    ai[id] = { text: x.text, at: now(), src: x.src, detail: [x.due ? `期限：${wbDue(x.due)}` : '', x.min ? `目安：${x.min}` : ''].filter(Boolean).join('・') };
    write(store.set('meta', 'workboard', { ai })); buzz(10);
    toast('AIに送りました。1分ほどで VS Code に新しいタブが開きます', '取り消す', () => actions['wb-ai-cancel'](id));
  },
  'wb-ai-cancel'(id) {
    const wb = meta('workboard'), ai = { ...(wb.ai || {}) };
    if (!ai[id]) return;
    ai[id] = { ...ai[id], cancel: true, cancelAt: now() };
    write(store.set('meta', 'workboard', { ai })); buzz(8);
  },
  'wb-now'(id) { write(store.set('meta', 'workboard', { pin: id })); buzz(8); scrollTo({ top: 0, behavior: 'smooth' }); },
  'wb-skip'(id) { const nx = workItems().all.find(i => i.id !== id); write(store.set('meta', 'workboard', { pin: nx ? nx.id : null })); buzz(8); },
  go(_, el) { setTab(el.dataset.v); },

  'proj-next'(_, el) { write(store.add('inbox', { kind: 'task', text: el.dataset.v, detail: `進行中の取り組み「${el.dataset.p}」の次の候補`, source: 'claude', project: el.dataset.p, status: 'pending', createdAt: now() })); toast('受け取り箱に入れました（採用は受け取りボードで）'); buzz(8); },
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
  'now-from'(id) { const t = S.tasks.find(x => x.id === id); if (t) { write(store.set('meta', 'now', { text: t.title, taskId: id, since: now(), timerEnd: null })); buzz(10); if (tab !== 'ima') toast(`いまやること：${t.title}`, 'いまへ', () => setTab('ima')); } },
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
      title: f.title.value.trim(), lane: pick(f, 'lane') || 'blue', color: (pick(f, 'lane') || 'blue') === 'meta' ? 'blue' : (pick(f, 'lane') || 'blue'), questId: pick(f, 'quest') || '', today: pick(f, 'when') === 'today' ? dkey() : null,
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

/* ================= v7（2026-11-25）：いま・クエスト・記録 ================= */
// 列は聖典の3色＋ゲームマスター。列の名前は記録の中の聖典（meta/bible）から切り出す（言い換えない）。
// 公開ページには聖典の文を置かない決まりなので、読めない時は色の名前だけを出す。設定で名前を変えられる（meta/lanes）
const LANES = ['red', 'blue', 'green', 'meta'];
const LANE_MARK = { red: '赤', blue: '青', green: '緑', meta: 'GM' };
const MODE_LANE = { red: 'red', blue: 'blue', green: 'green', gm: 'meta' };
const LANE_COLOR = l => (l === 'meta' ? 'violet' : l);
function laneInfo(l) {
  const custom = meta('lanes')[l] || {}, s = bible?.seiten || '';
  let name = '', sub = '';
  if (l === 'meta') {
    const m = s.match(/^#+\s*■?\s*スキル\d+：(ゲームマスター)\s*$/m); if (m) name = m[1];
    const sec = s.split(/^## /m).find(x => /^■?\s*スキル\d+：ゲームマスター/.test(x)) || '';
    sub = [...sec.matchAll(/^(\d+)\.\s+(.+)$/gm)].slice(0, 3).map(x => `${x[1]}. ${x[2].trim()}`).join('　');
  } else {
    const k = LANE_MARK[l];
    const m = s.match(new RegExp(`【${k}】([^：*]+)：`)); if (m) name = m[1].trim();
    const t = s.match(new RegExp(`^\\|\\s*\\*\\*${k}（[^）]*）\\*\\*\\s*\\|\\s*([^|]+?)\\s*\\|`, 'm')); if (t) sub = t[1];
  }
  return { mark: LANE_MARK[l], name: custom.name || name || LANE_MARK[l], sub: custom.name ? '' : sub };
}
const goalLane = g => !g ? '' : g.lane || (/習慣/.test(g.title) ? 'meta' : /健康/.test(g.title) ? 'green' : /稼/.test(g.title) ? 'blue' : /表現|アーティスト/.test(g.title) ? 'red' : col(g.color));
const quests = () => S.tasks.filter(t => t.kind === 'quest' && t.status !== 'stored');
const questById = id => S.tasks.find(t => t.id === id && t.kind === 'quest');
const isLane = l => LANES.includes(l);
function boxLane(box) {
  if (!box) return '';
  const [k, a] = box.split(':');
  if (k === 'q') { const q = questById(box.slice(2)); return q ? (isLane(q.lane) ? q.lane : 'blue') : ''; }
  if (k === 'g') return goalLane(S.goals.find(g => g.id === box.slice(2)));
  return isLane(a) ? a : '';
}
// 名前だけのクエスト（橋が付けた名前）と同じ名前の本物のクエストがあれば、そちらにまとめる
function resolveBox(box) {
  if (!box || !box.startsWith('v:')) return box;
  const [, lane, ...rest] = box.split(':'), name = rest.join(':');
  const q = quests().find(q => !q.parentId && (q.lane || 'blue') === lane && q.title === name);
  return q ? 'q:' + q.id : box;
}
function boxTitle(box) {
  const [k] = box.split(':');
  if (k === 'q') return questById(box.slice(2))?.title || 'クエスト';
  if (k === 'g') return S.goals.find(g => g.id === box.slice(2))?.title || '目的';
  if (k === 'v') return box.split(':').slice(2).join(':');
  return 'そのほか';
}
function taskBox(t) {
  if (t.questId && questById(t.questId)) return 'q:' + t.questId;
  if (t.box) return resolveBox(t.box);
  if (t.goalId && S.goals.some(g => g.id === t.goalId)) return 'g:' + t.goalId;
  return 'x:' + taskLane(t);
}
function taskLane(t) {
  if (isLane(t.lane)) return t.lane;
  if (t.questId) { const q = questById(t.questId); if (q) return isLane(q.lane) ? q.lane : 'blue'; }
  if (t.goalId) { const g = S.goals.find(g => g.id === t.goalId); if (g) return goalLane(g); }
  return col(t.color);
}
const tdone = id => (meta('workboard').done || {})[id];
// 付箋（シルベのタスク＋木村OSの橋が送る物）をひとつの形にそろえる
function cardsAll() {
  const k = dkey(), os = meta('status-kimuraos'), wb = meta('workboard'), done = wb.done || {}, place = wb.place || {};
  const titles = new Set(S.tasks.filter(t => t.kind !== 'quest').map(t => wbNorm(t.title)));
  const out = [];
  for (const t of S.tasks) {
    if (t.kind === 'quest' || t.status === 'stored') continue;
    const box = taskBox(t);
    out.push({ id: 't:' + t.id, task: t.id, src: 'mine', text: t.title, lane: boxLane(box) || taskLane(t), box, due: t.due || '', today: !!(t.today && t.today <= k),
      min: t.minutes ? `${t.minutes}分` : '', rank: 1 - (t.urgency || 0) * 0.3, done: t.status === 'done', doneDay: t.doneDay || '', owner: t.owner || 'me', reward: t.reward || '' });
  }
  for (const x of os.board || []) {
    if (titles.has(wbNorm(x.text))) continue;
    const p = place[x.id] || {}, lane = isLane(p.lane) ? p.lane : isLane(x.lane) ? x.lane : 'blue';
    const box = resolveBox(p.box || (x.quest ? `v:${lane}:${x.quest}` : `x:${lane}`));
    out.push({ ...x, lane: boxLane(box) || lane, box, owner: x.owner || 'me', done: !!done[x.id], doneDay: done[x.id] ? dkey(new Date(done[x.id] - 4 * 3600e3)) : '', today: !!(x.due && x.due <= k) });
  }
  return out;
}
const dayPlus = n => dkey(addDays(n));
function inFilter(c, f) {
  const k = dkey();
  if (c.done) return f !== 'ima' ? false : c.doneDay === k;
  if (f === 'ima') return c.owner !== 'ai' && (c.src === 'mine' ? c.today : (!c.due || c.due <= dayPlus(7)));
  if (f === 'today') return c.today || (c.due && c.due <= k);
  if (f === 'week') return c.today || !c.due || c.due <= dayPlus(7);
  return true;
}

/* ---- 配置（PCとスマホで別々・meta/layout の pc／phone）。データ自体は共通 ---- */
let layoutPending = {}, layoutTimer = null;
const blankLayout = () => ({ order: {}, qorder: {}, fold: {} });
function layoutOf(dev = device()) { const L = layoutPending[dev] || meta('layout')[dev] || {}; return { ...blankLayout(), ...JSON.parse(JSON.stringify(L)) }; }
function saveLayout(L, dev = device()) {
  layoutPending[dev] = L;
  clearTimeout(layoutTimer);
  layoutTimer = setTimeout(() => { const P = layoutPending; layoutPending = {}; for (const [d, v] of Object.entries(P)) write(store.set('meta', 'layout', { [d]: { ...v, at: now() } })); }, 1500);
}
const sortBy = (list, order, key = x => x.id) => {
  const idx = new Map((order || []).map((id, i) => [id, i]));
  return list.map((x, i) => [x, idx.has(key(x)) ? idx.get(key(x)) : 1e4 + i]).sort((a, b) => a[1] - b[1]).map(a => a[0]);
};
const defaultCardSort = (a, b) => (a.done - b.done) || (b.today - a.today) || (a.due || '9999').localeCompare(b.due || '9999') || (a.rank ?? 9) - (b.rank ?? 9);

/* ---- 列とクエストの小箱 ---- */
function buildLane(lane, cards, f, L) {
  const all = cardsAll();
  const boxes = new Map();
  const ensure = key => { if (!boxes.has(key)) boxes.set(key, { key, items: [], subs: [] }); return boxes.get(key); };
  if (f === 'all') for (const q of quests().filter(q => (q.lane || 'blue') === lane && q.status !== 'done')) ensure('q:' + q.id);
  for (const c of cards) ensure(c.box).items.push(c);
  // サブクエストは親の中へ（1段まで）
  for (const b of [...boxes.values()]) {
    const q = b.key.startsWith('q:') && questById(b.key.slice(2));
    if (q && q.parentId && questById(q.parentId)) { const p = ensure('q:' + q.parentId); p.subs.push(b); boxes.delete(b.key); }
  }
  const stats = key => {
    const keys = new Set([key, ...quests().filter(q => 'q:' + q.parentId === key).map(q => 'q:' + q.id)]);
    const xs = all.filter(c => keys.has(c.box)); return { total: xs.length, done: xs.filter(c => c.done).length };
  };
  const list = sortBy([...boxes.values()], L.qorder[lane], b => b.key).sort((a, b) => {
    const ia = (L.qorder[lane] || []).indexOf(a.key), ib = (L.qorder[lane] || []).indexOf(b.key);
    if (ia >= 0 || ib >= 0) return (ia < 0 ? 1e4 : ia) - (ib < 0 ? 1e4 : ib);
    const qa = questById(a.key.slice(2)), qb = questById(b.key.slice(2));
    return (a.key.startsWith('x:') - b.key.startsWith('x:')) || ((qa?.due || '9999').localeCompare(qb?.due || '9999')) || (b.items.length - a.items.length);
  });
  return { list, stats };
}
function stickyCard(c) {
  const k = dkey(), j = dispatchOf(c.id);
  const bits = [c.src !== 'mine' ? `<span class="wb-chip s-${esc(c.src)}">${esc(WB_SRC[c.src] || '')}</span>` : '',
    c.due ? `<span class="${c.due < k && !c.done ? 'wb-late' : ''}">${esc(wbDue(c.due))}</span>` : c.today && !c.done ? '<span>今日</span>' : '',
    c.min ? `<span>約${esc(String(c.min).replace(/^約/, ''))}</span>` : '',
    j ? `<span class="wb-dsp ${(DSP_ST[j.state] || [])[1] || ''}">${esc((DSP_ST[j.state] || [''])[0])}</span>` : ''].filter(Boolean).join('');
  const isNow = nowItems().some(n => n.ref === c.id);
  if (c.owner === 'ai' && !c.done) return `<div class="st st-ai c-${LANE_COLOR(c.lane)}" data-cid="${esc(c.id)}"><button class="st-body" data-act="c-open" data-id="${esc(c.id)}"><span class="st-ai-mark">AI</span><span class="st-t">${esc(c.text)}</span>${bits ? `<small class="st-m">${bits}</small>` : ''}</button></div>`;
  return `<div class="st c-${LANE_COLOR(c.lane)} ${c.done ? 'done' : ''} ${isNow ? 'is-now' : ''}" data-cid="${esc(c.id)}">
    <button class="st-body" data-act="c-open" data-id="${esc(c.id)}"><span class="st-t">${esc(c.text)}</span>${bits ? `<small class="st-m">${bits}</small>` : ''}</button>
    ${c.done ? '<span class="st-ok">✓</span>' : `<div class="st-acts">${isNow ? '' : `<button class="st-play" data-act="c-now" data-id="${esc(c.id)}" aria-label="今やることに" title="今やることに">▶</button>`}<button class="st-chk" data-act="c-done" data-id="${esc(c.id)}" aria-label="終わった" title="終わった">✓</button></div>`}
  </div>`;
}
function questBox(b, f, L, stats, depth = 0) {
  const q = b.key.startsWith('q:') ? questById(b.key.slice(2)) : null;
  const items = sortBy(b.items.slice().sort(defaultCardSort), L.order[b.key]);
  const st = stats(b.key), open = items.filter(c => !c.done).length + b.subs.reduce((a, s) => a + s.items.filter(c => !c.done).length, 0);
  const cleared = st.total > 0 && st.done === st.total;
  const fold = L.fold[b.key] ?? (cleared && f !== 'ima');
  const k = dkey();
  // ボス：期限のある本物のクエスト。HP＝残り。期限を過ぎても色は変えない（罰なし）
  const boss = q && q.due;
  const hp = st.total ? (st.total - st.done) / st.total : 1;
  const head = `<div class="qhead">
      <button class="qh-t" data-act="q-open" data-id="${esc(b.key)}"><b>${esc(boxTitle(b.key))}</b>${q?.parentId ? '<span class="qh-sub">サブ</span>' : ''}</button>
      <span class="qh-n">${cleared ? 'クリア ✓' : st.total ? `${st.done}/${st.total}` : ''}</span>
      <button class="qh-fold" data-act="q-fold" data-id="${esc(b.key)}" aria-label="${fold ? 'ひらく' : 'たたむ'}">${fold ? '▸' : '▾'}</button>
    </div>
    ${boss ? `<div class="hp" title="ボスのHP"><span>HP</span><div class="hp-bar"><i style="transform:scaleX(${hp})"></i></div><small>${esc(wbDue(q.due))}</small></div>`
      : st.total && !cleared ? `<div class="progress thin"><i style="transform:scaleX(${st.done / st.total})"></i></div>` : ''}`;
  return `<div class="qbox ${depth ? 'qsub' : ''} ${cleared ? 'cleared' : ''} ${fold ? 'folded' : ''}" data-box="${esc(b.key)}">
    ${head}
    ${fold ? (open ? `<div class="q-folded muted">${open}件</div>` : '') : `<div class="qlist" data-box="${esc(b.key)}">${items.map(stickyCard).join('')}</div>
      ${b.subs.map(s => questBox(s, f, L, stats, 1)).join('')}
      ${f !== 'ima' ? `<button class="q-add" data-act="c-add" data-id="${esc(b.key)}">＋ 付箋</button>` : ''}`}
  </div>`;
}
let laneOpen = {};
function lanesHtml(f) {
  const cards = cardsAll().filter(c => inFilter(c, f)), L = layoutOf(), mode = meta('mode').mode, focus = MODE_LANE[mode];
  const k = dkey(), low = moodState() === 'low';
  const order = focus ? [focus, ...LANES.filter(l => l !== focus)] : LANES;
  return `<div class="lanes ${focus ? 'has-focus' : ''}">${order.map(lane => {
    const info = laneInfo(lane), mine = cards.filter(c => c.lane === lane);
    const aiN = cardsAll().filter(c => c.lane === lane && c.owner === 'ai' && !c.done).length;
    const collapsed = laneOpen[lane] != null ? !laneOpen[lane] : (focus && lane !== focus && mode !== 'muteki');
    const urgent = mine.filter(c => !c.done && c.owner !== 'ai' && (c.today || (c.due && c.due <= k)));
    const { list, stats } = buildLane(lane, mine, f, L);
    const shown = low && f === 'ima' ? list.slice(0, 1) : list;
    return `<section class="lane c-${LANE_COLOR(lane)} ${collapsed ? 'collapsed' : ''} ${focus === lane ? 'focus' : ''}">
      <button class="lane-head" data-act="lane-toggle" data-id="${lane}"><span class="lane-mark">${esc(info.mark)}</span><span class="lane-name"><b>${esc(info.name)}</b>${info.sub && !collapsed ? `<small>${esc(info.sub)}</small>` : ''}</span>
        <span class="lane-n">${mine.filter(c => !c.done && c.owner !== 'ai').length || ''}${aiN ? `<em>AI ${aiN}</em>` : ''}</span><span class="lane-fold">${collapsed ? '▸' : '▾'}</span></button>
      ${collapsed ? (urgent.length ? `<div class="lane-urgent">${urgent.slice(0, 4).map(stickyCard).join('')}</div>` : '')
        : `<div class="lane-body" data-lane="${lane}">${shown.map(b => questBox(b, f, L, stats)).join('') || `<div class="kc-empty">${f === 'ima' ? '今日の付箋はありません' : 'まだありません'}</div>`}</div>
        ${f !== 'ima' ? `<button class="q-add q-new" data-act="q-new" data-id="${lane}">＋ クエスト</button>` : ''}`}
    </section>`;
  }).join('')}</div>`;
}

/* ---- 今やること（複数）＋タイムアタック ---- */
const TA_MIN = [5, 15, 25, 50];
const nowItems = () => meta('nowlist').items || [];
const setNow = items => write(store.set('meta', 'nowlist', { items, updatedAt: now() }));
const mmss = ms => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
function nowCards() {
  const items = nowItems(), cards = new Map(cardsAll().map(c => [c.id, c]));
  const one = n => {
    const c = cards.get(n.ref), lane = (c && c.lane) || n.lane || 'blue', ta = n.ta;
    return `<section class="card wb-now now7 c-${LANE_COLOR(lane)}" data-ref="${esc(n.ref)}">
      <div class="eyebrow">今やること <small>${esc(laneInfo(lane).name)}${c && c.box ? `・${esc(boxTitle(c.box))}` : ''}</small></div>
      <div class="wb-big">${esc(n.text)}</div>
      ${ta ? `<div class="ta" data-start="${ta.start}" data-min="${ta.min}"><b class="ta-t">--:--</b><span class="ta-l">${ta.min ? `${ta.min}分で倒す` : '計測中'}</span></div>`
        : `<div class="ta-pick"><span class="muted">タイムアタック</span>${TA_MIN.map(m => `<button class="btn sm" data-act="ta" data-id="${esc(n.ref)}" data-v="${m}">${m}分</button>`).join('')}<button class="btn sm ghost" data-act="ta" data-id="${esc(n.ref)}" data-v="0">決めずに測る</button></div>`}
      <div class="row"><button class="btn primary wb-go" data-act="ta-done" data-id="${esc(n.ref)}">倒した ✓</button><button class="btn ghost" data-act="now-off" data-id="${esc(n.ref)}">ひと区切り</button></div>
    </section>`;
  };
  return `<div class="now-row n${Math.min(items.length, 3)}">${items.map(one).join('')}
    ${items.length < 3 ? `<section class="card now-add"><div class="eyebrow">${items.length ? 'もう1つ選ぶ' : '今やること'}</div>
      ${items.length ? '' : '<p class="muted">付箋の ▶ を押すと、ここに並びます（3つまで）</p>'}
      <form class="field" data-form="nowfree"><input name="t" placeholder="いま、何をやる？" autocomplete="off" enterkeyhint="go"><button class="btn">始める</button></form></section>` : ''}
  </div>`;
}
let taRung = new Set(), taLoop;
function tickTA() {
  clearInterval(taLoop);
  const els = [...document.querySelectorAll('.ta[data-start]')]; if (!els.length) return;
  const step = () => els.forEach(el => {
    const start = +el.dataset.start, min = +el.dataset.min, t = el.querySelector('.ta-t'); if (!t) return;
    if (!min) { t.textContent = mmss(now() - start); return; }
    const left = start + min * 60e3 - now();
    if (left >= 0) { t.textContent = mmss(left); el.classList.remove('over'); }
    else {
      t.textContent = `+${Math.ceil(-left / 60000)}分`; el.classList.add('over');
      const key = start + ':' + min;
      if (!taRung.has(key) && -left < 60e3 && document.visibilityState === 'visible') { taRung.add(key); chime([784, 988, 1175]); buzz([60, 60, 60]); notify('時間です', '倒したら「倒した ✓」。まだなら、そのまま続けてOK'); }
    }
  });
  step(); taLoop = setInterval(step, 1000);
}
function recordRun(n, done) {
  if (!n.ta) return null;
  const actual = Math.max(1, Math.round((now() - n.ta.start) / 60000));
  const runs = [...(todayLog().runs || []), { text: n.text, ref: n.ref, lane: n.lane || '', plan: n.ta.min || 0, actual, at: now(), done }];
  setLog({ runs });
  if (!done) return { actual };
  const key = wbNorm(n.text);
  const prev = S.logs.flatMap(l => l.runs || []).filter(r => r.done && wbNorm(r.text) === key && r.at < now() - 1000).sort((a, b) => b.at - a.at)[0];
  return { actual, faster: prev && prev.actual > actual ? prev.actual - actual : 0 };
}
function markCardDone(id, el) {
  if (id.startsWith('t:')) { const t = S.tasks.find(x => x.id === id.slice(2)); if (t && t.status !== 'done') actions.toggle(t.id, el); return; }
  if (id.startsWith('f:')) return;
  const wb = meta('workboard'), done = { ...(wb.done || {}) }, cut = now() - 30 * 864e5;
  for (const [k, v] of Object.entries(done)) if (v < cut) delete done[k];
  done[id] = now(); write(store.set('meta', 'workboard', { done }));
  if (el) { const r = el.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + r.height / 2); } buzz(15);
}

/* ---- いま気にする物（全モードで出す）：AIの確認待ち・判断待ち ---- */
function attention() {
  const d = meta('status-dispatch'), asks = (d.jobs || []).filter(j => j.state === 'ask'), os = meta('status-kimuraos');
  if (!asks.length && !os.asks) return '';
  return `<section class="card attn"><div class="eyebrow">確認待ち <small>どのモードでも出ます</small></div>
    ${asks.map(j => `<div class="attn-row"><div class="attn-t"><b>${esc(j.text)}</b>${j.first ? `<small>${esc(j.first)}</small>` : ''}</div>
      <div class="attn-a"><button class="btn sm primary" data-act="ai-yes" data-id="${esc(j.id)}">Yes で続ける</button>${device() === 'pc' && j.sid ? `<a class="btn sm ghost" href="${vsLink(j.sid, j.kind)}">VS Code で見る</a>` : ''}</div></div>`).join('')}
    ${os.asks ? `<div class="attn-row"><div class="attn-t"><b>判断待ち ${os.asks}件</b><small>7:30・20:00の承認ウィンドウ（チーフの承認キュー）</small></div></div>` : ''}
  </section>`;
}

/* ---- AIの小さな表示 ---- */
const vsLink = (sid, kind = 'claude') => `vscode://kimura-local.session-restore/open?sid=${encodeURIComponent(sid)}&kind=${encodeURIComponent(kind || 'claude')}`;
const fileLink = p => /^https?:/.test(p) ? p : `vscode://file${encodeURI(p)}`;
function aiMini() {
  const r = meta('status-running'), d = meta('status-dispatch');
  const live = (r.list || []).filter(x => x.state !== 'stop').length, jobs = (d.jobs || []).filter(j => !['done', 'stale', 'cancel'].includes(j.state)).length;
  const ask = (d.jobs || []).filter(j => j.state === 'ask').length, wait = (r.list || []).filter(x => x.state === 'wait').length;
  const fin = (d.jobs || []).filter(j => j.state === 'done' && (j.out || []).length).length;
  return `<button class="ai-mini ${ask ? 'hot' : live + jobs ? 'on' : ''}" data-act="ai-sheet" title="動いているAI・任せた仕事"><i></i>AI ${live + jobs}${ask ? `・確認${ask}` : wait ? `・返事待ち${wait}` : ''}${fin ? `・📦${fin}` : ''}</button>`;
}
function aiSheetBody() {
  const r = meta('status-running'), d = meta('status-dispatch'), wb = meta('workboard'), pc = device() === 'pc';
  const jobs = d.jobs || [], live = (r.list || []);
  const link = (sid, kind) => sid ? (pc ? `<a class="btn sm ghost" href="${vsLink(sid, kind)}">VS Code で開く</a>` : '<span class="muted pc-only">PCで開く</span>') : '';
  const outs = j => (j.out || []).map(p => pc || /^https?:/.test(p) ? `<a class="chest" href="${esc(fileLink(p))}" ${/^https?:/.test(p) ? 'target="_blank" rel="noopener"' : ''}>📦 ${esc(p.split('/').pop())}</a>` : `<span class="chest muted">📦 ${esc(p.split('/').pop())}（PCで開く）</span>`).join('');
  const job = j => { const [l, c] = DSP_ST[j.state] || ['', '']; return `<div class="run ${c}"><i></i><div class="run-t"><b>${esc(j.text)}</b><small>${esc(l)}・${esc(j.tool || '')}・${ago(j.last || j.at, '前')}${j.first ? `<br>${esc(j.first)}` : ''}</small>
    <div class="run-a">${j.state === 'ask' ? `<button class="btn sm primary" data-act="ai-yes" data-id="${esc(j.id)}">Yes で続ける</button>` : ''}${link(j.sid, j.kind)}${outs(j)}</div></div></div>`; };
  const chat = x => `<div class="run ${RUN_ST[x.state]?.[1] || ''}"><i></i><div class="run-t"><b>${esc(x.title)}</b><small>${esc(RUN_ST[x.state]?.[0] || '')}・${esc(x.tool)}${x.place && x.place !== x.title ? `・${esc(x.place)}` : ''}・${ago(x.at, '前')}</small>
    <div class="run-a">${x.panel ? '<span class="muted">VS Code の Claude パネルの会話（タブへは飛べません）</span>' : link(x.sid, x.kind)}</div></div></div>`;
  const autoOff = !!wb.autoOff;
  return `<div class="set-row"><span>AIでできる物を自動で任せる</span><button class="chip ${autoOff ? '' : 'on'}" data-act="auto-toggle">${autoOff ? '止めています' : 'オン'}</button></div>
    <p class="muted" style="font-size:12px">今日 ${d.autoToday || 0} / ${d.autoMax || 3} 件（上限）。外に送る・公開・お金・消す/移す/上書き・契約/ログイン・a-TOPの外向きは、手前で止まって「確認待ち」に出ます${d.waitWhy ? `。待っている理由：${esc(d.waitWhy)}` : ''}</p>
    <div class="sub-label">任せた仕事 <small>${jobs.length}件</small></div>
    <div class="run-list">${jobs.length ? jobs.map(job).join('') : '<div class="empty">今はありません</div>'}</div>
    <div class="sub-label">動いている会話 <small>${live.filter(x => x.state !== 'stop').length}件${r.updatedAt && now() - r.updatedAt > 20 * 60e3 ? `・見張りが${ago(r.updatedAt, '前')}から止まっています` : ''}</small></div>
    <div class="run-list">${live.length ? live.map(chat).join('') : '<div class="empty">今動いているAIはありません</div>'}</div>
    ${pc ? '' : '<p class="muted" style="font-size:12px;margin-top:10px">スマホからは会話へ飛べません。状態と1行目だけを出しています</p>'}`;
}

/* ---- 日課（いまのボードでは1行に） ---- */
function habitsStrip() {
  const hs = activeHabits(), done = todayLog().habits || {};
  if (!hs.length) return '';
  const slots = Object.keys(SLOTS).filter(s => hs.some(h => h.slot === s)), doneN = hs.filter(h => done[h.id]).length;
  return `<section class="card hstrip"><div class="eyebrow">日課 <small>${doneN} / ${hs.length}</small><button class="eyebrow-act" data-act="habit-edit">編集</button></div>
    <div class="hs-row no-swipe">${slots.map(s => `<span class="slot-name">${SLOTS[s]}</span>${hs.filter(h => h.slot === s).map(h => isWorkoutHabit(h)
      ? `<button class="habit wo-habit c-${col(h.color)} ${done[h.id] || woToday().done ? 'on' : ''}" data-act="workout-open"><i></i>${esc(h.title)}：${WO_KIND[woToday().kind]}${woToday().kind === 'rest' ? '' : 'の日'}</button>`
      : `<button class="habit c-${col(h.color)} ${done[h.id] ? 'on' : ''}" data-act="habit" data-id="${h.id}"><i></i>${esc(h.title)}</button>`).join('')}`).join('')}</div></section>`;
}

/* ---- ボード：いま ---- */
let legacyNowMoved = false;
function viewIma() {
  const st = moodState(), mode = meta('mode'), t = todayLog(), tod = timeOfDay(), h = new Date().getHours();
  const n0 = meta('now');
  if (!booting && !legacyNowMoved && !nowItems().length && n0.text) {   // v6 までの「いまやってること」を1つ目に引っ越す
    legacyNowMoved = true;
    setNow([{ ref: n0.taskId ? 't:' + n0.taskId : 'f:' + now(), text: n0.text, at: n0.since || now() }]);
    write(store.set('meta', 'now', { text: '', taskId: null, since: null, timerEnd: null }));
  }
  const fresh = !prefs.onboarded && (!S.tasks.length || !S.habits.length || !S.goals.length);
  const ritualMorning = (tod === 'morning' || tod === 'day') && t.energy == null, ritualNight = h >= 20 || h < 3;
  const clock = new Date().toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
  const pend = S.inbox.filter(x => x.status === 'pending').length;
  return `<div class="wide ima">
    <div class="ima-top">
      <div class="ima-when"><b class="wb-clock">${clock}</b><span class="muted">${new Date().toLocaleDateString('ja-JP', { month: 'long', day: 'numeric', weekday: 'short' })}</span>
        <button class="state-pill s-${st}" data-act="compass-open">${STATES[st].name}</button></div>
      <div class="ima-tools no-swipe">
        <div class="modes7" role="group" aria-label="モード">${Object.entries(MODES).map(([k, v]) => `<button class="m7 m-${v.c} ${mode.mode === k ? 'on' : ''}" data-act="mode" data-v="${k}" title="${esc(v.name)}モード">${esc(v.name)}</button>`).join('')}</div>
        ${aiMini()}
        ${pend ? `<button class="ai-mini" data-act="inbox-open">受け取り ${pend}</button>` : ''}
      </div>
    </div>
    ${fresh ? onboarding() : ''}
    ${needsReset() ? `<section class="card reset"><div class="eyebrow">リセット・プロトコル</div>
      <p>ルーティンが崩れた時は、「翌朝の散歩と瞑想」を完了させた時点でOSが完全に再起動（リセット）されたとみなす。</p>
      <p class="muted" style="margin-top:6px">何日空いても、記録は1つも減っていません。</p></section>` : ''}
    ${attention()}
    ${nowCards()}
    ${habitsStrip()}
    ${lanesHtml('ima')}
    <div class="ima-misc">
      ${ritualMorning ? `<section class="card ritual"><div class="eyebrow">朝の儀 <small>2タップで終わります</small></div>
        <p class="muted">ゆうべの睡眠</p>${sleepChips(t)}
        <p class="muted" style="margin-top:12px">いまの気分は？</p>
        <div class="quick-mood">${[[2, 2, '絶好調'], [1, 1, 'いい感じ'], [0, 0, 'ふつう'], [-1, -1, 'いまいち'], [-2, -2, 'しんどい']].map(([e, p, w]) => `<button data-act="mood" data-e="${e}" data-p="${p}" style="--m:${moodColor(e, p)}"><i></i>${w}</button>`).join('')}</div></section>` : ''}
      <section class="card">
        <div class="eyebrow">思いついたら投げ込む <small>あとで受け取り箱で仕分け</small></div>
        <form data-form="memo"><div class="memo-wrap"><textarea class="full" name="t" rows="2" placeholder="タスクでも、思いつきでも、気持ちでも"></textarea>
        ${speechOK ? `<button type="button" class="mic" data-act="mic" aria-label="声で入力"><svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>` : ''}</div>
        <div class="row end"><button class="btn primary">受け取り箱へ</button></div></form>
      </section>
      ${ritualNight ? `<section class="card ritual"><div class="eyebrow">夜のしめくくり</div>
        <form data-form="night"><input class="full" name="t" value="${esc(t.night || '')}" placeholder="今日いちばん良かったこと、ひとことだけ" autocomplete="off" enterkeyhint="done">
        <div class="row end"><button class="btn primary">しめくくる</button></div></form></section>` : ''}
    </div>
  </div>`;
}

/* ---- ボード：クエスト（全体・計画） ---- */
function viewQuest() {
  loadTutor();
  const word = todaysWord(), f = prefs.qfilter || 'week';
  return `
  <div class="wide">
    <section class="card values-hero compact">
      <div class="eyebrow">価値観 <button class="eyebrow-act" data-act="compass-open">羅針盤をひらく</button></div>
      <div class="three">${valueWords().map(w => `<span>${esc(w)}</span>`).join('')}</div>
      ${word ? `<p class="hero-word">${esc(word.text)}</p><p class="muted hero-src">${esc(word.head)}（聖典）</p>` : ''}
    </section>
    <section class="card lanes-card">
      <div class="eyebrow">クエスト <small>付箋は${device() === 'phone' ? '長押しで持ち上げて' : 'ドラッグで'}動かせます</small>
        <span class="qf no-swipe">${[['today', '今日'], ['week', '今週'], ['all', '全部']].map(([k, v]) => `<button class="chip ${f === k ? 'on' : ''}" data-act="qfilter" data-v="${k}">${v}</button>`).join('')}</span></div>
      ${lanesHtml(f)}
    </section>
  </div>
  <div class="col">
    ${moodState() === 'low' ? `<section class="card"><details><summary>状況（進行中の取り組み・木村OS・家庭教師）は、今日は見なくて大丈夫</summary>${statusCards()}</details></section>` : statusCards()}
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

/* ---- 付箋・クエストの操作 ---- */
function boxFields(box) {
  const [k] = box.split(':'), lane = boxLane(box) || 'blue';
  if (k === 'q') return { questId: box.slice(2), box: '', lane: '' };
  if (k === 'g') return { goalId: box.slice(2), questId: '', box: '', lane: '' };
  if (k === 'v') return { box, questId: '', lane };
  return { box: '', questId: '', goalId: '', lane };
}
function moveCard(id, toBox) {
  const lane = boxLane(toBox) || 'blue';
  if (id.startsWith('t:')) { write(store.set('tasks', id.slice(2), { ...boxFields(toBox), color: lane === 'meta' ? 'blue' : lane })); return; }
  const place = { ...(meta('workboard').place || {}) }; place[id] = { box: toBox, lane }; write(store.set('meta', 'workboard', { place }));
}
function questSheet(q = {}, lane = 'blue') {
  const L = q.lane || lane, parents = quests().filter(x => !x.parentId && x.id !== q.id && x.status !== 'done');
  return `<h3>${q.id ? 'クエストを直す' : 'クエストを足す'}</h3><form data-form="quest" data-id="${q.id || ''}">
    <input class="full title-in" name="title" value="${esc(q.title || '')}" placeholder="例：祖父に曲を届ける" autocomplete="off" required enterkeyhint="done">
    <div class="sub-label">列</div>${chipGroup('lane', LANES.map(l => [l, `<span class="dot c-${LANE_COLOR(l)}"></span>${esc(laneInfo(l).name)}`]), L)}
    <div class="sub-label">期限 <small>入れるとボス（HPバー）になります</small></div><input class="full" type="date" name="due" value="${esc(q.due || '')}">
    ${parents.length ? `<div class="sub-label">親のクエスト <small>サブクエストにする時だけ</small></div>${chipGroup('parent', [['', 'なし'], ...parents.map(p => [p.id, esc(p.title)])], q.parentId || '')}` : ''}
    <div class="row end">${q.id ? `<button type="button" class="btn ghost" data-act="q-store" data-id="${q.id}">しまう</button><button type="button" class="btn" data-act="q-clear" data-id="${q.id}">クエストを終える</button>` : ''}<button class="btn primary">${q.id ? '保存' : '足す'}</button></div>
  </form>${q.id && !q.parentId ? `<div class="row"><button class="btn sm" data-act="q-sub" data-id="${q.id}">＋ サブクエスト</button></div>` : ''}`;
}
function cardSheet(c) {
  const boxes = []; for (const l of LANES) { const { list } = buildLane(l, cardsAll().filter(x => x.lane === l), 'all', layoutOf()); for (const b of list) { boxes.push([b.key, `${laneInfo(l).mark}・${boxTitle(b.key)}`]); b.subs.forEach(s => boxes.push([s.key, `${laneInfo(l).mark}・${boxTitle(s.key)}`])); } }
  for (const l of LANES) if (!boxes.some(b => b[0] === 'x:' + l)) boxes.push(['x:' + l, `${laneInfo(l).mark}・そのほか`]);
  return `<h3>${esc(c.text)}</h3>
    <p class="muted">${esc(WB_SRC[c.src] || '')}${c.due ? `・${esc(wbDue(c.due))}` : ''}${c.min ? `・約${esc(String(c.min).replace(/^約/, ''))}` : ''}${c.owner === 'ai' ? '・AIの担当（自動で進みます）' : ''}</p>
    <div class="row">${c.done ? '' : `<button class="btn primary" data-act="c-now" data-id="${esc(c.id)}">今やることに</button><button class="btn" data-act="c-done" data-id="${esc(c.id)}">終わった ✓</button>`}${c.owner !== 'ai' && !c.done ? aiTag(c) : ''}</div>
    <div class="sub-label">クエストを移す <small>ドラッグでも動かせます</small></div>
    <div class="chips wrap">${boxes.map(([k, v]) => `<button class="chip ${k === c.box ? 'on' : ''}" data-act="c-move" data-id="${esc(c.id)}" data-v="${esc(k)}">${esc(v)}</button>`).join('')}</div>`;
}
const findCard = id => cardsAll().find(c => c.id === id);
Object.assign(actions, {
  'c-open'(id) { if (dragging || now() - dragEnd < 400) return; const c = findCard(id); if (!c) return; if (c.task) actions['task-edit'](c.task); else openSheet(cardSheet(c)); },
  'c-now'(id) {
    const c = findCard(id); if (!c) return; const items = nowItems();
    if (items.some(n => n.ref === id)) return toast('もう今やることに入っています');
    if (items.length >= 3) return toast('今やることは3つまでです。どれかを「ひと区切り」にしてから');
    setNow([...items, { ref: id, text: c.text, lane: c.lane, at: now() }]); buzz(10); closeSheet('all');
    if (tab !== 'ima') toast(`今やること：${c.text}`, 'いまへ', () => setTab('ima')); else scrollTo({ top: 0, behavior: 'smooth' });
  },
  'c-done'(id, el) { const c = findCard(id); if (!c) return; markCardDone(id, el); setNow(nowItems().filter(n => n.ref !== id)); closeSheet('all'); if (!id.startsWith('t:')) toast(`おわった：${c.text}`, '取り消す', () => { const d2 = { ...(meta('workboard').done || {}) }; delete d2[id]; store.set('meta', 'workboard', { done: d2 }); }); },
  'c-move'(id, el) { moveCard(id, el.dataset.v); closeSheet('all'); toast('移しました'); },
  'c-add'(box) { openSheet(`<h3>付箋を足す</h3><p class="muted">${esc(boxTitle(box))}</p><form data-form="cadd" data-box="${esc(box)}"><input class="full" name="t" placeholder="やること" autocomplete="off" required enterkeyhint="done">
    <div class="sub-label">いつ</div>${chipGroup('when', [['today', '今日やる'], ['later', 'あとで']], 'later')}<div class="row end"><button class="btn primary">足す</button></div></form>`); },
  ta(ref, el) { const m = +el.dataset.v; askNotify(); setNow(nowItems().map(n => n.ref === ref ? { ...n, ta: { min: m, start: now() } } : n)); buzz(10); toast(m ? `タイムアタック開始：${m}分で倒す` : '計測を始めました'); },
  'ta-done'(ref, el) {
    const n = nowItems().find(x => x.ref === ref); if (!n) return;
    const r = recordRun(n, true); markCardDone(ref, el); setNow(nowItems().filter(x => x.ref !== ref));
    if (!ref.startsWith('t:')) { const b = el.getBoundingClientRect(); burst(b.left + b.width / 2, b.top + b.height / 2, 20); }
    if (prefs.sound) chime([784, 1047]);
    toast(r ? `倒した！ 実時間 ${r.actual}分${n.ta.min ? `（決めた時間 ${n.ta.min}分）` : ''}${r.faster ? `・前回より${r.faster}分早い` : ''}` : `倒した！ ${n.text}`);
  },
  'now-off'(ref) { const n = nowItems().find(x => x.ref === ref); if (!n) return; const r = recordRun(n, false); setNow(nowItems().filter(x => x.ref !== ref)); toast(r ? `ひと区切り（${r.actual}分）。おつかれさまでした` : 'ひと区切り。おつかれさまでした'); },
  'q-new'(lane) { openSheet(questSheet({}, lane)); },
  'q-open'(box) {
    if (box.startsWith('q:')) { const q = questById(box.slice(2)); if (q) openSheet(questSheet(q)); return; }
    openSheet(`<h3>${esc(boxTitle(box))}</h3><p class="muted">名前だけのまとまりです。クエストにすると、期限（ボス）やサブクエストを付けられます</p>
      <div class="row"><button class="btn primary" data-act="q-make" data-id="${esc(box)}">クエストにする</button><button class="btn" data-act="c-add" data-id="${esc(box)}">＋ 付箋</button></div>`);
  },
  'q-make'(box) {
    const lane = boxLane(box) || 'blue', title = box.startsWith('x:') ? 'そのほか' : boxTitle(box);
    const p = store.add('tasks', { kind: 'quest', title, lane, status: 'todo', createdAt: now(), source: device() });
    Promise.resolve(p).then(r => {
      const qid = r?.id || r; if (!qid || typeof qid !== 'string') return;
      if (box.startsWith('g:') || box.startsWith('x:')) S.tasks.filter(t => t.kind !== 'quest' && taskBox(t) === box).forEach(t => write(store.set('tasks', t.id, { questId: qid, box: '' })));
    });
    closeSheet('all'); toast('クエストにしました');
  },
  'q-sub'(pid) { const p = questById(pid); if (p) openSheet(questSheet({ parentId: pid, lane: p.lane }, p.lane)); },
  'q-store'(id) { write(store.set('tasks', id, { status: 'stored' })); closeSheet('all'); toast('しまいました（消してはいません）', '戻す', () => store.set('tasks', id, { status: 'todo' })); },
  'q-clear'(id, el) { write(store.set('tasks', id, { status: 'done', doneAt: now(), doneDay: dkey() })); closeSheet('all'); burst(innerWidth / 2, innerHeight / 3, 30); toast('クエストクリア！', '取り消す', () => undoDone(id)); },
  'q-fold'(box) { const L = layoutOf(), el = document.querySelector(`.qbox[data-box="${CSS.escape(box)}"]`); L.fold[box] = !(el && el.classList.contains('folded')); saveLayout(L); render(); },
  'lane-toggle'(lane) { const el = document.querySelector(`.lane.c-${LANE_COLOR(lane)}`); laneOpen[lane] = el ? el.classList.contains('collapsed') : true; render(); },
  qfilter(_, el) { prefs.qfilter = el.dataset.v; savePrefs(); render(); },
  'ai-sheet'() { openSheet(`<h3>AI</h3><div data-sheet="ai">${aiSheetBody()}</div>`); },
  'inbox-open'() { openSheet(`<div class="sheet-cols" data-sheet="inbox">${viewInbox()}</div>`); },
  'ai-yes'(jid) { const wb = meta('workboard'), yes = { ...(wb.yes || {}) }; yes[jid] = { at: now() }; write(store.set('meta', 'workboard', { yes })); buzz(10); toast('Yes を送りました。1分ほどで同じ会話が続きます'); },
  'auto-toggle'() { const wb = meta('workboard'); write(store.set('meta', 'workboard', { autoOff: !wb.autoOff })); toast(wb.autoOff ? '自動で任せるのを再開しました' : '自動で任せるのを止めました（動いている物はそのまま）'); },
});
Object.assign(forms, {
  nowfree(f) { const t = f.t.value.trim(); if (!t) return; const items = nowItems(); if (items.length >= 3) return toast('今やることは3つまでです'); setNow([...items, { ref: 'f:' + now(), text: t, at: now() }]); f.t.value = ''; buzz(10); },
  cadd(f) { const t = f.t.value.trim(); if (!t) return; const box = f.dataset.box; const lane = boxLane(box) || 'blue'; addTask({ title: t, ...boxFields(box), color: lane === 'meta' ? 'blue' : lane, today: pick(f, 'when') === 'today' ? dkey() : null }); closeSheet(); toast('付箋を足しました'); buzz(10); },
  quest(f) {
    const data = { title: f.title.value.trim(), lane: pick(f, 'lane') || 'blue', due: f.due.value || '', parentId: pick(f, 'parent') || '' };
    if (!data.title) return;
    if (f.dataset.id) write(store.set('tasks', f.dataset.id, data)); else write(store.add('tasks', { kind: 'quest', status: 'todo', createdAt: now(), source: device(), ...data }));
    closeSheet('all'); toast('クエストを保存しました');
  },
  lanes(f) { const v = {}; for (const l of LANES) v[l] = { name: f['ln_' + l].value.trim() }; write(store.set('meta', 'lanes', v)); closeSheet(); toast('列の名前を保存しました'); },
});

/* ---- 付箋を動かす（PC：ドラッグ／iPhone：長押しで持ち上げる） ---- */
let sortables = [], dragging = false, dragEnd = 0;
function initDrag() {
  sortables.forEach(s => { try { s.destroy(); } catch {} }); sortables = [];
  if (!window.Sortable) return;
  const common = { animation: 150, delay: 350, delayOnTouchOnly: true, touchStartThreshold: 8, forceFallback: true, fallbackTolerance: 4, fallbackOnBody: true, ghostClass: 'st-ghost', chosenClass: 'st-chosen', dragClass: 'st-drag',
    onStart() { dragging = true; buzz(25); }, onEnd(ev) { dragging = false; dragEnd = now(); onDrop(ev); } };
  document.querySelectorAll('#view .qlist').forEach(el => sortables.push(Sortable.create(el, { ...common, group: 'cards', draggable: '.st', filter: '.st-acts button', preventOnFilter: false })));
  document.querySelectorAll('#view .lane-body').forEach(el => sortables.push(Sortable.create(el, { ...common, group: 'boxes-' + el.dataset.lane, draggable: '.qbox:not(.qsub)', handle: '.qh-t' })));
}
function onDrop(ev) {
  const dev = device(), L = layoutOf(dev), before = JSON.parse(JSON.stringify(L));
  let undoMove = null;
  if (ev.item.classList.contains('st')) {
    const id = ev.item.dataset.cid, from = ev.from.dataset.box, to = ev.to.dataset.box;
    if (from === to && ev.oldIndex === ev.newIndex) return safeRender();
    if (from !== to) { const c = findCard(id); moveCard(id, to); undoMove = () => c && moveCard(id, c.box); }
    for (const el of new Set([ev.from, ev.to])) L.order[el.dataset.box] = [...el.querySelectorAll(':scope > .st')].map(x => x.dataset.cid);
  } else {
    if (ev.oldIndex === ev.newIndex) return safeRender();
    const lane = ev.to.dataset.lane; L.qorder[lane] = [...ev.to.querySelectorAll(':scope > .qbox')].map(x => x.dataset.box);
  }
  saveLayout(L, dev); safeRender();
  toast(`配置を保存しました（${dev === 'phone' ? 'スマホ' : 'PC'}の並び）`, '元に戻す', () => { saveLayout(before, dev); undoMove?.(); safeRender(); });
}

/* ================= v7-1（2026-11-26）：筋トレ（上・下・休みの3日ワンセット） ================= */
// 記録は記録の logs[日].workout（PCとスマホで同じ）。設定は meta/workout。体の中身なので ~/仕事 側（橋）へは送らない
// 進み方（チーフが決めた既定）：記録した日を基準に次へ。やれなかった日はずらさない。休みは「休み」を押すか、その日が過ぎたら次へ
const WO_KIND = { upper: '上', lower: '下', rest: '休み' };
const WO_CYCLE = ['upper', 'lower', 'rest'];
const WO_DEFAULT = {
  upper: [{ id: 'pushup', name: '腕立て伏せ', w: false }, { id: 'shoulder', name: 'ショルダープレス', w: true }, { id: 'deadlift', name: 'デッドリフト', w: true }],
  lower: [{ id: 'squat', name: 'スクワット', w: true }, { id: 'lunge', name: 'ランジ', w: true }],
};
const woCfg = () => { const m = meta('workout'); return { ex: { upper: m.ex?.upper || WO_DEFAULT.upper, lower: m.ex?.lower || WO_DEFAULT.lower }, next: m.next || 'upper', restDay: m.restDay || '', manual: m.manual || null }; };
const woNextOf = k => WO_CYCLE[(WO_CYCLE.indexOf(k) + 1) % WO_CYCLE.length];
const isWorkoutHabit = h => /筋トレ/.test(h.title || '');
// 今日はどれか
function woToday() {
  const k = dkey(), rec = todayLog().workout, c = woCfg();
  if (rec && rec.kind) return { kind: rec.kind, done: true };
  if (c.manual && c.manual.day === k) return { kind: c.manual.kind, done: false };
  if (c.next === 'rest' && c.restDay && k > c.restDay) return { kind: 'upper', done: false };   // 休みの日が過ぎたら次へ
  return { kind: c.next, done: false };
}
// 種目ごとの前回（今日より前）
function woLast(exId) {
  const k = dkey();
  for (const l of S.logs.filter(l => l.id < k && l.workout?.ex?.[exId]?.length).sort((a, b) => b.id.localeCompare(a.id))) return { day: l.id, rows: l.workout.ex[exId] };
  return null;
}
const woFmt = rows => rows.map(r => `${r.reps || 0}回×${r.sets || 1}${r.kg ? `・${r.kg}kg` : ''}`).join(' / ');
function woRowHtml(exId, i, r, ghost, w) {
  const f = (name, v, step, unit) => `<div class="wo-f"><span class="wo-u">${unit}</span><div class="wo-num">
      <button type="button" class="wo-pm" data-act="wo-step" data-v="${-step}" aria-label="へらす">−</button>
      <input name="${name}" inputmode="decimal" value="${v ?? ''}" class="${ghost ? 'ghost' : ''}" autocomplete="off">
      <button type="button" class="wo-pm" data-act="wo-step" data-v="${step}" aria-label="ふやす">＋</button></div></div>`;
  return `<div class="wo-row" data-ex="${esc(exId)}" data-i="${i}">${f('reps', r.reps, 1, '回')}${f('sets', r.sets ?? 1, 1, 'セット')}${w ? f('kg', r.kg, 2.5, 'kg') : ''}
    ${i ? `<button type="button" class="wo-del" data-act="wo-row-del" aria-label="この行を消す">×</button>` : ''}</div>`;
}
function workoutSheet(kindArg) {
  const t = woToday(), kind = kindArg || t.kind, c = woCfg(), rec = todayLog().workout;
  const pick = `<div class="sub-label">今日は <small>ずれた時は選び直せます</small></div>${chipGroup('wokind', WO_CYCLE.map(k => [k, WO_KIND[k] + (k === 'rest' ? '' : 'の日')]), kind)}`;
  if (kind === 'rest') return `<h3>筋トレ：休みの日</h3>${pick}
    <p class="muted" style="margin-top:10px">休むのも筋トレのうち。押さなくても、日付が変わると「上の日」に進みます</p>
    <div class="row end"><button class="btn primary" data-act="wo-rest">休んだ</button></div>`;
  const exs = c.ex[kind] || [];
  const body = exs.map(e => {
    const today = rec && rec.kind === kind && rec.ex?.[e.id], last = woLast(e.id);
    const rows = today || (last ? last.rows : [{ reps: '', sets: 3, kg: '' }]);
    return `<div class="wo-ex" data-ex="${esc(e.id)}"><div class="wo-h"><b>${esc(e.name)}</b><small class="muted">${last ? `前回 ${esc(last.day.slice(5).replace('-', '/'))}：${esc(woFmt(last.rows))}` : 'はじめて'}</small></div>
      <div class="wo-rows">${rows.map((r, i) => woRowHtml(e.id, i, r, !today, e.w)).join('')}</div>
      <button type="button" class="btn sm ghost wo-add" data-act="wo-row-add" data-id="${esc(e.id)}" data-w="${e.w ? 1 : ''}">＋ セットを足す（回数・重さが違う時）</button></div>`;
  }).join('') || '<div class="empty">種目がありません。下の「種目を直す」から足せます</div>';
  return `<h3>筋トレ：${WO_KIND[kind]}の日</h3>${pick}
    <form data-form="workout" data-kind="${kind}">${body}
      <p class="muted" style="font-size:12px">薄い数字は前回の記録です。同じなら、そのまま「記録する」だけでOK</p>
      <div class="row end"><button type="button" class="btn ghost" data-act="wo-edit">種目を直す</button><button class="btn primary">記録する</button></div></form>`;
}
function workoutEditSheet() {
  const c = woCfg();
  const part = k => `<div class="sub-label">${WO_KIND[k]}の日</div>${c.ex[k].map((e, i) => `<div class="wo-edit-row"><span>${esc(e.name)}${e.w ? '' : ' <small class="muted">（重さなし）</small>'}</span>
      <button class="btn sm ghost" data-act="wo-ex-move" data-id="${k}:${i}:-1" ${i ? '' : 'disabled'} aria-label="上へ">↑</button><button class="btn sm ghost" data-act="wo-ex-move" data-id="${k}:${i}:1" ${i < c.ex[k].length - 1 ? '' : 'disabled'} aria-label="下へ">↓</button><button class="btn sm ghost" data-act="wo-ex-del" data-id="${k}:${i}" aria-label="消す">消す</button></div>`).join('')}
    <form data-form="woex" data-kind="${k}" class="field"><input name="t" placeholder="種目を足す" autocomplete="off"><label class="switch"><input type="checkbox" name="w" checked><span>重さあり</span></label><button class="btn sm">足す</button></form>`;
  return `<h3>筋トレの種目</h3>${part('upper')}${part('lower')}<p class="muted" style="font-size:12px;margin-top:10px">消しても、今までの記録は残ります</p>`;
}
const saveWoCfg = patch => write(store.set('meta', 'workout', patch));
function woMarkHabit(on) { const h = activeHabits().find(isWorkoutHabit); if (h) { const cur = todayLog().habits || {}; setLog({ habits: { ...cur, [h.id]: on } }); } }
Object.assign(actions, {
  'workout-open'() { openSheet(workoutSheet()); },
  'wo-step'(_, el) {
    const inp = el.parentElement.querySelector('input'), step = +el.dataset.v;
    const v = Math.max(0, Math.round(((parseFloat(inp.value || inp.placeholder) || 0) + step) * 10) / 10);
    inp.value = String(v); inp.classList.remove('ghost'); buzz(5);
  },
  'wo-row-add'(id, el) {
    const box = el.closest('.wo-ex').querySelector('.wo-rows'), rows = box.querySelectorAll('.wo-row'), last = rows[rows.length - 1];
    const val = n => last?.querySelector(`[name=${n}]`)?.value || '';
    box.insertAdjacentHTML('beforeend', woRowHtml(id, rows.length, { reps: val('reps'), sets: 1, kg: val('kg') }, false, !!el.dataset.w));
    buzz(5);
  },
  'wo-row-del'(_, el) { el.closest('.wo-row').remove(); },
  'wo-rest'() {
    setLog({ workout: { kind: 'rest', at: now() } }); saveWoCfg({ next: 'upper', restDay: '', manual: null }); woMarkHabit(true);
    closeSheet(); toast('休みの日にしました。次は「上の日」です');
  },
  'wo-edit'() { openSheet(workoutEditSheet()); },
  'wo-ex-del'(id) { const [k, i] = id.split(':'), c = woCfg(), list = c.ex[k].filter((_, j) => j !== +i); saveWoCfg({ ex: { ...c.ex, [k]: list } }); setTimeout(() => openSheet(workoutEditSheet()), 60); },
  'wo-ex-move'(id) { const [k, i, d] = id.split(':').map((x, j) => j ? +x : x), c = woCfg(), list = c.ex[k].slice(), j = i + d; if (j < 0 || j >= list.length) return; [list[i], list[j]] = [list[j], list[i]]; saveWoCfg({ ex: { ...c.ex, [k]: list } }); setTimeout(() => openSheet(workoutEditSheet()), 60); },
});
// 「今日は上／下／休み」の選び直し：シートの中のチップ（data-group=wokind）を押したら、その日の種目で開き直す
document.addEventListener('click', e => {
  const chip = e.target.closest('#sheet [data-group=wokind] .chip'); if (!chip) return;
  const k = chip.dataset.v;
  saveWoCfg({ manual: { day: dkey(), kind: k } });
  setTimeout(() => openSheet(workoutSheet(k)), 30);
});
document.addEventListener('input', e => { if (e.target.closest?.('#sheet .wo-num')) e.target.classList.remove('ghost'); });
Object.assign(forms, {
  workout(f) {
    const kind = f.dataset.kind, ex = {};
    f.querySelectorAll('.wo-ex').forEach(box => {
      const rows = [...box.querySelectorAll('.wo-row')].map(r => {
        const g = n => { const i = r.querySelector(`[name=${n}]`); return i ? parseFloat(i.value) : NaN; };
        return { reps: g('reps') || 0, sets: g('sets') || 1, kg: g('kg') || 0 };
      }).filter(r => r.reps > 0);
      if (rows.length) ex[box.dataset.ex] = rows;
    });
    if (!Object.keys(ex).length) return toast('回数を入れてください');
    setLog({ workout: { kind, ex, at: now() } });
    const nx = woNextOf(kind);
    saveWoCfg({ next: nx, restDay: nx === 'rest' ? dkey(addDays(1)) : '', manual: null });
    woMarkHabit(true);
    closeSheet(); burst(innerWidth / 2, innerHeight / 3, 16); if (prefs.sound) chime([659, 988]);
    toast(`筋トレ（${WO_KIND[kind]}の日）を記録しました。次は「${WO_KIND[nx]}${nx === 'rest' ? '' : 'の日'}」`);
  },
  woex(f) {
    const t = f.t.value.trim(); if (!t) return; const k = f.dataset.kind, c = woCfg();
    const list = [...c.ex[k], { id: 'x' + Date.now().toString(36), name: t, w: !!f.w.checked }];
    saveWoCfg({ ex: { ...c.ex, [k]: list } }); setTimeout(() => openSheet(workoutEditSheet()), 60);
  },
});
// 記録のボード：種目ごとの推移（連続日数・やらなかった日は出さない）
function workoutCard() {
  const logs = S.logs.filter(l => l.workout?.ex).sort((a, b) => b.id.localeCompare(a.id));
  const c = woCfg(), all = [...c.ex.upper, ...c.ex.lower];
  const ids = [...new Set([...all.map(e => e.id), ...logs.flatMap(l => Object.keys(l.workout.ex))])];
  const nameOf = id => (all.find(e => e.id === id) || {}).name || id;
  const t = woToday();
  return `<section class="card">
    <div class="eyebrow">筋トレの記録 <small>今日：${WO_KIND[t.kind]}${t.kind === 'rest' ? '' : 'の日'}${t.done ? '・記録済み' : ''}</small><button class="eyebrow-act" data-act="workout-open">記録する</button></div>
    ${logs.length ? ids.filter(id => logs.some(l => l.workout.ex[id])).map(id => `<details class="wo-hist"><summary><b>${esc(nameOf(id))}</b><span class="muted">${esc(woFmt(logs.find(l => l.workout.ex[id]).workout.ex[id]))}</span></summary>
      <table class="wo-tbl"><tr><th>日付</th><th>回数×セット</th><th>重さ</th></tr>${logs.filter(l => l.workout.ex[id]).slice(0, 12).map(l => l.workout.ex[id].map((r, i) => `<tr><td>${i ? '' : esc(l.id.slice(5).replace('-', '/'))}</td><td>${r.reps}回×${r.sets}</td><td>${r.kg ? r.kg + 'kg' : '—'}</td></tr>`).join('')).join('')}</table></details>`).join('')
      : '<div class="empty">いまのボードの日課「筋トレ」を押すと、ここに種目ごとの推移がたまります</div>'}
  </section>`;
}

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
  const map = { 0: 'ima', 1: 'ima', 2: 'quest', 3: 'log' };
  if (map[e.key]) setTab(map[e.key]);
  if (e.key === '4' && !sheetOpen) actions['inbox-open']();
  if (e.key === 'ArrowRight' && !sheetOpen) stepBoard(1);
  if (e.key === 'ArrowLeft' && !sheetOpen) stepBoard(-1);
  if (e.key === 'n') { e.preventDefault(); actions['add-open'](); }
});
const boardScroll = {};
function setTab(t, dir) {
  if (t === 'compass') { actions['compass-open'](); return; }
  if (t === 'inbox') { actions['inbox-open'](); return; }
  if (OLD_TAB[t]) t = OLD_TAB[t];
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
  if (!sw || dragging || now() - dragEnd < 400) { sw = null; return; } const dx = e.changedTouches[0].clientX - sw.x, dy = e.changedTouches[0].clientY - sw.y; const quick = Date.now() - sw.t < 600; sw = null;
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
    noteErr('AIで分ける', e);
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
  } catch (e) { noteErr('相棒', e); chat.push({ role: 'assistant', content: `（うまくいきませんでした：${e.message}）` }); if ($('#sheet .chat')) paint(''); }
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
  <div class="sub-label">キーボード操作（PC）</div><p class="muted" style="font-size:12px">1 いま・2 クエスト・3 記録・←→でボード切り替え・4で受け取り箱・Nでクエストを足す・Escで閉じる</p>
  <div class="sub-label">列の名前 <small>空にすると聖典の言葉に戻ります</small></div>
  <form data-form="lanes">${LANES.map(l => `<label class="set-row"><span>${esc(LANE_MARK[l])}</span><input name="ln_${l}" value="${esc((meta('lanes')[l] || {}).name || '')}" placeholder="${esc(laneInfo(l).name)}" autocomplete="off"></label>`).join('')}<div class="row end"><button class="btn sm primary">名前を保存</button></div></form>
  <div class="row" style="justify-content:flex-start"><button class="btn sm" data-act="export">データを書き出す（JSON）</button><button class="btn sm" data-act="restore-pick">書き出したものから戻す</button>${store.mode === 'cloud' ? '<button class="btn sm ghost" data-act="signout">ログアウト</button>' : ''}</div>
  <p class="muted" style="margin-top:16px;font-size:11px">シルベ v7</p>`);
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
setInterval(() => { paintSky(); if (dkey() !== lastDay) { lastDay = dkey(); safeRender(); } else if (tab === 'ima' && !sheetOpen) safeRender(); }, 60e3);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { paintSky(); safeRender(); } });

let raf, pending = false;
// 入力中は描き直さない（書きかけが消えないように）。手を離したら反映する
function safeRender() {
  const a = document.activeElement;
  if ((a && a.closest('#view') && /INPUT|TEXTAREA/.test(a.tagName)) || dragging) { pending = true; paintHud(); return; }
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
