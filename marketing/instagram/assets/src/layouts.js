/* Template tata letak. Halaman dibuka sebagai template.html?id=<ID>; render.mjs memotret #root. */
(function () {
  const D = window.IG_DATA;
  const I = window.icon;

  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const fmt = (s) => esc(s || '')
    .replace(/\{\{(.+?)\}\}/g, (_, l) => `<span class="slot">${l}</span>`)
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\n/g, '<br>');
  const hasSlot = (o) => JSON.stringify(o).includes('{{');

  // Logo wide asli dipotong ke area gambarnya (tanpa ruang kosong file sumber 2172×724).
  const WIDE = { w: 2172, h: 724, x: 95, y: 122, cw: 1960, ch: 395 };
  function logoWide(width) {
    const s = width / WIDE.cw;
    return `<div class="logo-wide" style="width:${width}px;height:${Math.round(WIDE.ch * s)}px">` +
      `<img src="brand/logo-wide.png" alt="Tebar Kebaikan" style="width:${WIDE.w * s}px;left:${-WIDE.x * s}px;top:${-WIDE.y * s}px"></div>`;
  }
  const chip = (w = 230, cls = '') => `<div class="chip ${cls}">${logoWide(w)}</div>`;

  /* ---------- ilustrasi ---------- */
  const qrSvg = () => {
    // pola QR dekoratif (bukan kode yang bisa dipindai)
    let r = '';
    const on = (x, y) => ((x * 7 + y * 13 + x * y) % 5) < 2;
    for (let y = 0; y < 21; y++) for (let x = 0; x < 21; x++) {
      const finder = (x < 7 && y < 7) || (x > 13 && y < 7) || (x < 7 && y > 13);
      if (!finder && on(x, y)) r += `<rect x="${x}" y="${y}" width="1" height="1"/>`;
    }
    const f = (x, y) => `<rect x="${x + .5}" y="${y + .5}" width="6" height="6" fill="none" stroke="#17201C" stroke-width="1"/><rect x="${x + 2}" y="${y + 2}" width="3" height="3"/>`;
    return `<svg viewBox="0 0 21 21" width="100%" height="100%" fill="#17201C" shape-rendering="crispEdges">${r}${f(0, 0)}${f(14, 0)}${f(0, 14)}</svg>`;
  };
  const phone = (kind) => {
    const screens = {
      amount: `<div class="blk" style="height:150px"></div><div class="bar" style="width:80%"></div>
        <div class="bar" style="height:12px;background:var(--soft)"><div style="width:62%;height:100%;border-radius:8px;background:var(--primary)"></div></div>
        <div class="chips"><div></div><div class="on"></div><div></div><div></div></div><div class="btn"></div>`,
      form: `<div class="field">${I('user', 28)}<div class="bar"></div></div><div class="field">${I('mail', 28)}<div class="bar"></div></div>
        <div class="tog"><div class="bar" style="width:55%"></div><div class="sw"></div></div>
        <div class="tiles"><div class="on">${I('qr', 40)}</div><div>${I('wallet', 40)}</div><div>${I('bank', 40)}</div></div><div class="btn"></div>`,
      pay: `<div class="bar" style="width:60%;align-self:center"></div><div class="qrbox">${qrSvg()}</div>
        <div class="timer">${I('clock', 32)}<div class="bar"></div></div><div class="btn" style="background:#E9ECE9"></div>`,
      done: `<div class="okc">${I('check', 90)}</div><div class="bar" style="width:70%;align-self:center;margin-top:34px"></div>
        <div class="docrow" style="margin-top:auto">${I('receipt', 38)}<div class="bar"></div></div><div class="docrow">${I('mail', 38)}<div class="bar"></div></div>`,
      blank: '',
    };
    return `<div class="phone"><div class="scr">${screens[kind]}</div></div>`;
  };
  const paper = (scale = 1, extra = '') => `<div class="paper" style="transform:rotate(-4deg) scale(${scale});${extra}">
      <div class="row"><div class="bar g" style="width:46%;height:26px"></div><div class="bar k" style="width:24%;height:26px"></div></div>
      <hr><div class="bar" style="width:90%"></div><div class="bar" style="width:72%"></div><div class="bar" style="width:84%"></div>
      <hr><div class="row"><div class="bar" style="width:38%"></div><div class="bar g" style="width:34%;height:22px"></div></div>
      <div class="stamp">${I('check', 96)}</div></div>`;

  const arts = {
    'phone-cover': () => `<div class="glowphone"><div class="dots"><span>1</span><span>2</span><span>3</span></div>${phone('blank')}</div>`,
    flow: () => `<div class="flow">
        <div class="node"><div class="disc">${I('heart', 96)}</div>Donasi</div>
        <div class="node"><div class="disc">${I('coins', 96)}</div>Terkumpul</div>
        <div class="node hl"><div class="disc">${I('handheart', 96)}</div>Penyaluran</div></div>`,
    receipt: () => `<div style="margin-bottom:-60px">${paper(1.05)}</div>`,
    photo: () => `<div class="photo" style="width:100%;height:440px;margin-bottom:170px">${I('image', 96)}Foto dokumentasi asli (berizin)<br>atau ilustrasi berlabel “Ilustrasi”</div>`,
    shield: () => `<div style="position:relative;margin-bottom:170px;width:300px;height:300px;border-radius:50%;display:grid;place-items:center;background:#0B5A2C;box-shadow:0 0 0 40px rgba(250,249,245,.05),0 0 0 80px rgba(250,249,245,.03);color:var(--yellow)">${I('shield', 180)}</div>`,
  };

  /* ---------- perabot ---------- */
  const top = (series, n, total) => `<div class="top"><div class="series">${I('star', 30)}${esc(series)}</div>` +
    (n ? `<div class="count"><b>${n}</b> / ${total}</div>` : '') + `</div>`;
  const bot = (swipe) => `<div class="bot">${chip()}${swipe ? `<div class="swipe">Geser ${I('arrow', 34)}</div>` : ''}</div>`;
  const ribbon = `<div class="ribbon"><span>DRAF — PERLU DATA · JANGAN DIUNGGAH</span></div>`;

  /* ---------- template slide carousel ---------- */
  const T = {
    cover: (s) => `<div class="motif tr"></div><div class="main"><div class="display">${fmt(s.title)}</div>${s.body ? `<div class="p">${fmt(s.body)}</div>` : ''}
        <div class="art">${arts[s.art]()}</div></div>`,
    step: (s) => `<div class="main"><div class="step-head"><div class="num ${s.num === '✓' ? 'done' : ''}">${esc(s.num)}</div><div class="h">${fmt(s.title)}</div></div>
        <div class="p">${fmt(s.body)}</div><div class="stage"><div class="halo"></div>${phone(s.art.replace('phone-', ''))}</div></div>`,
    flowstep: (s) => {
      const names = ['Terkumpul', 'Penyaluran', 'Kabar'];
      const tr = names.map((n, i) => {
        const st = s.flow === 0 ? 'past' : (i + 1 < s.flow ? 'past' : i + 1 === s.flow ? 'on' : '');
        return `<div class="t ${st}"><i></i>${n}</div>` + (i < 2 ? `<div class="ln ${st === 'past' ? 'past' : ''}"></div>` : '');
      }).join('');
      return `<div class="main" style="justify-content:center"><div class="tracker">${tr}</div><div class="bigicon">${I(s.icon, 96)}</div>
        <div class="h">${fmt(s.title)}</div><div class="p">${fmt(s.body)}</div></div>`;
    },
    check: (s) => `<div class="motif tr"></div><div class="main" style="justify-content:center"><div class="checkbadge"><div class="b">${I('check', 70)}</div><div class="n">Alasan ${s.n} dari 3</div></div>
        <div class="h">${fmt(s.title)}</div><div class="p">${fmt(s.body)}</div></div>`,
    ways: (s) => `<div class="main" style="justify-content:center"><div class="h">${fmt(s.title)}</div>
        <div class="wayrows">${s.items.map(([ic, t]) => `<div class="wayrow"><div class="ti">${I(ic, 58)}</div><span>${fmt(t)}</span></div>`).join('')}</div></div>`,
    faq: (s) => `<div class="main" style="justify-content:center"><div class="who">TANYA</div><div class="qb">${fmt(s.q)}</div>
        <div class="who right" style="margin-top:48px;margin-bottom:-36px">JAWAB</div><div class="ab"><div class="ti">${I(s.icon, 52)}</div><div class="p">${fmt(s.a)}</div></div></div>`,
    story: (s) => `<div class="main"><div class="photo">${I('image', 96)}Foto dokumentasi asli (berizin)</div>
        <div class="kicker">${fmt(s.label)}</div><div class="p">${fmt(s.body)}</div></div>`,
    figure: (s) => `<div class="main" style="padding-top:40px"><div class="kicker">${fmt(s.label)}</div><div class="val">${fmt(s.value)}</div>
        <div class="p">${fmt(s.body)}</div><div class="src">${fmt(s.source)}</div></div>`,
    statement: (s) => `<div class="motif bl"></div><div class="main"><div class="display">${fmt(s.title)}</div><div class="p">${fmt(s.body)}</div></div>`,
    cta: (s) => `<div class="motif full"></div><div class="main">${chip(440, 'big')}<div class="display">${fmt(s.title)}</div>
        <div class="p">${fmt(s.body)}</div><div class="pill">Link di bio ${I('arrowup', 36)}</div></div>`,
  };
  const themeFor = (tpl, bg) => (tpl === 'cover' || tpl === 'cta') ? 't-dark' : (tpl === 'ways' || tpl === 'check') ? 't-gold' : (tpl === 'faq' ? 't-cream' : 't-' + bg);

  /* ---------- template feed ---------- */
  const bigStar = () => {
    const pts = [];
    for (let i = 0; i < 16; i++) { const a = Math.PI / 8 * i - Math.PI / 2, r = i % 2 ? 0.62 : 1; pts.push(`${(50 + 48 * r * Math.cos(a)).toFixed(2)},${(50 + 48 * r * Math.sin(a)).toFixed(2)}`); }
    return `<svg class="bigstar" viewBox="0 0 100 100"><defs><radialGradient id="g"><stop offset="0" stop-color="#F8B808" stop-opacity=".55"/><stop offset="1" stop-color="#F8B808" stop-opacity="0"/></radialGradient>
      <linearGradient id="h" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#F8B808"/><stop offset="1" stop-color="#F89808"/></linearGradient></defs>
      <circle cx="50" cy="50" r="40" fill="url(#g)"/><polygon points="${pts.join(' ')}" fill="none" stroke="#086828" stroke-opacity=".35" stroke-width=".5"/>
      <rect x="27" y="27" width="46" height="46" transform="rotate(45 50 50)" fill="none" stroke="#086828" stroke-opacity=".2" stroke-width=".5"/>
      <path d="M50 62s-13-7.6-13-16.4A6.8 6.8 0 0 1 50 42a6.8 6.8 0 0 1 13 3.6C63 54.4 50 62 50 62z" fill="url(#h)"/></svg>`;
  };
  const F = {
    intro: (s) => `<div class="motif tr"></div>${bigStar()}<div class="main"><div class="kicker">${fmt(s.kicker)}</div><div class="display" style="max-width:760px">${fmt(s.title)}</div>
        <div class="points">${s.points.map((p) => `<div>${I('check', 40)}<span>${fmt(p)}</span></div>`).join('')}</div>
        <div class="pill">${fmt(s.cta)} ${I('arrowup', 36)}</div></div>`,
    program: (s) => `<div class="photo top">${I('image', 110)}Foto dokumentasi asli program (berizin)<br>atau ilustrasi berlabel “Ilustrasi”</div>
      <div class="main"><div class="badge">${fmt(s.category)}</div><div class="h">${fmt(s.title)}</div>
        <div class="raised">${fmt(s.raised)}<small>${fmt(s.date)}</small></div>
        <div class="pill" style="align-self:flex-start;margin-top:auto">${fmt(s.cta)} ${I('arrowup', 36)}</div></div>`,
    anon: (s) => `<div class="motif tr"></div><div class="main"><div class="kicker">${fmt(s.kicker)}</div><div class="display">${fmt(s.title)}</div><div class="p">${fmt(s.body)}</div>
        <div class="anonart"><div class="box"></div><div class="env"></div>
          <div class="namecard"><div class="lbl">Donatur</div><div class="nm">Hamba Allah</div><div class="row">${I('heart', 36)}<div class="bar"></div></div></div></div>
        <div class="pill" style="align-self:flex-start;margin-top:40px">${fmt(s.cta)} ${I('arrowup', 36)}</div></div>`,
    receipt: (s) => `<div class="motif bl"></div><div class="main"><div class="kicker">${fmt(s.kicker)}</div><div class="display">${fmt(s.title)}</div><div class="p">${fmt(s.body)}</div>
        <div style="flex:1;display:flex;align-items:center;justify-content:center;position:relative">
          <div class="leaf" style="left:70px;top:60px;transform:rotate(-30deg)"></div><div class="leaf" style="left:120px;top:110px;transform:rotate(10deg);background:var(--primary)"></div>${paper(.82)}</div>
        <div class="pill" style="align-self:flex-start">${fmt(s.cta)} ${I('arrowup', 36)}</div></div>`,
    grid: (s) => `<div class="motif tr"></div><div class="main"><div class="kicker">${fmt(s.kicker)}</div><div class="display">${fmt(s.title)}</div>
        <div class="grid8">${s.items.map(([ic, t]) => `<div class="c">${I(ic, 84)}<span>${fmt(t)}</span></div>`).join('')}</div>
        <div class="pill" style="align-self:flex-start;margin-top:auto">${fmt(s.cta)} ${I('arrowup', 36)}</div></div>`,
  };
  const feedTheme = { intro: 't-cream', program: 't-cream', anon: 't-dark', receipt: 't-gold', grid: 't-soft' };

  /* ---------- daftar semua gambar ---------- */
  const entries = [];
  D.profile.forEach((p) => entries.push({ id: p.id, out: p.out, w: p.w, h: p.h, draft: false,
    html: () => `<div class="cv sq profile"><div class="motif ring"></div><img class="logo-icon" src="brand/logo-icon.png" alt="Tebar Kebaikan"></div>` }));
  D.feed.forEach((s) => {
    const draft = !!s.draft || hasSlot(s);
    entries.push({ id: s.id, out: s.out, w: 1080, h: 1350, draft, note: s.note,
      html: () => `<div class="cv feed ${s.tpl} ${feedTheme[s.tpl]} ${draft ? 'is-draft' : ''}">${draft ? ribbon : ''}${F[s.tpl](s)}<div class="bot">${chip()}</div></div>` });
  });
  D.carousels.forEach((c) => c.slides.forEach((s, i) => {
    const id = `${c.id}-S${i + 1}`, n = i + 1, total = c.slides.length, last = n === total;
    const draft = !!c.draft || !!s.draft || hasSlot(s);
    entries.push({ id, out: `carousel/${c.id}/${id}.png`, w: 1080, h: 1350, draft, note: s.note || (i === 0 ? c.note : undefined), group: c.id,
      html: () => `<div class="cv ${s.tpl} ${themeFor(s.tpl, c.bg)} ${draft ? 'is-draft' : ''}">${draft ? ribbon : ''}${top(c.series, n, total)}${T[s.tpl](s)}${bot(!last)}</div>` });
  }));
  window.IG_ENTRIES = entries;

  const id = new URLSearchParams(location.search).get('id');
  const e = entries.find((x) => x.id === id) || entries[0];
  document.getElementById('root').innerHTML = e.html();
})();
