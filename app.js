import { cardHTML, esc, featureHTML, fmtDay, fmtTime, relTime, seriesHTML, sheetHTML, storyText } from './ui.js';

const SECTIONS = [
  { key: 'must', num: '01', title: '今日必吃', desc: '今天最值得讲给朋友听的几条。' },
  { key: 'life', num: '02', title: '人间故事', desc: '家长里短、婚恋狗血，都是真发生的事。' },
  { key: 'oddity', num: '03', title: '奇闻现场', desc: '离谱、荒诞、想不通的真实现场。' },
  { key: 'twist', num: '04', title: '反转与后续', desc: '先别站队，事情又有下文。' },
  { key: 'extras', num: '05', title: '茶余饭后', desc: '少量娱乐八卦与海外趣闻，不再占主场。' }
];

const FAV_KEY = 'xycg:favs:v2';
const FOLLOW_KEY = 'xycg:follow:v1';

const state = {
  daily: null,
  index: null,
  meta: null,
  date: null,
  saved: new Map(),
  following: new Set(),
  lastFocus: null
};

const $ = (sel) => document.querySelector(sel);

function loadSaved() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    for (const it of arr) state.saved.set(it.id, it);
  } catch { /* ignore */ }
  try {
    const rawF = localStorage.getItem(FOLLOW_KEY);
    const arrF = rawF ? JSON.parse(rawF) : [];
    for (const id of arrF) state.following.add(id);
  } catch { /* ignore */ }
}

function persistSaved() {
  try { localStorage.setItem(FAV_KEY, JSON.stringify([...state.saved.values()])); } catch { /* ignore */ }
}

function persistFollow() {
  try { localStorage.setItem(FOLLOW_KEY, JSON.stringify([...state.following])); } catch { /* ignore */ }
}

function toggleFollow(evId) {
  if (state.following.has(evId)) {
    state.following.delete(evId);
    toast('已取消关注');
  } else {
    state.following.add(evId);
    toast('已关注，只保存在这台设备 📌');
  }
  persistFollow();
  document.querySelectorAll('[data-follow="' + evId + '"]').forEach((btn) => {
    const on = state.following.has(evId);
    btn.classList.toggle('is-on', on);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    btn.textContent = on ? '📌 已关注' : '📌 关注这条瓜';
  });
}

function toast(msg) {
  const el = $('#toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 1800);
}

async function getJson(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + url);
  return res.json();
}

async function boot() {
  loadSaved();
  const params = new URLSearchParams(location.search);
  const wanted = params.get('date');

  try {
    state.index = await getJson('data/index.json');
  } catch {
    state.index = { dates: [] };
  }

  const date = wanted && state.index.dates.includes(wanted) ? wanted : (state.index.latest || null);

  try {
    state.daily = date
      ? await getJson('data/daily/' + date + '.json')
      : await getJson('data/latest.json');
    state.date = state.daily.date;
    try { state.meta = await getJson('data/meta.json'); } catch { state.meta = null; }
    renderAll();
  } catch (err) {
    showEmpty('数据还没准备好', '第一次运行会自动生成今天的内容。若你刚部署，等一次 Actions 跑完即可。');
    console.error('[xycg] load failed', err);
  }
}

function showEmpty(title, text) {
  $('#feeding').hidden = true;
  $('#emptyState').hidden = false;
  if (title) $('#emptyState h2').textContent = title;
  if (text) $('#emptyText').textContent = text;
  $('#heroEyebrow').textContent = '等待投喂';
  $('#heroTitle').innerHTML = '今天的瓜<br><span class="hl">还在路上</span>';
}

