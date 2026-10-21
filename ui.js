export function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const TZ = 'Asia/Shanghai';

export function fmtTime(iso) {
  if (!iso) return '时间未知';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '时间未知';
  const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(d);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
  const now = new Date();
  const nowParts = new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts(now);
  const todayKey = (nowParts.find((p) => p.type === 'month') || {}).value + '-' + (nowParts.find((p) => p.type === 'day') || {}).value;
  const key = get('month') + '-' + get('day');
  return key === todayKey ? get('hour') + ':' + get('minute') : get('month') + '月' + get('day') + '日 ' + get('hour') + ':' + get('minute');
}

export function fmtDay(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr + 'T12:00:00+08:00');
  if (Number.isNaN(d.getTime())) return dateStr;
  const parts = new Intl.DateTimeFormat('zh-CN', { timeZone: TZ, month: 'numeric', day: 'numeric', weekday: 'short' }).formatToParts(d);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value || '';
  return get('month') + '月' + get('day') + '日 · ' + get('weekday');
}

export function relTime(iso) {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(diff)) return '';
  const m = Math.round(diff / 60000);
  if (m < 1) return '刚刚';
  if (m < 60) return m + ' 分钟前';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' 小时前';
  return Math.round(h / 24) + ' 天前';
}

const CAT_LABEL = { family: '家长里短', romance: '婚恋狗血', oddity: '奇闻现场', scene: '离谱现场', twist: '反转后续', entertainment: '娱乐八卦', overseas: '海外瓜田', 'overseas-ent': '海外瓜田', life: '生活百态', gossip: '娱乐八卦', other: '新鲜事' };
export function catLabel(cat) { return CAT_LABEL[cat] || '新鲜事'; }

/* 内容性质：完全由现有字段推导（fact.mediaCount / sourceName），不编造、不臆测。
   mc 是独立媒体域名数：>=2 才能说"多家"，==1 只能说"单一媒体"，不能混淆。 */
export function natureOf(item) {
  const mc = (item.fact && item.fact.mediaCount) || 0;
  if (mc >= 2) return { key: 'media', text: '媒体报道', title: '多家独立媒体报道核实' };
  if (mc === 1) return { key: 'media', text: '媒体报道', title: '单一媒体报道，未见其他媒体跟进' };
  const name = item.sourceName || '';
  if (/热帖|小组|豆瓣|贴吧|论坛|社区|热议/.test(name)) return { key: 'user', text: '网友自述', title: '来自网友自述，未经媒体核实，请以原文为准' };
  return { key: 'topic', text: '热榜话题', title: '仅出现在热榜，未经媒体核实，请以原文为准' };
}

/* 把摘要拆成短句，供详情页分段阅读；只做切分，不改写、不编造。
   中文摘要常用逗号连接长句，因此按"，。"等标点逐级切分，保证能分段。 */
export function splitSentences(s) {
  const text = String(s || '').trim();
  if (!text) return [];
  let parts = text.match(/[^。！？…]+[。！？…]?/g) || [];
  parts = parts.map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1 && parts[0] && parts[0].length > 60) {
    const sub = parts[0].match(/[^，；,;]+[，；,;]?/g) || [];
    const cleaned = sub.map((p) => p.trim()).filter(Boolean);
    if (cleaned.length > 1) return cleaned;
  }
  return parts;
}

/* 取"一句话速览"：从短句列表取首句，若太短则顺延补足到约 20 字 */
export function pickHook(clauses) {
  let hook = '';
  let i = 0;
  while (i < clauses.length && hook.length < 20) {
    hook += clauses[i];
    i++;
  }
  return { hook, rest: clauses.slice(i) };
}

const PALETTE = {
  family: ['#FFE0C7', '#E58B4B', '🏠'],
  romance: ['#FFC1C7', '#F4555F', '💔'],
  oddity: ['#FFD8A8', '#F58A3C', '💥'],
  scene: ['#FFE3B8', '#E2782F', '😳'],
  twist: ['#D8D2FF', '#7C6BEA', '🔄'],
  entertainment: ['#F3D9FF', '#A24BC4', '🍿'],
  overseas: ['#CDE4FF', '#4F86C6', '🌍'],
  life: ['#C8EEDD', '#3E9C7C', '🍃']
};
// 品牌封面固定为西瓜粉（V0.1/V0.2 视觉），不随分类变化
const BRAND_COVER = ['#FFC1C7', '#F4555F'];
export function palette(cat) { return PALETTE[cat] || PALETTE.romance; }

export function sourceClass(item) {
  return item && item.sourceGroup === 'cn' ? 'src cn' : 'src';
}

export function storyText(item, fallback) {
  const s = (item.summary || '').trim();
  if (s) return s;
  if (!fallback) return '';
  if (item.sourceGroup === 'cn') return '热榜话题，原文没有提供摘要，点开链接看完整讨论。';
  return '原文为外文，这里保留了标题翻译与出处，细节以原文为准。';
}

