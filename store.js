// データの置き場所。firebase-config.js が空なら「この端末だけ」（お試し）、入っていればクラウド（Firebase）
import { firebaseConfig } from './firebase-config.js?v=202611241423';
import { githubConfig } from './github-config.js?v=202611241423';

const SDK = 'https://www.gstatic.com/firebasejs/11.0.2/';
export const COLS = ['tasks', 'inbox', 'logs', 'ideas', 'meta', 'habits', 'goals', 'reviews'];

export async function createStore() {
  if (githubConfig) return githubStore(githubConfig);
  return firebaseConfig ? cloudStore(firebaseConfig) : localStore();
}

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- GitHub方式（2026-11-22〜・AI家庭教師と同じ仕組み） ----------
   公開サイト（コードだけ）＋ 非公開リポジトリ shirube-data（記録）＋ 合言葉で開く鍵。
   db/state.json …アプリの記録。書き込みは手元ですぐ反映し、まとめて保存（衝突したら読み直して重ねる）
   inbox/*.json …Macの取り込み係が置く候補。採用・捨てるの結果は state 側に重ねる
   live/<col>-<id>.json …Macが上書きする小さな情報（meta/ai＝いまのAI作業） */
const LS = { get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }, del(k) { try { localStorage.removeItem(k); } catch {} } };
const b64dec = s => { const bin = atob(s.replace(/\s/g, '')); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return new TextDecoder().decode(u); };
const b64enc = s => { const u = new TextEncoder().encode(s); let bin = ''; for (let i = 0; i < u.length; i += 0x8000) bin += String.fromCharCode.apply(null, u.subarray(i, i + 0x8000)); return btoa(bin); };

// openssl enc -aes-256-cbc -pbkdf2 -iter 310000 -md sha256 と同じ形式（AI家庭教師と同じ）
async function openVault(b64, pass) {
  const raw = Uint8Array.from(atob(b64.trim()), c => c.charCodeAt(0));
  if (new TextDecoder().decode(raw.slice(0, 8)) !== 'Salted__') throw new Error('bad vault');
  const salt = raw.slice(8, 16), ct = raw.slice(16);
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(pass), 'PBKDF2', false, ['deriveBits']);
  const bits = new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' }, km, 384));
  const key = await crypto.subtle.importKey('raw', bits.slice(0, 32), 'AES-CBC', false, ['decrypt']);
  return new TextDecoder().decode(await crypto.subtle.decrypt({ name: 'AES-CBC', iv: bits.slice(32, 48) }, key, ct));
}