function renderAll() {
  const d = state.daily;
  const byId = new Map(d.items.map((i) => [i.id, i]));
  const dateLabel = fmtDay(d.date);

  $('#dateLabel').textContent = dateLabel + (state.date === state.index.latest ? ' · 今天' : '');
  $('#heroEyebrow').textContent = dateLabel + ' · 第 ' + issueNo(d.date) + ' 期';
  const mustCount = (d.mustEat || []).length;
  $('#heroSub').textContent = mustCount < 5
    ? '今天好瓜不多，只挑了 ' + d.meta.selected + ' 条，不硬凑。'
    : '从 ' + (d.meta.totalCollected || d.items.length) + ' 条热榜与 RSS 里，挑出 ' + d.meta.selected + ' 条真正有瓜味的。';
  $('#heroStats').innerHTML = [
    ['必吃', (d.mustEat || []).length],
    ['全部', d.items.length],
    ['来源', d.meta.okSources + '/' + d.meta.totalSources],
    ['更新', relTime(d.generatedAt)]
  ].map(([k, v]) => '<span class="stat"><b>' + esc(v) + '</b>' + esc(k) + '</span>').join('');

  renderStatus(d);
  renderSections(d, byId);
  $('#genAt').textContent = '数据更新于 ' + fmtTime(d.generatedAt);
  $('#feeding').hidden = false;
  $('#emptyState').hidden = true;
  syncSavedButtons();
}

function issueNo(date) {
  const base = new Date('2026-10-01T00:00:00+08:00');
  const cur = new Date(date + 'T00:00:00+08:00');
  const days = Math.max(1, Math.round((cur - base) / 86400000) + 1);
  return String(days);
}

function renderStatus(d) {
  const strip = $('#statusStrip');
  const failed = (d.meta.sources || []).filter((s) => !s.ok);
  const lastOk = state.meta && state.meta.lastSuccessAt;
  const stale = lastOk ? (Date.now() - new Date(lastOk).getTime()) > 36 * 3600e3 : false;
  const bits = [];
  if (failed.length) bits.push('有 ' + failed.length + ' 个信息源暂时没连上（' + failed.map((s) => s.name).join('、') + '），已自动跳过，其他来源不受影响。');
  if (stale) bits.push('这份数据已经超过 36 小时没更新，采集任务可能停了。');
  if (!bits.length) { strip.hidden = true; strip.innerHTML = ''; return; }
  strip.hidden = false;
  strip.textContent = bits.join(' ');
}

function sectionHead(key, count) {
  const s = SECTIONS.find((x) => x.key === key);
  return '<div class="sec-head"><span class="sec-num">' + s.num + '</span><h2>' + s.title + '</h2>'
    + '<span class="sec-count">' + count + ' 条</span></div>'
    + '<p class="sec-desc">' + s.desc + '</p>';
}

function sectionItems(d, byId, key) {
  return ((d.sections && d.sections[key]) || []).map((id) => byId.get(id)).filter(Boolean);
}

function blockHTML(title, items, indexBase, emptyText) {
  const head = '<h3 class="sub-head">' + esc(title) + '<span>' + items.length + ' 条</span></h3>';
  if (!items.length) return '<div class="sub-block">' + head + '<p class="section-empty">' + esc(emptyText) + '</p></div>';
  const cards = items.map((it, i) => cardHTML(it, indexBase + i, state.saved.has(it.id))).join('');
  return '<div class="sub-block">' + head + cards + '</div>';
}

function renderSections(d, byId) {
  const parts = [];
  const must = (d.mustEat || []).map((id) => byId.get(id)).filter(Boolean);

  parts.push('<section class="section" id="must" data-section="must">' + sectionHead('must', must.length));
  if (!must.length) {
    parts.push('<p class="section-empty">今天的瓜还没熟，稍后再来。</p>');
  } else {
    parts.push(featureHTML(must[0]));
    must.slice(1).forEach((it, i) => parts.push(cardHTML(it, i + 1, state.saved.has(it.id))));
  }
  parts.push('</section>');

  const life = sectionItems(d, byId, 'life');
  const romance = sectionItems(d, byId, 'romance');
  parts.push('<section class="section" id="life" data-section="life">' + sectionHead('life', life.length + romance.length));
  parts.push(blockHTML('家长里短', life, 0, '今天暂时没有合适的家庭故事。'));
  parts.push(blockHTML('婚恋狗血', romance, life.length, '今天暂时没有婚恋故事。'));
  parts.push('</section>');

  const oddity = sectionItems(d, byId, 'oddity');
  parts.push('<section class="section" id="oddity" data-section="oddity">' + sectionHead('oddity', oddity.length));
  if (!oddity.length) parts.push('<p class="section-empty">今天没有够离谱的现场。</p>');
  else oddity.forEach((it, i) => parts.push(cardHTML(it, i, state.saved.has(it.id))));
  parts.push('</section>');

  const twist = sectionItems(d, byId, 'twist');
  const events = d.events || [];
  parts.push('<section class="section" id="twist" data-section="twist">' + sectionHead('twist', twist.length));
  if (!twist.length && !events.length) parts.push('<p class="section-empty">今天没有带证据的反转，等下一次。</p>');
  twist.forEach((it, i) => parts.push(cardHTML(it, i, state.saved.has(it.id))));
  events.forEach((ev, i) => parts.push(seriesHTML(ev, twist.length + i, state.following.has(ev.id))));
  parts.push('</section>');

  const ent = sectionItems(d, byId, 'entertainment');
  const overseas = sectionItems(d, byId, 'overseas');
  parts.push('<section class="section" id="extras" data-section="extras">' + sectionHead('extras', ent.length + overseas.length));
  parts.push(blockHTML('娱乐八卦', ent, 0, '今天没有值得单独说的娱乐瓜。'));
  parts.push(blockHTML('海外瓜田', overseas, ent.length, '今天没有合适的海外趣闻。'));
  parts.push('</section>');

  $('#feeding').innerHTML = parts.join('');
}