export function coverHTML(cat, label) {
  return '<div class="cover" style="--c1:' + BRAND_COVER[0] + ';--c2:' + BRAND_COVER[1] + '">'
    + '<span class="cover-label">' + esc(label) + '</span>'
    + '<span class="motif" aria-hidden="true">🍿</span></div>';
}

export function badgesHTML(item) {
  const fact = (item.fact && item.fact.key) || 'platform';
  const factLabel = (item.fact && item.fact.label) || '平台热榜';
  const counts = [];
  if (item.fact && item.fact.mediaCount) counts.push(item.fact.mediaCount + ' 家媒体');
  if (item.fact && item.fact.platformCount) counts.push(item.fact.platformCount + ' 个热榜');
  const hint = [((item.fact && item.fact.hint) || ''), counts.join(' · ')].filter(Boolean).join('；');
  const nature = natureOf(item);
  return '<span class="chip cat cat-' + esc(item.category || 'life') + '">' + esc(catLabel(item.category)) + '</span>'
    + '<span class="chip nature nature-' + nature.key + '" title="' + esc(nature.title) + '">' + esc(nature.text) + '</span>'
    + (item.contentLevel === 'headline' ? '<span class="chip topic" title="原文没有摘要，只有话题名">话题</span>' : '')
    + (item.topicClass === 'celebrity-routine' ? '<span class="chip routine" title="普通活动/营业，不是重大八卦">营业</span>' : '')
    + (item.reversal ? '<span class="chip reversal" title="标题含有反转/辟谣/改口等明确证据">反转</span>' : '')
    + '<span class="chip fact fact-' + esc(fact) + '" title="' + esc(hint) + '">' + esc(factLabel) + '</span>';
}

export function cardHTML(item, index, saved) {
  const on = saved ? ' aria-pressed="true"' : ' aria-pressed="false"';
  return '<article class="card" style="--i:' + index + '" data-id="' + esc(item.id) + '">'
    + '<div class="card-head">'
    + '<span class="' + sourceClass(item) + '"><i class="dot"></i>' + esc(item.sourceName) + '</span>'
    + '<span class="time">' + esc(fmtTime(item.publishedAt)) + '</span>'
    + '<button class="like" type="button" data-like="' + esc(item.id) + '" aria-label="收藏这条瓜"' + on + '><span aria-hidden="true">♥</span></button>'
    + '</div>'
    + '<h3><a href="#" data-open="' + esc(item.id) + '">' + esc(item.title) + '</a></h3>'
    + (storyText(item) ? '<p class="story">' + esc(storyText(item)) + '</p>' : '')
    + '<div class="card-foot">' + badgesHTML(item)
    + '<a class="origin" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer nofollow">原文 ↗</a>'
    + '</div></article>';
}

export function featureHTML(item) {
  return '<article class="card feature" data-id="' + esc(item.id) + '">'
    + coverHTML(item.category, 'TODAY\u2019S PICK')
    + '<div class="feature-body">'
    + '<span class="feature-tag">✦ 今日必吃 Top 1</span>'
    + '<h3><a href="#" data-open="' + esc(item.id) + '">' + esc(item.title) + '</a></h3>'
    + '<p class="story">' + esc(storyText(item)) + '</p>'
    + '<div class="card-foot">' + badgesHTML(item)
    + '<span class="time">' + esc(fmtTime(item.publishedAt)) + '</span>'
    + '<a class="origin" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer nofollow">原文 ↗</a>'
    + '</div></div></article>';
}

function groupTimeline(list) {
  const out = [];
  for (const t of list || []) {
    const last = out[out.length - 1];
    if (last && last.title === t.title) {
      last.sources.push(t.source);
      if (t.kind === 'media') last.kinds.media = true;
      continue;
    }
    out.push({ title: t.title, sources: [t.source], url: t.url, kinds: { media: t.kind === 'media' } });
  }
  return out;
}

export function seriesHTML(ev, index, following) {
  const factLabel = (ev.fact && ev.fact.label) || '平台热榜';
  const tl = groupTimeline(ev.timeline).map(function (t) {
    return '<li><b>' + esc(t.title) + '</b>'
      + '<span class="tl-meta">' + esc(t.sources.join(' · ')) + (t.kinds.media ? ' · 含媒体' : ' · 仅热榜') + '</span>'
      + '<a class="tl-link" href="' + esc(t.url) + '" target="_blank" rel="noopener noreferrer nofollow">看这条 ↗</a></li>';
  }).join('');
  const followBtn = '<button class="follow-btn' + (following ? ' is-on' : '') + '" type="button" data-follow="' + esc(ev.id) + '" aria-pressed="' + (following ? 'true' : 'false') + '">'
    + (following ? '📌 已关注' : '📌 关注这条瓜') + '</button>';
  return '<article class="card series-card" style="--i:' + index + '">'
    + '<div class="tl-head"><span class="chip cat cat-gossip">连续追瓜</span>'
    + '<span class="chip fact fact-' + esc((ev.fact && ev.fact.key) || 'platform') + '">' + esc(factLabel) + '</span>'
    + '<span class="time">' + (ev.timeline || []).length + ' 个节点</span></div>'
    + '<h3><a href="#" data-open="' + esc(ev.itemId) + '">' + esc(ev.title) + '</a></h3>'
    + '<ol class="timeline">' + tl + '</ol>'
    + '<div class="series-foot">' + followBtn
    + '<span class="follow-hint">关注只保存在这台设备上，方便下次打开时接着看这件事的时间线，不会发消息提醒</span></div></article>';
}

