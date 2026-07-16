/* ============================================================
   app.js — 画面の組み立てと操作
   ============================================================ */
(function () {
  'use strict';

  var CLANS = window.SENGOKU_CLANS;
  var YEARS = window.SENGOKU_YEARS;

  var svg      = document.getElementById('map');
  var gWorld   = document.getElementById('world');
  var gProv    = document.getElementById('provinces');
  var gClanEdge= document.getElementById('clan-edges');
  var gCoast   = document.getElementById('coast');
  var gEzo     = document.getElementById('ezo');
  var overlay  = document.getElementById('overlay');
  var mapwrap  = document.getElementById('mapwrap');
  var legendList = document.getElementById('legend-list');
  var panel    = document.getElementById('panel');
  var range    = document.getElementById('year-range');

  var state = {
    yearIdx: 2,               // 初期表示は1575年
    selected: null,
    k: 1, tx: 0, ty: 0,
    shapes: null
  };

  var provPaths = {};   // 国ID -> <path>
  var edgePaths = {};   // 勢力ID -> <path>
  var overlayItems = [];

  /* ---------------- 地図の生成 ---------------- */
  function buildMap() {
    var g = GEO.build();
    gEzo.setAttribute('d', g.ezo);
    gCoast.setAttribute('d', g.coast);
    GEO.PROVINCES.forEach(function (p) {
      var el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      el.setAttribute('d', g.paths[p.id]);
      el.setAttribute('class', 'province');
      el.dataset.prov = p.id;
      gProv.appendChild(el);
      provPaths[p.id] = el;
    });
  }

  /* ---------------- 年代の反映 ---------------- */
  function ownerOf(provId, y) { return (y.owners[provId] || 'other'); }

  function renderYear() {
    var y = YEARS[state.yearIdx];

    document.getElementById('year-big').textContent = y.year;
    document.getElementById('year-note').textContent = '（' + y.era + '）' + y.note;
    range.value = state.yearIdx;
    document.getElementById('btn-prev').disabled = state.yearIdx === 0;
    document.getElementById('btn-next').disabled = state.yearIdx === YEARS.length - 1;

    // 国の塗り分け（CSS transition で自然に切り替わる）
    GEO.PROVINCES.forEach(function (p) {
      var c = CLANS[ownerOf(p.id, y)] || CLANS.other;
      provPaths[p.id].style.fill = c.color;
      provPaths[p.id].dataset.clan = ownerOf(p.id, y);
    });

    // 勢力ごとの外形線
    state.shapes = GEO.clanShapes(y.owners);
    Object.keys(edgePaths).forEach(function (id) { edgePaths[id].setAttribute('d', ''); });
    Object.keys(state.shapes).forEach(function (id) {
      var el = edgePaths[id];
      if (!el) {
        el = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        el.setAttribute('class', 'clan-edge');
        el.dataset.clan = id;
        gClanEdge.appendChild(el);
        edgePaths[id] = el;
      }
      el.setAttribute('d', state.shapes[id].d);
    });

    if (state.selected && !(state.selected in state.shapes)) state.selected = null;

    buildLegend(y);
    buildOverlay(y);
    highlight();
    renderPanel();
  }

  /* ---------------- 勢力一覧 ---------------- */
  function clansOfYear(y) {
    var ids = Object.keys(state.shapes).filter(function (id) { return y.clans[id]; });
    ids.sort(function (a, b) { return state.shapes[b].area - state.shapes[a].area; });
    return ids;
  }

  function buildLegend(y) {
    legendList.innerHTML = '';
    clansOfYear(y).forEach(function (id) {
      var c = CLANS[id];
      var li = document.createElement('button');
      li.className = 'legend-item';
      li.dataset.clan = id;
      li.innerHTML = '<span class="swatch" style="background:' + c.color + '"></span>' +
        '<span class="legend-name">' + c.name + '</span>';
      li.addEventListener('click', function () { select(id); });
      legendList.appendChild(li);
    });
  }

  /* ---------------- 地図上のラベル・城 ---------------- */
  function buildOverlay(y) {
    overlay.innerHTML = '';
    overlayItems = [];

    clansOfYear(y).forEach(function (id) {
      var s = state.shapes[id], c = CLANS[id];
      if (s.area < 900 || id === 'other') return;
      var el = document.createElement('div');
      el.className = 'map-label';
      el.dataset.clan = id;
      el.innerHTML = KAMON.svg(c.kamon, 22, '#fff') + '<span>' + c.name + '</span>';
      el.addEventListener('click', function (e) { e.stopPropagation(); select(id); });
      overlay.appendChild(el);
      overlayItems.push({ el: el, x: s.cx, y: s.cy, clan: id, rank: 0 });
    });

    clansOfYear(y).forEach(function (id) {
      var info = y.clans[id];
      if (!info || !info.castle) return;
      var xy = GEO.project(info.castle.lon, info.castle.lat);
      var el = document.createElement('div');
      el.className = 'map-castle';
      el.innerHTML = '<span class="castle-icon">🏯</span><span class="castle-name">' + info.castle.name + '</span>';
      overlay.appendChild(el);
      overlayItems.push({ el: el, x: xy[0], y: xy[1], rank: 1 });
    });

    var ezoXY = GEO.project(140.6, 42.1);
    var ez = document.createElement('div');
    ez.className = 'map-note';
    ez.textContent = '蝦夷地';
    overlay.appendChild(ez);
    overlayItems.push({ el: ez, x: ezoXY[0], y: ezoXY[1], rank: 2 });

    // 重なり判定用に大きさを一度だけ測っておく
    overlayItems.forEach(function (it) {
      it.w = it.el.offsetWidth || 48;
      it.h = it.el.offsetHeight || 18;
    });
    syncOverlay();
  }

  /* 画面座標へ反映しつつ、重なったラベルは間引く（拡大すると出てくる） */
  function syncOverlay() {
    var ctm = gWorld.getScreenCTM();
    if (!ctm) return;
    var r = mapwrap.getBoundingClientRect();

    var order = overlayItems.slice().sort(function (a, b) {
      var as = a.clan === state.selected ? -1 : a.rank;
      var bs = b.clan === state.selected ? -1 : b.rank;
      return as - bs;
    });
    var placed = [];
    order.forEach(function (it) {
      var sx = ctm.a * it.x + ctm.c * it.y + ctm.e - r.left;
      var sy = ctm.b * it.x + ctm.d * it.y + ctm.f - r.top;
      it.el.style.transform = 'translate(-50%,-50%) translate(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px)';

      var vis = sx > -60 && sy > -40 && sx < r.width + 60 && sy < r.height + 40;
      if (vis) {
        var box = { l: sx - it.w / 2 - 3, t: sy - it.h / 2 - 2, r: sx + it.w / 2 + 3, b: sy + it.h / 2 + 2 };
        for (var i = 0; i < placed.length; i++) {
          var q = placed[i];
          if (box.l < q.r && box.r > q.l && box.t < q.b && box.b > q.t) { vis = false; break; }
        }
        if (vis) placed.push(box);
      }
      it.el.style.visibility = vis ? 'visible' : 'hidden';
      it.el.style.pointerEvents = vis ? '' : 'none';
    });
  }

  /* ---------------- 選択と強調 ---------------- */
  function highlight() {
    Object.keys(edgePaths).forEach(function (id) {
      edgePaths[id].classList.toggle('is-selected', id === state.selected);
    });
    Array.prototype.forEach.call(overlay.querySelectorAll('.map-label'), function (el) {
      el.classList.toggle('is-selected', el.dataset.clan === state.selected);
    });
    Array.prototype.forEach.call(legendList.children, function (el) {
      el.classList.toggle('is-selected', el.dataset.clan === state.selected);
    });
    syncOverlay();
  }

  function select(clanId) {
    state.selected = clanId;
    document.body.classList.remove('legend-open');
    highlight();
    renderPanel();
    openSheet();
  }

  /* ---------------- 詳細パネル / ボトムシート ---------------- */
  function stars(n) {
    var s = '';
    for (var i = 1; i <= 5; i++) s += (i <= n ? '★' : '☆');
    return s;
  }

  function renderPanel() {
    var body = document.getElementById('panel-body');
    var y = YEARS[state.yearIdx];
    if (!state.selected) {
      body.innerHTML = '<p class="empty">地図の勢力をタップすると、その年の当主・本拠地・出来事を表示します。</p>';
      document.getElementById('panel-title').innerHTML = '<span class="ph">勢力の詳細</span>';
      return;
    }
    var id = state.selected, c = CLANS[id], info = y.clans[id];
    if (!info) { body.innerHTML = '<p class="empty">この年代のデータがありません。</p>'; return; }

    document.getElementById('panel-title').innerHTML =
      '<span class="crest" style="background:' + c.color + '">' + KAMON.svg(c.kamon, 26, '#fff') + '</span>' +
      '<span class="pt-name" style="color:' + c.color + '">' + c.name + '</span>' +
      '<span class="pt-year">' + y.year + '年</span>';

    var provs = GEO.PROVINCES.filter(function (p) { return ownerOf(p.id, y) === id; })
      .map(function (p) { return p.name; });

    var html = '';
    html += '<div class="portrait-row">' +
      '<div class="portrait" style="--c:' + c.color + '">' + KAMON.svg(c.kamon, 64, c.color) +
      '<span>肖像画</span></div>' +
      '<dl class="facts">' +
      '<dt>当主</dt><dd class="head">' + info.head + '</dd>' +
      '<dt>本拠地</dt><dd>' + (info.castle ? info.castle.name : '—') + '</dd>' +
      '<dt>主な領土</dt><dd>' + info.lands + '</dd>' +
      '<dt>勢力の強さ</dt><dd class="stars">' + stars(info.power) + '</dd>' +
      '</dl></div>';

    if (info.retainers && info.retainers.length) {
      html += '<h4>主な家臣</h4><ul class="retainers">' +
        info.retainers.map(function (r) { return '<li>' + r + '</li>'; }).join('') + '</ul>';
    }
    html += '<h4>' + y.year + '年の主な出来事</h4><ul class="events">' +
      info.events.map(function (e) { return '<li>' + e + '</li>'; }).join('') + '</ul>';

    html += '<div class="more" hidden><h4>解説</h4><p>' + info.desc + '</p>' +
      '<h4>この年の領国（' + provs.length + 'か国）</h4><p class="provlist">' + (provs.join('・') || '—') + '</p></div>';
    html += '<button class="btn-more" type="button">詳細を見る<span class="chev">›</span></button>';

    body.innerHTML = html;
    var btn = body.querySelector('.btn-more');
    btn.addEventListener('click', function () {
      var m = body.querySelector('.more');
      var open = !m.hidden;
      m.hidden = open;
      btn.firstChild.textContent = open ? '詳細を見る' : '詳細を閉じる';
      btn.classList.toggle('open', !open);
    });
  }

  function openSheet() { document.body.classList.add('sheet-open'); }
  function closeSheet() { document.body.classList.remove('sheet-open'); }

  /* ---------------- 変形（ズーム・パン） ---------------- */
  function applyTransform() {
    gWorld.setAttribute('transform', 'translate(' + state.tx + ' ' + state.ty + ') scale(' + state.k + ')');
    syncOverlay();
  }
  function clientToUser(cx, cy) {
    var ctm = svg.getScreenCTM().inverse();
    var p = svg.createSVGPoint(); p.x = cx; p.y = cy;
    return p.matrixTransform(ctm);
  }
  function clamp() {
    state.k = Math.min(8, Math.max(0.7, state.k));
    var w = GEO.MAP_W * state.k, h = GEO.MAP_H * state.k;
    var mx = GEO.MAP_W * 0.5, my = GEO.MAP_H * 0.5;
    state.tx = Math.min(mx, Math.max(GEO.MAP_W - w - mx, state.tx));
    state.ty = Math.min(my, Math.max(GEO.MAP_H - h - my, state.ty));
  }
  function zoomAt(u, ratio) {
    var wx = (u.x - state.tx) / state.k, wy = (u.y - state.ty) / state.k;
    state.k *= ratio;
    state.k = Math.min(8, Math.max(0.7, state.k));
    state.tx = u.x - wx * state.k;
    state.ty = u.y - wy * state.k;
    clamp(); applyTransform();
  }
  function zoomCenter(ratio) {
    var r = mapwrap.getBoundingClientRect();
    zoomAt(clientToUser(r.left + r.width / 2, r.top + r.height / 2), ratio);
  }
  function resetView() {
    state.k = 1; state.tx = 0; state.ty = 0; applyTransform();
  }

  /* ---------------- ポインタ操作 ---------------- */
  var pts = new Map(), prevDist = 0, prevMid = null, moved = 0, downAt = 0, downTarget = null;
  var lastTap = 0, lastTapPos = null;

  mapwrap.addEventListener('pointerdown', function (e) {
    mapwrap.setPointerCapture(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pts.size === 1) { moved = 0; downAt = Date.now(); downTarget = e.target; }
    prevDist = 0; prevMid = null;
  });

  mapwrap.addEventListener('pointermove', function (e) {
    if (!pts.has(e.pointerId)) return;
    var prev = pts.get(e.pointerId);
    pts.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (pts.size === 1) {
      var du = clientToUser(e.clientX, e.clientY), dp = clientToUser(prev.x, prev.y);
      state.tx += du.x - dp.x; state.ty += du.y - dp.y;
      moved += Math.abs(e.clientX - prev.x) + Math.abs(e.clientY - prev.y);
      clamp(); applyTransform();
    } else if (pts.size === 2) {
      var a = Array.from(pts.values());
      var dist = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y);
      var mid = clientToUser((a[0].x + a[1].x) / 2, (a[0].y + a[1].y) / 2);
      if (prevDist && prevMid) {
        state.tx += mid.x - prevMid.x; state.ty += mid.y - prevMid.y;
        zoomAt(mid, dist / prevDist);
      }
      prevDist = dist; prevMid = mid;
      moved += 50;
    }
  });

  function endPointer(e) {
    if (!pts.has(e.pointerId)) return;
    var single = pts.size === 1;
    pts.delete(e.pointerId);
    prevDist = 0; prevMid = null;
    if (!single) return;

    if (moved < 10 && Date.now() - downAt < 500) {
      // ダブルタップ判定
      var now = Date.now();
      if (lastTapPos && now - lastTap < 320 &&
          Math.hypot(e.clientX - lastTapPos.x, e.clientY - lastTapPos.y) < 30) {
        zoomAt(clientToUser(e.clientX, e.clientY), 1.9);
        lastTap = 0; lastTapPos = null;
        return;
      }
      lastTap = now; lastTapPos = { x: e.clientX, y: e.clientY };

      var t = downTarget && downTarget.closest ? downTarget.closest('[data-prov]') : null;
      if (t) {
        select(YEARS[state.yearIdx].owners[t.dataset.prov] || 'other');
      }
    }
  }
  mapwrap.addEventListener('pointerup', endPointer);
  mapwrap.addEventListener('pointercancel', endPointer);

  mapwrap.addEventListener('wheel', function (e) {
    e.preventDefault();
    zoomAt(clientToUser(e.clientX, e.clientY), Math.exp(-e.deltaY * 0.0016));
  }, { passive: false });

  /* ---------------- UI配線 ---------------- */
  function setYear(i) {
    state.yearIdx = Math.min(YEARS.length - 1, Math.max(0, i));
    renderYear();
  }

  function init() {
    buildMap();

    range.min = 0; range.max = YEARS.length - 1; range.step = 1;
    var ticks = document.getElementById('year-ticks');
    YEARS.forEach(function (y, i) {
      var s = document.createElement('button');
      s.type = 'button';
      s.className = 'tick';
      s.textContent = y.year;
      s.addEventListener('click', function () { setYear(i); });
      ticks.appendChild(s);
    });

    range.addEventListener('input', function () { setYear(+range.value); });
    document.getElementById('btn-prev').addEventListener('click', function () { setYear(state.yearIdx - 1); });
    document.getElementById('btn-next').addEventListener('click', function () { setYear(state.yearIdx + 1); });
    document.getElementById('btn-zoom-in').addEventListener('click', function () { zoomCenter(1.4); });
    document.getElementById('btn-zoom-out').addEventListener('click', function () { zoomCenter(1 / 1.4); });
    document.getElementById('btn-reset').addEventListener('click', resetView);
    document.getElementById('sheet-handle').addEventListener('click', closeSheet);
    document.getElementById('panel-close').addEventListener('click', closeSheet);
    document.getElementById('btn-legend').addEventListener('click', function () {
      document.body.classList.toggle('legend-open');
    });
    document.getElementById('btn-help').addEventListener('click', function () {
      document.getElementById('help').showModal();
    });
    document.getElementById('help-close').addEventListener('click', function () {
      document.getElementById('help').close();
    });

    window.addEventListener('resize', syncOverlay);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') setYear(state.yearIdx + 1);
      if (e.key === 'ArrowLeft') setYear(state.yearIdx - 1);
      if (e.key === 'Escape') closeSheet();
    });

    renderYear();
    applyTransform();
    setTimeout(syncOverlay, 60);
  }

  init();
})();