function syncSavedButtons() {
  document.querySelectorAll('[data-like]').forEach((btn) => {
    const on = state.saved.has(btn.dataset.like);
    btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    if (btn.classList.contains('btn')) btn.textContent = on ? '♥ 已收藏' : '♡ 收藏';
  });
  const badge = $('#savedCount');
  if (badge) {
    const n = state.saved.size;
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.hidden = n === 0;
  }
}

function snapshot(item) {
  return {
    id: item.id, title: item.title, originalTitle: item.originalTitle || null, summary: item.summary || '',
    url: item.url, sourceName: item.sourceName, sourceGroup: item.sourceGroup, category: item.category,
    publishedAt: item.publishedAt, fact: item.fact, image: item.image || '', date: state.date,
    timeBasis: item.timeBasis
  };
}

function toggleSave(id, fromSnapshot) {
  if (state.saved.has(id)) {
    state.saved.delete(id);
    toast('已取消收藏');
  } else {
    const item = fromSnapshot || (state.daily && state.daily.items.find((i) => i.id === id));
    if (!item) return;
    state.saved.set(id, snapshot(item));
    toast('收进瓜篮啦 🍉');
  }
  persistSaved();
  syncSavedButtons();
}

function findEvent(itemId) {
  const d = state.daily;
  if (!d) return null;
  return (d.events || []).find((e) => e.itemId === itemId) || null;
}

function openSheet(itemId) {
  const d = state.daily;
  const item = d ? d.items.find((i) => i.id === itemId) : null;
  const fallback = state.saved.get(itemId);
  if (!item && !fallback) return;
  const record = item || fallback;
  const ev = findEvent(itemId);
  state.lastFocus = document.activeElement;
  $('#sheetBody').innerHTML = sheetHTML(record, ev, state.saved.has(itemId), fmtDay(record.date || d.date));
  $('#sheetRoot').hidden = false;
  document.body.style.overflow = 'hidden';
  const closeBtn = $('#sheetRoot .sheet-close');
  if (closeBtn) closeBtn.focus();
  $('#sheetRoot .sheet').scrollTop = 0;
}

function closeSheet() {
  $('#sheetRoot').hidden = true;
  document.body.style.overflow = '';
  if (state.lastFocus && state.lastFocus.focus) state.lastFocus.focus();
}

function openSaved() {
  const items = [...state.saved.values()].sort((a, b) => String(b.publishedAt).localeCompare(String(a.publishedAt)));
  state.lastFocus = document.activeElement;
  const body = items.length
    ? items.map((it, i) => cardHTML(it, i, true)).join('')
    : '<p class="section-empty">瓜篮还是空的。点任意一条瓜右上角的 ♥，就会存到这里，换设备前都算数。</p>';
  $('#sheetBody').innerHTML = '<div class="sheet-cat"><span class="chip cat cat-gossip">我的瓜篮</span>'
    + '<span class="chip fact">' + items.length + ' 条</span></div>'
    + '<h2 id="sheetTitle">收藏的瓜</h2>'
    + '<p class="lead">只存在这台设备上，不上传、不打扰。</p>' + body;
  $('#sheetRoot').hidden = false;
  document.body.style.overflow = 'hidden';
  setActiveNav('saved');
}