export function sheetHTML(item, ev, saved, dateLabel) {
  const nature = natureOf(item);
  const orig = item.originalTitle
    ? '<div class="orig"><b>ORIGINAL HEADLINE</b>' + esc(item.originalTitle) + '</div>' : '';
  const img = (item.image && window.__XYCG_SHOW_IMAGES__)
    ? '<div class="img-wrap"><img src="' + esc(item.image) + '" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.parentNode.remove()" /></div>'
    : '';
  const timeline = ev && (ev.timeline || []).length > 1
    ? '<div class="sheet-timeline"><h3>这件事的时间线</h3><ol class="timeline">'
      + ev.timeline.map(function (t) {
        return '<li><b>' + esc(t.title) + '</b><span class="tl-meta">' + esc(t.source) + ' · ' + esc(t.kind === 'media' ? '媒体' : '热榜') + ' · ' + esc(fmtTime(t.at)) + '</span></li>';
      }).join('') + '</ol></div>'
    : '';
  const translatedNote = item.translated ? '标题与摘要由机器翻译，原文语义以链接为准' : '';
  /* 免责 hint：网友自述用专门文案（明确标注），其余用后端 fact.hint，避免重复啰嗦 */
  const hintBits = [];
  if (nature.key === 'user') {
    hintBits.push('以下为网友自述，未经任何媒体核实，请以原文为准');
  } else if (item.fact && item.fact.hint) {
    hintBits.push(item.fact.hint);
  } else {
    hintBits.push(nature.title);
  }
  if (translatedNote) hintBits.push(translatedNote);

  /* 故事正文：第一句做"一句话速览"，其余分段呈现；只切分不改写 */
  const raw = (item.summary || '').trim();
  const sentences = splitSentences(raw);
  let storyBlock = '';
  if (!raw) {
    storyBlock = '<p class="lead">' + esc(storyText(item, true)) + '</p>';
  } else if (sentences.length <= 1) {
    storyBlock = '<p class="lead">' + esc(raw) + '</p>';
  } else {
    const { hook, rest } = pickHook(sentences);
    /* 其余短句按每 2-3 句一组分段，避免一长串 */
    const paras = [];
    for (let i = 0; i < rest.length; i += 3) paras.push(rest.slice(i, i + 3).join(''));
    storyBlock = '<p class="hook"><span class="hook-label">一句话速览</span>' + esc(hook) + '</p>'
      + (paras.length
        ? '<div class="story-body"><h3 class="story-h">完整经过</h3>'
          + paras.map((p) => '<p>' + esc(p) + '</p>').join('') + '</div>'
        : '');
  }

  return '<div class="sheet-cat">' + badgesHTML(item) + '</div>'
    + '<h2 id="sheetTitle">' + esc(item.title) + '</h2>'
    + storyBlock
    + orig + img
    + '<div class="sheet-meta">'
    + '<div class="row"><span>内容性质</span><b>' + esc(nature.text) + '</b></div>'
    + '<div class="row"><span>来源</span><b>' + esc(item.sourceName) + '</b></div>'
    + '<div class="row"><span>发布时间</span><b>' + esc(fmtTime(item.publishedAt)) + (item.timeBasis === 'fetch' ? '（抓取时刻）' : '') + '</b></div>'
    + '<div class="row"><span>证据等级</span><b>' + esc((item.fact && item.fact.label) || '平台热榜') + '</b></div>'
    + '<div class="row"><span>核实情况</span><b>' + ((item.fact && item.fact.mediaCount) || 0) + ' 家媒体 / ' + ((item.fact && item.fact.platformCount) || 0) + ' 个热榜</b></div>'
    + (item.contentLevel === 'headline' ? '<div class="row"><span>内容类型</span><b>话题标题（原文无摘要）</b></div>' : '')
    + '<div class="row"><span>收录日期</span><b>' + esc(dateLabel || '') + '</b></div>'
    + '</div>'
    + timeline
    + '<div class="sheet-actions">'
    + '<a class="btn primary" href="' + esc(item.url) + '" target="_blank" rel="noopener noreferrer nofollow">去原文吃完整的瓜 ↗</a>'
    + '<button class="btn ghost" type="button" data-like="' + esc(item.id) + '" aria-pressed="' + (saved ? 'true' : 'false') + '">' + (saved ? '♥ 已收藏' : '♡ 收藏') + '</button>'
    + '</div>'
    + '<p class="hint">' + esc(hintBits.filter(Boolean).join('。')) + '。</p>';
}