/* ============================================================
   geo.js  —  日本列島と旧国のジオメトリ生成
   ------------------------------------------------------------
   ・海岸線 : 経緯度の粗いポリゴン（本州/四国/九州/佐渡/淡路/蝦夷地）
   ・旧国   : 「代表点(経緯度)」のみを持つ
   ・build(): 陸地をグリッド化 → 最寄り代表点で塗り分け → 輪郭抽出
              → 平滑化 → 旧国ごとのSVGパスを生成
   ・正式な旧国GeoJSONに差し替える場合は build() の戻り値
     { paths:{国ID:d}, ... } の形式だけ守れば他は無改修で動く
   ============================================================ */
window.GEO = (function () {
  'use strict';

  // ---- 投影（線形・縦をやや圧縮した古地図風スタイライズ） ----
  var LON0 = 129.0, LAT0 = 42.6, SX = 76, SY = 70;
  var MAP_W = 1000, MAP_H = 830;
  function P(lon, lat) { return [(lon - LON0) * SX, (LAT0 - lat) * SY]; }

  // ---- 海岸線（[経度, 緯度] の配列。時計回り・粗い） ----
  var COAST = {
    honshu: [
      [140.90,41.50],[141.40,41.00],[141.50,40.60],[141.90,39.90],[142.00,39.50],
      [141.90,39.00],[141.50,38.40],[141.05,38.30],[141.00,37.80],[141.05,37.00],
      [140.80,36.40],[140.60,36.20],[140.85,35.75],[140.40,35.50],[140.05,35.05],
      [139.85,34.90],[139.75,35.30],[139.90,35.65],[139.60,35.45],[139.60,35.15],
      [139.30,35.25],[139.07,35.10],[139.15,34.90],[138.85,34.60],[138.78,34.90],
      [138.85,35.10],[138.50,35.00],[138.23,34.60],[137.70,34.65],[137.05,34.60],
      [136.90,35.10],[136.60,34.75],[136.85,34.50],[136.90,34.30],[136.20,34.20],
      [135.95,33.85],[135.80,33.45],[135.40,33.70],[135.10,34.20],[135.35,34.55],
      [135.40,34.70],[135.20,34.68],[134.99,34.65],[134.70,34.78],[133.90,34.60],
      [133.40,34.45],[132.45,34.35],[132.20,34.15],[132.10,33.95],[131.80,34.05],
      [131.25,33.95],[130.95,33.95],[131.20,34.40],[131.40,34.42],[131.85,34.68],
      [132.08,34.90],[132.60,35.40],[133.35,35.55],[134.20,35.55],[134.60,35.65],
      [135.10,35.75],[135.35,35.55],[135.75,35.50],[136.05,35.65],[136.20,36.10],
      [136.60,36.60],[136.75,37.15],[136.90,37.50],[137.35,37.50],[137.15,36.95],
      [137.20,36.80],[137.85,37.05],[138.25,37.20],[138.55,37.35],[139.05,37.90],
      [139.50,38.25],[139.85,38.90],[140.05,39.75],[139.70,39.90],[140.00,40.05],
      [140.00,40.20],[140.05,40.55],[140.20,40.80],[140.35,41.15],[140.60,41.25]
    ],
    shikoku: [
      [133.70,34.35],[134.35,34.25],[134.60,34.10],[134.75,33.85],[134.60,33.55],
      [134.30,33.35],[134.18,33.25],[133.70,33.50],[133.30,33.35],[133.00,32.75],
      [132.70,32.95],[132.45,33.25],[132.60,33.45],[132.05,33.35],[132.35,33.60],
      [132.60,33.90],[133.00,34.05],[133.35,34.25]
    ],
    kyushu: [
      [130.95,33.93],[131.35,33.60],[131.70,33.35],[131.65,32.90],[131.75,32.60],
      [131.50,32.05],[131.35,31.55],[131.05,31.40],[130.68,30.98],[130.60,31.60],
      [130.50,31.25],[130.20,31.18],[130.15,31.60],[130.25,31.95],[130.40,32.20],
      [130.50,32.55],[130.35,32.90],[129.85,32.72],[129.75,33.05],[129.70,33.30],
      [130.00,33.45],[130.35,33.60],[130.50,33.90]
    ],
    sado:  [[138.20,38.25],[138.50,38.30],[138.55,38.00],[138.30,37.85]],
    awaji: [[134.70,34.55],[134.95,34.60],[135.00,34.35],[134.75,34.25]]
  };

  // 蝦夷地（当時の勢力外。装飾として描画するだけ）
  var EZO = [[139.90,42.60],[141.60,42.60],[141.20,42.00],[140.70,41.75],
             [140.20,41.40],[139.90,41.80],[140.40,42.10]];

  // ---- 旧国（id, 表示名, 所属する島, 代表点） ----
  var PROVINCES = [
    // 東北・北陸
    { id:'mutsu',    name:'陸奥',        island:'honshu', lon:141.30, lat:39.60 },
    { id:'nanou',    name:'岩代・磐城',  island:'honshu', lon:140.50, lat:36.90 },
    { id:'dewa',     name:'出羽',        island:'honshu', lon:140.10, lat:39.40 },
    { id:'echigo',   name:'越後',        island:'honshu', lon:138.80, lat:37.40 },
    { id:'sado',     name:'佐渡',        island:'sado',   lon:138.40, lat:38.05 },
    { id:'etchu',    name:'越中',        island:'honshu', lon:137.20, lat:36.70 },
    { id:'noto',     name:'能登',        island:'honshu', lon:136.95, lat:37.15 },
    { id:'kaga',     name:'加賀',        island:'honshu', lon:136.60, lat:36.40 },
    { id:'echizen',  name:'越前',        island:'honshu', lon:136.30, lat:35.95 },
    { id:'wakasa',   name:'若狭',        island:'honshu', lon:135.65, lat:35.45 },
    // 関東・甲信
    { id:'shinano',  name:'信濃',        island:'honshu', lon:138.00, lat:36.15 },
    { id:'hida',     name:'飛騨',        island:'honshu', lon:137.20, lat:36.15 },
    { id:'kai',      name:'甲斐',        island:'honshu', lon:138.60, lat:35.60 },
    { id:'kozuke',   name:'上野',        island:'honshu', lon:138.95, lat:36.50 },
    { id:'shimotsuke',name:'下野',       island:'honshu', lon:139.80, lat:36.70 },
    { id:'hitachi',  name:'常陸',        island:'honshu', lon:140.40, lat:36.35 },
    { id:'shimousa', name:'下総',        island:'honshu', lon:140.25, lat:35.85 },
    { id:'kazusa',   name:'上総',        island:'honshu', lon:140.15, lat:35.40 },
    { id:'awa_b',    name:'安房',        island:'honshu', lon:139.90, lat:35.05 },
    { id:'musashi',  name:'武蔵',        island:'honshu', lon:139.40, lat:35.85 },
    { id:'sagami',   name:'相模',        island:'honshu', lon:139.25, lat:35.40 },
    { id:'izu',      name:'伊豆',        island:'honshu', lon:138.95, lat:34.85 },
    // 東海
    { id:'suruga',   name:'駿河',        island:'honshu', lon:138.45, lat:35.15 },
    { id:'totomi',   name:'遠江',        island:'honshu', lon:137.85, lat:34.90 },
    { id:'mikawa',   name:'三河',        island:'honshu', lon:137.40, lat:34.90 },
    { id:'owari',    name:'尾張',        island:'honshu', lon:136.98, lat:35.18 },
    { id:'mino',     name:'美濃',        island:'honshu', lon:136.90, lat:35.55 },
    { id:'omi',      name:'近江',        island:'honshu', lon:136.15, lat:35.20 },
    { id:'ise',      name:'伊勢',        island:'honshu', lon:136.55, lat:34.60 },
    { id:'shima',    name:'志摩',        island:'honshu', lon:136.85, lat:34.35 },
    { id:'iga',      name:'伊賀',        island:'honshu', lon:136.15, lat:34.75 },
    // 畿内
    { id:'yamashiro',name:'山城',        island:'honshu', lon:135.80, lat:34.95 },
    { id:'yamato',   name:'大和',        island:'honshu', lon:135.85, lat:34.50 },
    { id:'kawachi',  name:'河内',        island:'honshu', lon:135.60, lat:34.55 },
    { id:'izumi',    name:'和泉',        island:'honshu', lon:135.40, lat:34.40 },
    { id:'settsu',   name:'摂津',        island:'honshu', lon:135.40, lat:34.80 },
    { id:'kii',      name:'紀伊',        island:'honshu', lon:135.60, lat:34.00 },
    // 山陰・山陽
    { id:'tanba',    name:'丹波',        island:'honshu', lon:135.30, lat:35.20 },
    { id:'tango',    name:'丹後',        island:'honshu', lon:135.15, lat:35.60 },
    { id:'tajima',   name:'但馬',        island:'honshu', lon:134.80, lat:35.40 },
    { id:'inaba',    name:'因幡',        island:'honshu', lon:134.20, lat:35.40 },
    { id:'hoki',     name:'伯耆',        island:'honshu', lon:133.60, lat:35.40 },
    { id:'izumo',    name:'出雲',        island:'honshu', lon:132.85, lat:35.30 },
    { id:'iwami',    name:'石見',        island:'honshu', lon:132.20, lat:34.85 },
    { id:'harima',   name:'播磨',        island:'honshu', lon:134.65, lat:35.00 },
    { id:'mimasaka', name:'美作',        island:'honshu', lon:134.05, lat:35.15 },
    { id:'bizen',    name:'備前',        island:'honshu', lon:134.00, lat:34.75 },
    { id:'bicchu',   name:'備中',        island:'honshu', lon:133.55, lat:34.80 },
    { id:'bingo',    name:'備後',        island:'honshu', lon:133.10, lat:34.70 },
    { id:'aki',      name:'安芸',        island:'honshu', lon:132.55, lat:34.50 },
    { id:'suo',      name:'周防',        island:'honshu', lon:131.90, lat:34.15 },
    { id:'nagato',   name:'長門',        island:'honshu', lon:131.20, lat:34.30 },
    // 南海
    { id:'awaji',    name:'淡路',        island:'awaji',  lon:134.85, lat:34.42 },
    { id:'awa_s',    name:'阿波',        island:'shikoku',lon:134.25, lat:33.95 },
    { id:'sanuki',   name:'讃岐',        island:'shikoku',lon:134.00, lat:34.25 },
    { id:'iyo',      name:'伊予',        island:'shikoku',lon:132.85, lat:33.60 },
    { id:'tosa',     name:'土佐',        island:'shikoku',lon:133.40, lat:33.40 },
    // 西海
    { id:'chikuzen', name:'筑前',        island:'kyushu', lon:130.50, lat:33.60 },
    { id:'chikugo',  name:'筑後',        island:'kyushu', lon:130.65, lat:33.25 },
    { id:'buzen',    name:'豊前',        island:'kyushu', lon:131.05, lat:33.60 },
    { id:'bungo',    name:'豊後',        island:'kyushu', lon:131.50, lat:33.10 },
    { id:'hizen',    name:'肥前',        island:'kyushu', lon:130.00, lat:33.20 },
    { id:'higo',     name:'肥後',        island:'kyushu', lon:130.75, lat:32.60 },
    { id:'hyuga',    name:'日向',        island:'kyushu', lon:131.40, lat:32.20 },
    { id:'osumi',    name:'大隅',        island:'kyushu', lon:130.95, lat:31.50 },
    { id:'satsuma',  name:'薩摩',        island:'kyushu', lon:130.40, lat:31.75 }
  ];

  // ================= 幾何ユーティリティ =================
  function toXYRing(ring) { return ring.map(function (p) { return P(p[0], p[1]); }); }

  function pointInRing(x, y, ring) {
    var inside = false, n = ring.length;
    for (var i = 0, j = n - 1; i < n; j = i++) {
      var xi = ring[i][0], yi = ring[i][1], xj = ring[j][0], yj = ring[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  // 閉ループのチャイキン平滑化
  function chaikin(pts, iter) {
    for (var t = 0; t < iter; t++) {
      var out = [];
      for (var i = 0; i < pts.length; i++) {
        var a = pts[i], b = pts[(i + 1) % pts.length];
        out.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25]);
        out.push([a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
      }
      pts = out;
    }
    return pts;
  }

  function ringArea(pts) {
    var s = 0;
    for (var i = 0; i < pts.length; i++) {
      var a = pts[i], b = pts[(i + 1) % pts.length];
      s += a[0] * b[1] - b[0] * a[1];
    }
    return Math.abs(s) / 2;
  }

  function toPathD(loops) {
    var d = '';
    for (var i = 0; i < loops.length; i++) {
      var pts = loops[i];
      d += 'M' + pts[0][0].toFixed(1) + ' ' + pts[0][1].toFixed(1);
      for (var j = 1; j < pts.length; j++) d += 'L' + pts[j][0].toFixed(1) + ' ' + pts[j][1].toFixed(1);
      d += 'Z';
    }
    return d;
  }

  // ================= グリッド構築 =================
  var STEP = 2.5;
  var COLS = Math.ceil(MAP_W / STEP), ROWS = Math.ceil(MAP_H / STEP);
  var labels = null;          // Int16Array : 旧国index / -1=海
  var provIndex = {};         // id -> index

  function buildGrid() {
    var ringsXY = {}, k;
    for (k in COAST) ringsXY[k] = toXYRing(COAST[k]);

    var seeds = PROVINCES.map(function (p, i) {
      var xy = P(p.lon, p.lat);
      provIndex[p.id] = i;
      return { x: xy[0], y: xy[1], island: p.island };
    });

    labels = new Int16Array(COLS * ROWS).fill(-1);
    for (var r = 0; r < ROWS; r++) {
      var y = (r + 0.5) * STEP;
      for (var c = 0; c < COLS; c++) {
        var x = (c + 0.5) * STEP, island = null;
        for (k in ringsXY) { if (pointInRing(x, y, ringsXY[k])) { island = k; break; } }
        if (!island) continue;
        var best = -1, bd = Infinity;
        for (var s = 0; s < seeds.length; s++) {
          if (seeds[s].island !== island) continue;
          var dx = seeds[s].x - x, dy = seeds[s].y - y, d = dx * dx + dy * dy;
          if (d < bd) { bd = d; best = s; }
        }
        if (best >= 0) labels[r * COLS + c] = best;
      }
    }
  }

  /* ラベルグリッドから領域ごとの輪郭ループを抽出する。
     cellId(index) が同じセルの外周を、セル辺の集合 → ループ結合 で取り出す。
     隣接領域は同じセル辺を共有するため、境界に隙間ができない。 */
  function traceRegions(cellId, groupCount) {
    var segs = [];                       // group -> [[startCorner, endCorner], ...]
    for (var g = 0; g < groupCount; g++) segs.push([]);
    var CH = ROWS + 2;
    function corner(ci, ri) { return ci * CH + ri; }

    for (var r = 0; r < ROWS; r++) {
      for (var c = 0; c < COLS; c++) {
        var g = cellId(labels[r * COLS + c]);
        if (g < 0) continue;
        var up    = r > 0        ? cellId(labels[(r - 1) * COLS + c]) : -1;
        var down  = r < ROWS - 1 ? cellId(labels[(r + 1) * COLS + c]) : -1;
        var left  = c > 0        ? cellId(labels[r * COLS + c - 1])   : -1;
        var right = c < COLS - 1 ? cellId(labels[r * COLS + c + 1])   : -1;
        var S = segs[g];
        if (up    !== g) S.push([corner(c, r),         corner(c + 1, r)]);
        if (right !== g) S.push([corner(c + 1, r),     corner(c + 1, r + 1)]);
        if (down  !== g) S.push([corner(c + 1, r + 1), corner(c, r + 1)]);
        if (left  !== g) S.push([corner(c, r + 1),     corner(c, r)]);
      }
    }

    var result = [];
    for (var gi = 0; gi < groupCount; gi++) {
      var list = segs[gi], loops = [];
      if (!list.length) { result.push(loops); continue; }
      var map = new Map(), used = new Uint8Array(list.length);
      for (var i = 0; i < list.length; i++) {
        var a = list[i][0];
        if (!map.has(a)) map.set(a, []);
        map.get(a).push(i);
      }
      for (var st = 0; st < list.length; st++) {
        if (used[st]) continue;
        var loop = [], cur = st, guard = 0;
        while (cur !== undefined && !used[cur] && guard++ < 200000) {
          used[cur] = 1;
          loop.push(list[cur][0]);
          var nexts = map.get(list[cur][1]), nxt;
          if (nexts) for (var n = 0; n < nexts.length; n++) if (!used[nexts[n]]) { nxt = nexts[n]; break; }
          cur = nxt;
        }
        if (loop.length < 4) continue;
        var pts = loop.map(function (key) {
          return [Math.floor(key / CH) * STEP, (key % CH) * STEP];
        });
        if (ringArea(pts) < STEP * STEP * 6) continue;
        loops.push(chaikin(pts, 2));
      }
      result.push(loops);
    }
    return result;
  }

  // ================= 公開API =================
  function build() {
    if (!labels) buildGrid();
    var loops = traceRegions(function (v) { return v; }, PROVINCES.length);
    var paths = {};
    PROVINCES.forEach(function (p, i) { paths[p.id] = toPathD(loops[i]); });

    // 海岸線（陸地全体の外形）
    var land = traceRegions(function (v) { return v >= 0 ? 0 : -1; }, 1);
    var coastD = toPathD(land[0]);

    return { paths: paths, coast: coastD, ezo: toPathD([chaikin(toXYRing(EZO), 1)]) };
  }

  /* 年代ごとの「勢力ごとの外形」と「重心・面積」を返す
     owners: {国ID: 勢力ID}  */
  function clanShapes(owners) {
    if (!labels) buildGrid();
    var ids = [], idx = {};
    PROVINCES.forEach(function (p) {
      var c = owners[p.id] || 'other';
      if (!(c in idx)) { idx[c] = ids.length; ids.push(c); }
    });
    var provToClan = new Int16Array(PROVINCES.length);
    PROVINCES.forEach(function (p, i) { provToClan[i] = idx[owners[p.id] || 'other']; });

    var loops = traceRegions(function (v) { return v < 0 ? -1 : provToClan[v]; }, ids.length);

    // 重心と面積（セル数ベース）
    var sx = new Float64Array(ids.length), sy = new Float64Array(ids.length), cnt = new Float64Array(ids.length);
    for (var r = 0; r < ROWS; r++) for (var c = 0; c < COLS; c++) {
      var v = labels[r * COLS + c];
      if (v < 0) continue;
      var g = provToClan[v];
      sx[g] += (c + 0.5) * STEP; sy[g] += (r + 0.5) * STEP; cnt[g]++;
    }
    // 重心が他家の領内に落ちる場合があるので、自領のセルへスナップする
    var gx = new Float64Array(ids.length), gy = new Float64Array(ids.length);
    for (var i2 = 0; i2 < ids.length; i2++) {
      gx[i2] = cnt[i2] ? sx[i2] / cnt[i2] : 0;
      gy[i2] = cnt[i2] ? sy[i2] / cnt[i2] : 0;
    }
    var bx = new Float64Array(ids.length), by = new Float64Array(ids.length);
    var bd = new Float64Array(ids.length).fill(Infinity);
    for (var r2 = 0; r2 < ROWS; r2++) for (var c2 = 0; c2 < COLS; c2++) {
      var v2 = labels[r2 * COLS + c2];
      if (v2 < 0) continue;
      var g2 = provToClan[v2];
      var x2 = (c2 + 0.5) * STEP, y2 = (r2 + 0.5) * STEP;
      var dd = (x2 - gx[g2]) * (x2 - gx[g2]) + (y2 - gy[g2]) * (y2 - gy[g2]);
      if (dd < bd[g2]) { bd[g2] = dd; bx[g2] = x2; by[g2] = y2; }
    }

    var out = {};
    ids.forEach(function (id, i) {
      out[id] = {
        d: toPathD(loops[i]),
        cx: cnt[i] ? bx[i] : 0,
        cy: cnt[i] ? by[i] : 0,
        area: cnt[i] * STEP * STEP
      };
    });
    return out;
  }

  function provinceAt(id) { return PROVINCES[provIndex[id]]; }

  return {
    MAP_W: MAP_W, MAP_H: MAP_H,
    PROVINCES: PROVINCES,
    project: P,
    build: build,
    clanShapes: clanShapes,
    provinceAt: provinceAt
  };
})();
