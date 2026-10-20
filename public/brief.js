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
  function budgetPct(c) {
    var t = Number(c.budget_total) || 0;
    var r = Number(c.budget_remaining) || 0;
    if (t <= 0) return null;
    return Math.max(0, Math.min(100, Math.round((r / t) * 100)));
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
      document.title = c.title + ' — Clippers Pro';
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
      var pct = budgetPct(c);
      if (pct === null) {
        $('brief-budget-wrap').hidden = true;
      } else {
        $('brief-budget-numbers').textContent =
          'US$ ' + c.budget_remaining + ' de US$ ' + c.budget_total + ' · ' + pct + '% disponible';
        $('brief-budget-fill').style.width = pct + '%';
        $('brief-budget-updated').textContent = 'Actualizado: ' + fmtDateTime(c.updated_at);
      }
      var reqs = (c.requirements || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
      if (c.min_engagement_pct > 0 && !/engagement/i.test(c.requirements || '')) {
        reqs.push('Engagement mínimo del ' + c.min_engagement_pct + '% (lo exige la campaña para aprobar el clip).');
      }
      $('brief-requirements').innerHTML = reqs.length
        ? reqs.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('')
        : '<li>Sin requisitos publicados.</li>';
      $('brief-text').textContent = c.brief || '';
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
