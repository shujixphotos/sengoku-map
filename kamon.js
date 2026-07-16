/* ============================================================
   kamon.js — 家紋（簡略図案）
   ------------------------------------------------------------
   100×100 の座標系で描いた単色シルエット。currentColor で塗る。
   実物の家紋は複雑なため、識別できる程度に単純化しています。
   画像に差し替える場合は KAMON.svg() の戻り値を <img> に変えるだけ。
   ============================================================ */
window.KAMON = (function () {
  'use strict';

  function dots(list, r) {
    return list.map(function (p) { return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + r + '"/>'; }).join('');
  }
  function diamond(cx, cy, w, h) {
    return '<path d="M' + cx + ' ' + (cy - h) + 'L' + (cx + w) + ' ' + cy + 'L' + cx + ' ' + (cy + h) + 'L' + (cx - w) + ' ' + cy + 'Z"/>';
  }
  function ring(cx, cy, r, t) {
    return '<circle cx="' + cx + '" cy="' + cy + '" r="' + r + '" fill="none" stroke="currentColor" stroke-width="' + t + '"/>';
  }

  var S = {
    // 武田菱（四つ割菱）
    takeda: diamond(50, 26, 17, 19) + diamond(50, 74, 17, 19) + diamond(26, 50, 17, 19) + diamond(74, 50, 17, 19),
    // 上杉（竹に雀を簡略化：輪に二枚笹）
    uesugi: ring(50, 50, 38, 7) +
      '<path d="M50 22 C34 34 30 54 40 74 C44 58 46 38 50 22Z"/>' +
      '<path d="M50 22 C66 34 70 54 60 74 C56 58 54 38 50 22Z"/>' +
      '<circle cx="50" cy="78" r="6"/>',
    // 北条鱗（三つ鱗）
    hojo: '<path d="M50 16 L74 58 L26 58Z"/><path d="M28 62 L46 92 L10 92Z"/><path d="M72 62 L90 92 L54 92Z"/>',
    // 伊達（九曜）
    date: dots([[50, 50]], 15) + dots([[50, 20], [50, 80], [20, 50], [80, 50], [29, 29], [71, 29], [29, 71], [71, 71]], 9),
    // 徳川（三つ葉葵を簡略化）
    tokugawa: ring(50, 50, 40, 6) +
      '<ellipse cx="50" cy="28" rx="15" ry="12"/><ellipse cx="31" cy="63" rx="15" ry="12" transform="rotate(-30 31 63)"/>' +
      '<ellipse cx="69" cy="63" rx="15" ry="12" transform="rotate(30 69 63)"/><circle cx="50" cy="50" r="6"/>',
    // 織田（木瓜を簡略化）
    oda: '<path fill-rule="evenodd" d="M50 8 C76 8 92 26 92 50 C92 74 76 92 50 92 C24 92 8 74 8 50 C8 26 24 8 50 8 Z' +
      'M50 26 C64 26 74 36 74 50 C74 64 64 74 50 74 C36 74 26 64 26 50 C26 36 36 26 50 26 Z"/>' +
      dots([[50, 50]], 8) + dots([[50, 35], [63, 45], [58, 61], [42, 61], [37, 45]], 6),
    // 毛利（一文字三星）
    mori: '<rect x="14" y="24" width="72" height="11" rx="5"/>' + dots([[50, 60], [26, 78], [74, 78]], 11),
    // 長宗我部（七つ酢漿草を簡略化）
    chosokabe: '<ellipse cx="50" cy="27" rx="12" ry="16"/><ellipse cx="29" cy="63" rx="12" ry="16" transform="rotate(-60 29 63)"/>' +
      '<ellipse cx="71" cy="63" rx="12" ry="16" transform="rotate(60 71 63)"/>' + dots([[50, 55], [30, 30], [70, 30], [50, 86]], 5),
    // 島津（丸に十文字）
    shimazu: ring(50, 50, 38, 8) + '<rect x="45" y="12" width="10" height="76"/><rect x="12" y="45" width="76" height="10"/>',
    // 今川（足利二つ引両）
    imagawa: ring(50, 50, 40, 6) + '<rect x="16" y="34" width="68" height="10"/><rect x="16" y="56" width="68" height="10"/>',
    // 斎藤（撫子）
    saito: dots([[50, 22], [78, 40], [68, 76], [32, 76], [22, 40]], 15) + '<circle cx="50" cy="52" r="8"/>',
    // 三好（三階菱）
    miyoshi: '<path d="M50 14 L82 30 L50 46 L18 30Z"/><path d="M50 40 L82 56 L50 72 L18 56Z"/><path d="M50 66 L82 82 L50 98 L18 82Z"/>',
    // 大内（大内菱）
    ouchi: diamond(50, 50, 34, 42) + '<path d="M50 26 L67 50 L50 74 L33 50Z" fill="#3a2c1a"/>',
    // 尼子（四つ目結）
    amago: '<rect x="16" y="16" width="30" height="30"/><rect x="54" y="16" width="30" height="30"/>' +
      '<rect x="16" y="54" width="30" height="30"/><rect x="54" y="54" width="30" height="30"/>',
    // 大友（抱き杏葉を簡略化）
    otomo: '<path d="M50 88 C18 70 16 32 40 12 C40 44 44 62 50 88Z"/><path d="M50 88 C82 70 84 32 60 12 C60 44 56 62 50 88Z"/><circle cx="50" cy="44" r="9"/>',
    // 龍造寺（十二日足）
    ryuzoji: '<circle cx="50" cy="50" r="16"/>' +
      (function () {
        var s = '';
        for (var i = 0; i < 12; i++) {
          var a = i * 30 * Math.PI / 180;
          s += '<path d="M' + (50 + 20 * Math.cos(a)) + ' ' + (50 + 20 * Math.sin(a)) +
            ' L' + (50 + 44 * Math.cos(a - 0.1)) + ' ' + (50 + 44 * Math.sin(a - 0.1)) +
            ' L' + (50 + 44 * Math.cos(a + 0.1)) + ' ' + (50 + 44 * Math.sin(a + 0.1)) + 'Z"/>';
        }
        return s;
      })(),
    // 豊臣（五七桐を簡略化）
    toyotomi: '<rect x="46" y="10" width="8" height="30" rx="4"/><rect x="30" y="16" width="7" height="24" rx="3.5"/>' +
      '<rect x="63" y="16" width="7" height="24" rx="3.5"/>' +
      '<path d="M50 92 C24 76 22 52 34 42 C42 58 46 74 50 92Z"/><path d="M50 92 C76 76 78 52 66 42 C58 58 54 74 50 92Z"/>',
    // 前田（梅鉢）
    maeda: '<circle cx="50" cy="50" r="13"/>' + dots([[50, 22], [76, 41], [66, 76], [34, 76], [24, 41]], 11),
    // 南部（向鶴を簡略化）
    nanbu: ring(50, 50, 38, 6) + '<path d="M50 30 C34 38 30 58 42 72 C40 56 44 40 50 30Z"/>' +
      '<path d="M50 30 C66 38 70 58 58 72 C60 56 56 40 50 30Z"/><circle cx="50" cy="26" r="7"/>',
    // 最上（丸に二引両）
    mogami: ring(50, 50, 40, 6) + '<rect x="18" y="36" width="64" height="9"/><rect x="18" y="56" width="64" height="9"/>',
    // 佐竹（五本骨扇）
    satake: '<path d="M50 86 L14 34 A46 46 0 0 1 86 34 Z"/>' +
      '<g stroke="#3a2c1a" stroke-width="3"><line x1="50" y1="86" x2="50" y2="24"/>' +
      '<line x1="50" y1="86" x2="22" y2="42"/><line x1="50" y1="86" x2="78" y2="42"/></g>',
    // 朝倉（三つ盛木瓜）
    asakura: '<ellipse cx="50" cy="28" rx="20" ry="16"/><ellipse cx="28" cy="66" rx="20" ry="16"/><ellipse cx="72" cy="66" rx="20" ry="16"/>',
    // 六角（隅立四つ目結）
    rokkaku: '<g transform="rotate(45 50 50)"><rect x="20" y="20" width="26" height="26"/><rect x="54" y="20" width="26" height="26"/>' +
      '<rect x="20" y="54" width="26" height="26"/><rect x="54" y="54" width="26" height="26"/></g>',
    // 一向一揆（下がり藤を簡略化）
    ikko: '<rect x="24" y="14" width="52" height="8" rx="4"/>' +
      '<path d="M28 20 C18 40 22 64 34 80 C30 58 28 38 28 20Z"/><path d="M72 20 C82 40 78 64 66 80 C70 58 72 38 72 20Z"/>' +
      dots([[42, 52], [58, 52], [50, 70]], 7),
    // その他
    other: ring(50, 50, 36, 7) + '<circle cx="50" cy="50" r="12"/>'
  };

  return {
    /** 家紋のSVG文字列を返す。size=px, color=CSS色 */
    svg: function (id, size, color) {
      var body = S[id] || S.other;
      return '<svg class="kamon" viewBox="0 0 100 100" width="' + size + '" height="' + size +
        '" style="color:' + (color || 'currentColor') + '" aria-hidden="true"><g fill="currentColor">' + body + '</g></svg>';
    }
  };
})();