function openDates() {
  const dates = (state.index && state.index.dates) || [];
  const list = dates.length
    ? dates.map((d) => '<button class="date-item' + (d === state.date ? ' is-active' : '') + '" data-date="' + esc(d) + '" type="button">'
      + '<span>' + esc(fmtDay(d)) + '</span><span>' + esc(d === state.index.latest ? '最新' : d) + '</span></button>').join('')
    : '<p class="section-empty">还没有历史记录。</p>';
  $('#dateList').innerHTML = list;
  $('#dateRoot').hidden = false;
  $('#dateBtn').setAttribute('aria-expanded', 'true');
}

function closeDates() {
  $('#dateRoot').hidden = true;
  $('#dateBtn').setAttribute('aria-expanded', 'false');
}

async function switchDate(date) {
  closeDates();
  try {
    const daily = await getJson('data/daily/' + date + '.json');
    state.daily = daily;
    state.date = daily.date;
    history.replaceState(null, '', '?date=' + date);
    renderAll();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch {
    toast('这一天的数据没取到');
  }
}

function setActiveNav(key) {
  document.querySelectorAll('.tab').forEach((el) => {
    const on = el.dataset.target === key;
    el.classList.toggle('is-active', on);
    if (on) {
      const strip = document.querySelector('.tabs');
      if (strip) strip.scrollTo({ left: Math.max(0, el.offsetLeft - strip.clientWidth / 2 + el.clientWidth / 2), behavior: 'smooth' });
    }
  });
  document.querySelectorAll('.tabbar-btn').forEach((el) => el.classList.toggle('is-active', el.dataset.target === key));
}

function goSection(key) {
  if (key === 'saved') { openSaved(); return; }
  const el = document.getElementById(key);
  if (!el) { toast('这一栏今天还没有内容'); return; }
  setActiveNav(key);
  el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function bind() {
  document.addEventListener('click', (e) => {
    const like = e.target.closest('[data-like]');
    if (like) {
      e.preventDefault();
      toggleSave(like.dataset.like);
      const inSheet = like.closest('#sheetBody');
      if (inSheet) {
        const item = state.daily && state.daily.items.find((i) => i.id === like.dataset.like);
        const rec = item || state.saved.get(like.dataset.like);
        if (rec) {
          like.textContent = state.saved.has(like.dataset.like) ? '♥ 已收藏' : '♡ 收藏';
          like.setAttribute('aria-pressed', state.saved.has(like.dataset.like) ? 'true' : 'false');
        }
      }
      return;
    }
    const follow = e.target.closest('[data-follow]');
    if (follow) {
      e.preventDefault();
      toggleFollow(follow.dataset.follow);
      return;
    }
    const open = e.target.closest('[data-open]');
    if (open) { e.preventDefault(); openSheet(open.dataset.open); return; }

    const tab = e.target.closest('.tab');
    if (tab) { goSection(tab.dataset.target); return; }
    const navBtn = e.target.closest('.tabbar-btn');
    if (navBtn) { goSection(navBtn.dataset.target); return; }

    if (e.target.closest('[data-close]')) { closeSheet(); return; }
    if (e.target.closest('[data-close-date]')) { closeDates(); return; }

    const dateItem = e.target.closest('[data-date]');
    if (dateItem) { switchDate(dateItem.dataset.date); return; }
  });

  $('#dateBtn').addEventListener('click', openDates);
  $('#retryBtn').addEventListener('click', () => location.reload());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeSheet(); closeDates(); }
  });

  const obs = new IntersectionObserver((entries) => {
    const visible = entries.filter((x) => x.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
    if (visible) {
      const key = visible.target.dataset.section;
      if (!$('#sheetRoot').hidden && key === 'saved') return;
      setActiveNav(key);
    }
  }, { rootMargin: '-140px 0px -55% 0px', threshold: [0.05, 0.3] });
  document.querySelectorAll('[data-section]').forEach((el) => obs.observe(el));
}

boot().then(bind).catch((err) => {
  showEmpty('页面出了点小问题', '刷新一下试试，或者看看控制台的报错。');
  console.error(err);
});