function githubStore(cfg) {
  const KT = 'shirube.gh.token', KC = 'shirube.gh.cache', KQ = 'shirube.gh.ops';
  let token = LS.get(KT);
  const api = (p, o = {}) => fetch(`https://api.github.com/repos/${cfg.owner}/${cfg.repo}/${p}`, { cache: 'no-store', ...o, headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', ...(o.headers || {}) } });
  const fail = r => { const e = new Error('github ' + r.status); e.status = r.status; e.code = r.status === 401 ? 'auth/expired' : 'network'; throw e; };
  const fileCache = LS.get('shirube.gh.files') || {};
  let base = LS.get(KC) || { state: { v: 1, cols: {} }, inbox: {}, live: {} };
  let ops = LS.get(KQ) || [];
  let busy = false, timer = null, lastPut = 0, poll = null;
  const subs = {}, errs = {};
  let authCb = null;

  const applyOp = (st, op) => {
    st.cols ||= {}; const col = st.cols[op.c] ||= {};
    if (op.op === 'set') col[op.id] = op.merge ? { ...(col[op.id] || {}), ...op.data } : op.data;
    else if (op.op === 'del') delete col[op.id];
  };
  const clone = o => JSON.parse(JSON.stringify(o));
  const current = () => { const st = clone(base.state || { cols: {} }); ops.forEach(o => applyOp(st, o)); return st; };
  const rows = (c, st) => {
    const own = (st.cols && st.cols[c]) || {};
    let all = { ...own };
    if (c === 'inbox') {
      all = {};
      for (const [id, v] of Object.entries(base.inbox || {})) if (!(own[id] && own[id]._del)) all[id] = { ...v, ...(own[id] || {}) };
      for (const [id, v] of Object.entries(own)) if (!all[id] && !v._del && v.text) all[id] = v;
    }
    // live/meta-ai.json → meta の ai、live/status-projects.json → meta の status-projects（Macや木村OSが自動で上書きする状況）
    if (c === 'meta') for (const [k, v] of Object.entries(base.live || {})) { const i = k.indexOf('-'); const lid = k.slice(0, i) === 'meta' ? k.slice(i + 1) : k; all[lid] = { ...(own[lid] || {}), ...v }; }
    return Object.entries(all).map(([id, v]) => ({ id, ...v }));
  };
  const emitAll = () => { const st = current(); for (const c of Object.keys(subs)) subs[c].forEach(cb => cb(rows(c, st))); };
  const persist = () => { try { localStorage.setItem(KQ, JSON.stringify(ops)); } catch { Object.values(errs).forEach(fn => fn?.({ code: 'quota', message: 'この端末の保存場所がいっぱいです' })); } LS.set(KC, base); };
  const schedule = ms => { clearTimeout(timer); timer = setTimeout(flush, ms || 700); };

  async function getFile(p) {
    const r = await api(`contents/${p}?ref=main&t=${Date.now()}`); if (r.status === 404) return null; if (!r.ok) fail(r);
    const j = await r.json(); let c = j.content;
    if (!c && j.size > 0 && j.git_url) { const b = await fetch(j.git_url, { cache: 'no-store', headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } }); if (!b.ok) fail(b); c = (await b.json()).content; }
    return { sha: j.sha, data: JSON.parse(b64dec(c)) };
  }
  async function getDir(dir) {
    const r = await api(`contents/${dir}?ref=main&t=${Date.now()}`); if (r.status === 404) return {}; if (!r.ok) fail(r);
    const files = (await r.json()).filter(f => f.name.endsWith('.json')).sort((a, b) => a.name < b.name ? 1 : -1).slice(0, 300);
    const out = {};
    await Promise.all(files.map(async f => {
      const id = f.name.replace(/\.json$/, ''), ck = dir + '/' + f.name, c = fileCache[ck];
      if (c && c.sha === f.sha) { out[id] = c.data; return; }
      try { const x = await getFile(ck); if (x) { fileCache[ck] = { sha: f.sha, data: x.data }; out[id] = x.data; } } catch {}
    }));
    for (const k of Object.keys(fileCache)) if (k.startsWith(dir + '/') && !files.some(f => dir + '/' + f.name === k)) delete fileCache[k];
    LS.set('shirube.gh.files', fileCache);
    return out;
  }
  async function putState(st, sha) {
    const body = { message: 'app', content: b64enc(JSON.stringify(st)), branch: 'main' }; if (sha) body.sha = sha;
    const r = await api('contents/db/state.json', { method: 'PUT', body: JSON.stringify(body) });
    if (r.status === 409 || r.status === 422) return { conflict: true }; if (!r.ok) fail(r); return { ok: true };
  }
  async function flush() {
    if (!token || busy || !ops.length) return; busy = true;
    try {
      for (let i = 0; i < 4; i++) {
        const sent = ops.slice(); const f = await getFile('db/state.json'); const st = f ? f.data : { v: 1, cols: {} };
        sent.forEach(o => applyOp(st, o));
        const r = await putState(st, f && f.sha);
        if (r.conflict) { await new Promise(res => setTimeout(res, [300, 1000, 3000, 0][i])); continue; }
        base.state = st; lastPut = Date.now(); ops = ops.slice(sent.length); persist(); emitAll(); busy = false; if (ops.length) schedule(); return;
      }
    } catch (e) { if (e.status === 401) relogin(); }
    busy = false; schedule(15000);
  }
  async function refresh() {
    if (!token) return false;
    try {
      const [f, inbox, live] = await Promise.all([getFile('db/state.json'), getDir('inbox'), getDir('live')]);
      const fresh = !busy && Date.now() - lastPut > 15000;
      const before = JSON.stringify(base);
      base = { state: f && fresh ? f.data : (base.state || { v: 1, cols: {} }), inbox, live };
      if (JSON.stringify(base) !== before) { persist(); emitAll(); }
      flush(); return true;
    } catch (e) { if (e.status === 401) relogin(); else Object.values(errs).forEach(fn => fn?.(e)); return false; }
  }
  function relogin() { token = null; LS.del(KT); clearInterval(poll); s.user = null; authCb?.(null); }
  function begin() {
    s.user = { uid: 'me', name: '合言葉でログイン中' }; authCb?.(s.user);
    refresh();
    clearInterval(poll); poll = setInterval(() => { if (document.visibilityState === 'visible') refresh(); }, 30000);
  }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && token) refresh(); });
  addEventListener('online', () => flush());

  const s = {
    mode: 'cloud', kind: 'github', user: null,
    onAuth(cb) { authCb = cb; if (token) begin(); else cb(null); },
    // 合言葉で鍵を開ける（第2引数が合言葉。第1引数は使わない）
    async signIn(_email, pass) {
      let tok = '';
      try { tok = (await openVault(cfg.vault, pass)).trim(); } catch { const e = new Error('bad pass'); e.code = 'auth/wrong-password'; throw e; }
      if (!/^(gh[opsu]_|github_pat_)/.test(tok)) { const e = new Error('bad pass'); e.code = 'auth/wrong-password'; throw e; }
      token = tok; LS.set(KT, tok); begin();
    },
    pending() { return ops.length; },
    async signOut() { await flush(); if (ops.length) return relogin(); LS.del(KC); LS.del(KQ); relogin(); },
    watch(c, cb, onErr) { (subs[c] ||= []).push(cb); errs[c] = onErr; cb(rows(c, current())); },
    async add(c, data) { const id = newId(); ops.push({ op: 'set', c, id, data }); persist(); emitAll(); schedule(); return id; },
    async set(c, id, data, merge = true) { ops.push({ op: 'set', c, id, data, merge }); persist(); emitAll(); schedule(); },
    async del(c, id) { ops.push(c === 'inbox' ? { op: 'set', c, id, data: { _del: true }, merge: true } : { op: 'del', c, id }); persist(); emitAll(); schedule(); },
    async batchSet(c, list) { list.forEach(({ id, ...v }) => ops.push({ op: 'set', c, id, data: v, merge: true })); persist(); emitAll(); await flush(); },
    dump() { const st = current(); const o = {}; COLS.forEach(c => { o[c] = Object.fromEntries(rows(c, st).map(({ id, ...v }) => [id, v])); }); return o; },
    refresh,
    // ほかの自分のリポジトリ（AI家庭教師の ai-tutor-data など）を1ファイルだけ読む。無ければ null
    async readOther(repo, path) {
      if (!token) return null;
      const r = await fetch(`https://api.github.com/repos/${cfg.owner}/${repo}/contents/${path}?ref=main&t=${Date.now()}`, { cache: 'no-store', headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json' } });
      if (r.status === 401 || r.status === 403) { const e = new Error('no access'); e.status = r.status; throw e; }
      if (!r.ok) return null; const j = await r.json(); try { return JSON.parse(b64dec(j.content)); } catch { return null; }
    },
    // AIに聞く：asks/<id>.json に置き、MacのClaude（sync/answer.py）が answers/<id>.json に答える。
    // onState('sent'|'working'|'late') で途中経過を知らせる。答えの本文を返す。Macが寝ていたら 'late' のあと待ち続ける
    async ask(req, onState, cancelled) {
      if (!token) throw new Error('ログインしてください');
      const id = newId();
      const body = { ...req, id, createdAt: new Date().toISOString() };
      const r = await api(`contents/asks/${id}.json`, { method: 'PUT', body: JSON.stringify({ message: 'ask', content: b64enc(JSON.stringify(body)), branch: 'main' }) });
      if (!r.ok) fail(r);
      onState?.('sent');
      const t0 = Date.now(); let late = false;
      while (Date.now() - t0 < 15 * 60e3) {
        await new Promise(res => setTimeout(res, 4000));
        if (cancelled?.()) throw new Error('cancel');
        let a = null; try { a = (await getFile(`answers/${id}.json`))?.data; } catch (e) { if (e.status === 401) { relogin(); throw e; } }
        if (a?.status === 'done') return a.text;
        if (a?.status === 'error') throw new Error('AIが答えられませんでした');
        if (a?.status === 'working') onState?.('working');
        else if (!late && Date.now() - t0 > 75e3) { late = true; onState?.('late'); }
      }
      throw new Error('時間切れ（Macが眠っているかもしれません）');
    },
  };
  return s;
}

/* ---------- この端末だけ（お試し） ---------- */
function localStore() {
  const KEY = 'shirube_v4_local';
  let db = {};
  try { db = JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { db = {}; }
  COLS.forEach(c => db[c] ||= {});
  const subs = {};
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch {} };
  const emit = c => (subs[c] || []).forEach(cb => cb(Object.entries(db[c]).map(([id, v]) => ({ id, ...v }))));
  return {
    mode: 'local',
    user: { uid: 'local', name: 'この端末' },
    onAuth(cb) { cb(this.user); },
    async signIn() {}, async signOut() {},
    watch(c, cb) { (subs[c] ||= []).push(cb); emit(c); },
    async batchSet(c, rows) { rows.forEach(({ id, ...v }) => { db[c][id] = { ...(db[c][id] || {}), ...v }; }); save(); emit(c); },
    async add(c, data) { const id = newId(); db[c][id] = data; save(); emit(c); return id; },
    async set(c, id, data, merge = true) { db[c][id] = merge ? { ...(db[c][id] || {}), ...data } : data; save(); emit(c); },
    async del(c, id) { delete db[c][id]; save(); emit(c); },
    dump() { return db; },
  };
}

/* ---------- クラウド（Firebase） ---------- */
async function cloudStore(cfg) {
  const [{ initializeApp }, A, F] = await Promise.all([
    import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js'), import(SDK + 'firebase-firestore.js'),
  ]);
  const app = initializeApp(cfg);
  // 電波がなくても読み書きでき、つながったら自動で同期する
  let fdb;
  const ios = /iPhone|iPad/i.test(navigator.userAgent);
  try {
    fdb = F.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: F.persistentLocalCache({ tabManager: ios ? F.persistentSingleTabManager() : F.persistentMultipleTabManager() }) });
  } catch (e) {
    console.warn('persistent cache unavailable', e);
    fdb = F.initializeFirestore(app, { ignoreUndefinedProperties: true, localCache: F.memoryLocalCache() });
  }
  const auth = A.getAuth(app);
  await A.setPersistence(auth, A.indexedDBLocalPersistence).catch(() => {});

  let uid = null, unsubs = [];
  const col = c => F.collection(fdb, 'users', uid, c);
  const cache = {};
  const s = {
    mode: 'cloud', user: null,
    onAuth(cb) {
      A.onAuthStateChanged(auth, u => {
        unsubs.forEach(f => f()); unsubs = [];
        uid = u ? u.uid : null;
        s.user = u ? { uid: u.uid, name: u.displayName || u.email } : null;
        cb(s.user);
      });
    },
    // メール＋パスワード（iPhoneのホーム画面アプリでも確実に動く）
    async signIn(email, password) { return A.signInWithEmailAndPassword(auth, email, password); },
    async signOut() { return A.signOut(auth); },
    watch(c, cb, onErr) {
      unsubs.push(F.onSnapshot(col(c), snap => {
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        cache[c] = rows; cb(rows);
      }, e => { console.warn('watch', c, e); onErr?.(e); }));
    },
    async add(c, data) { const r = await F.addDoc(col(c), data); return r.id; },
    async set(c, id, data, merge = true) { return F.setDoc(F.doc(fdb, 'users', uid, c, id), data, { merge }); },
    async del(c, id) { return F.deleteDoc(F.doc(fdb, 'users', uid, c, id)); },
    // まとめて書き込む（お試しデータの引っ越し・バックアップからの復元）
    async batchSet(c, rows) {
      for (let i = 0; i < rows.length; i += 400) {
        const b = F.writeBatch(fdb);
        rows.slice(i, i + 400).forEach(({ id, ...v }) => b.set(F.doc(fdb, 'users', uid, c, id), v, { merge: true }));
        await b.commit();
      }
    },
    dump() { return cache; },
  };
  return s;
}
