// Página propia del brief de campaña (/campana/:id).
// Lee la campaña de la API pública y la presenta con el mismo estilo de la app.
(function () {
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (ch) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch];
    });
  }
  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function fmtDateTime(iso) {
    if (!iso) return '—';
    var d = new Date(String(iso).replace(' ', 'T') + 'Z');
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function budgetParts(c) {
    var t = Number(c.budget_total) || 0;
    if (t <= 0) return null;
    var avail = Math.max(0, Number(c.budget_remaining) || 0);
    var res = Math.max(0, Math.min(Number(c.budget_reserved) || 0, Math.max(0, t - avail)));
    var availPct = Math.max(0, Math.min(100, Math.round((avail / t) * 100)));
    var resPct = Math.max(0, Math.min(100, Math.round((res / t) * 100)));
    // Mínimo visible (pedido de Wilson): si hay dinero reservado, su segmento
    // nunca baja del 3% para que se note en la barra aunque sea un monto chico.
    if (res > 0 && resPct < 3) {
      resPct = 3;
      availPct = Math.min(availPct, 100 - resPct);
    }
    return { availPct: availPct, resPct: resPct };
  }

  // Convierte URLs en enlaces clicables (los Ref: de los estilos, por
  // ejemplo). Primero se escapa el texto y luego se enlazan las URLs, así
  // nunca se inyecta HTML que venga en el brief.
  function linkify(text) {
    return esc(text).replace(/https?:\/\/[^\s<]+/g, function (url) {
      var trail = '';
      while (/[.,;:!?)\]]$/.test(url)) { trail = url.slice(-1) + trail; url = url.slice(0, -1); }
      return '<a href="' + url + '" target="_blank" rel="noopener">' + url + '</a>' + trail;
    });
  }
  function richLines(text) {
    return String(text || '').split(/\r?\n/).map(linkify).join('<br>');
  }

  // Material de referencia: plataforma por la URL, reproductor incrustado
  // cuando la plataforma lo permite y, siempre, el enlace a la fuente de
  // origen (Instagram/TikTok/Drive), nunca a Lulosa/Whop.
  function materialInfo(url) {
    var u = String(url || '').trim();
    var low = u.toLowerCase();
    var platform = 'Enlace';
    var embed = '';
    var m;
    if (low.indexOf('instagram.com') !== -1) {
      platform = 'Instagram';
      m = u.match(/instagram\.com\/(p|reel|reels)\/([^/?#]+)/);
      if (m) embed = '<iframe class="material-frame-vertical" src="https://www.instagram.com/' + (m[1] === 'reels' ? 'reel' : m[1]) + '/' + m[2] + '/embed/" allowtransparency="true" allowfullscreen></iframe>';
    } else if (low.indexOf('tiktok.com') !== -1) {
      platform = 'TikTok';
      m = u.match(/\/video\/(\d+)/);
      if (m) embed = '<iframe class="material-frame-vertical" src="https://www.tiktok.com/embed/v2/' + m[1] + '" allowfullscreen></iframe>';
    } else if (low.indexOf('drive.google.com') !== -1) {
      platform = 'Drive';
      m = u.match(/\/file\/d\/([^/?#]+)/);
      if (m) embed = '<iframe class="material-frame-horizontal" src="https://drive.google.com/file/d/' + m[1] + '/preview" allowfullscreen></iframe>';
    } else if (low.indexOf('youtube.com') !== -1 || low.indexOf('youtu.be') !== -1) {
      platform = 'YouTube';
      m = u.match(/(?:v=|youtu\.be\/|shorts\/)([A-Za-z0-9_-]{6,})/);
      if (m) embed = '<iframe class="material-frame-horizontal" src="https://www.youtube.com/embed/' + m[1] + '" allowfullscreen></iframe>';
    }
    return { url: u, platform: platform, embed: embed };
  }

  var m = window.location.pathname.match(/\/campana\/(\d+)/);
  var id = m ? Number(m[1]) : 0;

  function fail() {
    $('brief-loading').hidden = true;
    $('brief-content').hidden = true;
    $('brief-error').hidden = false;
  }

  if (!id) { fail(); return; }

  fetch('/api/campaigns/' + id)
    .then(function (r) {
      if (!r.ok) throw new Error('not found');
      return r.json();
    })
    .then(function (data) {
      var c = data.campaign;
      if (!c) throw new Error('not found');
      document.title = c.title + ' — Clippers Media';
      if (c.image_url) {
        var img = $('brief-img');
        img.src = c.image_url;
        img.hidden = false;
      }
      $('brief-example').hidden = !c.is_example;
      $('brief-category').textContent = c.category || '';
      $('brief-title').textContent = c.title;
      $('brief-artist').textContent = c.artist || '';
      $('brief-pay').textContent = c.payout_text || '—';
      $('brief-date').textContent = c.deadline ? 'Termina ' + fmtDate(c.deadline) : 'Sin fecha límite';
      var bp = budgetParts(c);
      if (!bp) {
        $('brief-budget-wrap').hidden = true;
      } else {
        $('brief-budget-avail').textContent = 'US$ ' + c.budget_remaining;
        $('brief-budget-res').textContent = 'US$ ' + (c.budget_reserved || 0);
        $('brief-budget-total').textContent = 'de US$ ' + c.budget_total;
        $('brief-budget-fill').style.width = bp.availPct + '%';
        $('brief-budget-fill-res').style.width = bp.resPct + '%';
      }
      var reqs = (c.requirements || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      if (c.min_engagement_pct > 0 && !/engagement/i.test(c.requirements || '')) {
        reqs.push('Engagement mínimo del ' + c.min_engagement_pct + '% (lo exige la campaña para aprobar el clip).');
      }
      $('brief-requirements').innerHTML = reqs.length
        ? reqs.map(function (r) { return '<li>' + linkify(r) + '</li>'; }).join('')
        : '<li>Sin requisitos publicados.</li>';
      $('brief-text').innerHTML = c.brief ? richLines(c.brief) : '';
      var mats = (c.materials || '').split(/\r?\n/).map(function (s) { return s.trim(); }).filter(Boolean).map(materialInfo);
      if (mats.length) {
        $('brief-materials').innerHTML = mats.map(function (mi) {
          return '<div class="material-card">' +
            (mi.embed ? '<div class="material-embed">' + mi.embed + '</div>' : '') +
            '<a class="material-origin" href="' + esc(mi.url) + '" target="_blank" rel="noopener">Ver en ' + mi.platform + ' ↗</a></div>';
        }).join('');
        $('brief-materials-wrap').hidden = false;
      }
      var submit = $('brief-submit');
      if (c.is_example) {
        submit.hidden = true;
      } else {
        submit.href = '/?submit=' + c.id;
      }
      $('brief-loading').hidden = true;
      $('brief-content').hidden = false;
    })
    .catch(fail);
})();
