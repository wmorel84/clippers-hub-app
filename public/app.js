/* Hub de Wilson — lógica del frontend */
(function () {
  'use strict';

  var state = { user: null, campaigns: [], filter: 'all', query: '', editingId: null };
  var lastUnread = 0; // para detectar notificaciones nuevas en el sondeo automático
  var POLL_MS = 30000; // cada cuánto se buscan novedades (30 segundos)

  function $(id) { return document.getElementById(id); }

  function fmtDate(iso) {
    if (!iso) return '—';
    var d = new Date(iso.length <= 10 ? iso + 'T12:00:00' : iso);
    if (isNaN(d)) return iso;
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function fmtDateTime(iso) {
    if (!iso) return '';
    var d = new Date(iso.replace(' ', 'T') + 'Z');
    if (isNaN(d)) return '';
    return d.toLocaleDateString('es', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  async function api(path, opts) {
    opts = opts || {};
    var res = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts));
    var data = await res.json().catch(function () { return {}; });
    if (!res.ok) throw new Error(data.error || 'Error en la solicitud.');
    return data;
  }

  /* ---------------- Navegación ---------------- */
  var pageTitles = {
    campanas: 'Campañas', 'mis-clips': 'Mis clips', cuentas: 'Mis cuentas', billetera: 'Billetera',
    referidos: 'Referidos', cursos: 'Cursos', chat: 'Chat', admin: 'Gestión'
  };

  function goTo(page) {
    document.querySelectorAll('.app-page').forEach(function (el) { el.hidden = true; });
    var target = document.querySelector('.app-page[data-page="' + page + '"]');
    if (target) target.hidden = false;
    document.querySelectorAll('.sb-item').forEach(function (btn) {
      btn.classList.toggle('active', btn.getAttribute('data-page-target') === page);
    });
    $('current-page-title').textContent = pageTitles[page] || 'Campañas';
    document.body.classList.remove('sidebar-open');
    if (page === 'mis-clips') loadClips();
    if (page === 'cuentas') loadAccounts();
    if (page === 'billetera') loadWallet();
    if (page === 'admin') { loadAdminTable(); loadAdminAccounts(); loadAdminWallet(); loadAdminClips(); }
    window.scrollTo(0, 0);
  }

  document.querySelectorAll('.sb-item').forEach(function (btn) {
    btn.addEventListener('click', function () { goTo(btn.getAttribute('data-page-target')); });
  });

  $('menu-toggle').addEventListener('click', function () {
    document.body.classList.toggle('sidebar-open');
  });
  $('sb-backdrop').addEventListener('click', function () {
    document.body.classList.remove('sidebar-open');
  });

  function sidebarSearchSync() {
    $('search').value = $('sb-search-input').value;
    state.query = $('sb-search-input').value;
    renderCampaigns();
  }
  $('sb-search-input').addEventListener('input', sidebarSearchSync);
  $('search').addEventListener('input', function () {
    state.query = $('search').value;
    $('sb-search-input').value = $('search').value;
    renderCampaigns();
  });

  /* ---------------- Campañas ---------------- */
  function normalize(t) {
    return t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }

  function budgetPct(c) {
    if (!c.budget_total || c.budget_total <= 0) return null;
    return Math.max(0, Math.min(100, Math.round((c.budget_remaining / c.budget_total) * 100)));
  }

  function budgetHtml(c) {
    var pct = budgetPct(c);
    if (pct === null) return '';
    return '<div class="budget">' +
      '<div class="budget-label"><span>Presupuesto restante</span><span>US$ ' + esc(c.budget_remaining) + ' de US$ ' + esc(c.budget_total) + '</span></div>' +
      '<div class="budget-track"><div class="budget-fill" style="width:' + pct + '%"></div></div>' +
      '<span class="budget-updated">Actualizado: ' + esc(fmtDateTime(c.updated_at)) + '</span></div>';
  }

  function filteredCampaigns() {
    var q = normalize(state.query.trim());
    return state.campaigns.filter(function (c) {
      if (state.filter !== 'all' && c.category !== state.filter) return false;
      if (!q) return true;
      return normalize(c.title + ' ' + c.artist + ' ' + c.platform + ' ' + c.payout_text).indexOf(q) !== -1;
    });
  }

  function renderCampaigns() {
    var list = filteredCampaigns();
    var grid = $('campaign-grid');
    grid.innerHTML = '';
    $('campaign-empty').hidden = list.length > 0;
    $('count').textContent = list.length + (list.length === 1 ? ' campaña mostrada' : ' campañas mostradas');
    list.forEach(function (c) {
      var card = document.createElement('article');
      card.className = 'card';
      card.innerHTML =
        '<div class="card-top"><span class="badge ' + (c.is_example ? 'example' : 'real') + '">' +
        (c.is_example ? 'EJEMPLO' : 'CAMPAÑA REAL') + '</span>' +
        (c.platform ? '<span class="platform-tag">' + esc(c.platform) + '</span>' : '') + '</div>' +
        '<h3>' + esc(c.title) + '</h3>' +
        (c.artist ? '<p class="artist">' + esc(c.artist) + '</p>' : '') +
        (c.payout_text ? '<p class="pay">' + esc(c.payout_text) + '</p>' : '') +
        budgetHtml(c) +
        '<div class="card-actions"><button class="btn small" data-detail="' + c.id + '">Ver brief</button>' +
        (c.is_example ? '' : ' <button class="btn small primary" data-submit="' + c.id + '">Enviar clip</button>') + '</div>';
      grid.appendChild(card);
    });
    grid.querySelectorAll('[data-detail]').forEach(function (btn) {
      btn.addEventListener('click', function () { openDetail(Number(btn.getAttribute('data-detail'))); });
    });
    grid.querySelectorAll('[data-submit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        openSubmit(Number(btn.getAttribute('data-submit')));
      });
    });
  }

  document.querySelectorAll('.filter').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('.filter').forEach(function (b) {
        b.classList.remove('active'); b.setAttribute('aria-pressed', 'false');
      });
      btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true');
      state.filter = btn.getAttribute('data-filter');
      renderCampaigns();
    });
  });

  async function loadCampaigns() {
    try {
      var data = await api('/api/campaigns');
      state.campaigns = data.campaigns;
      renderCampaigns();
    } catch (e) {
      $('campaign-grid').innerHTML = '<p class="empty">No se pudieron cargar las campañas.</p>';
    }
  }

  function openDetail(id) {
    var c = state.campaigns.find(function (x) { return x.id === id; });
    if (!c) return;
    state.detailCampaignId = c.id;
    $('dialog-source').textContent = c.platform ? 'ORIGEN: ' + c.platform.toUpperCase() : '';
    $('dialog-category').textContent = c.category || '';
    var badge = $('dialog-badge');
    badge.textContent = c.is_example ? 'EJEMPLO' : 'CAMPAÑA REAL';
    badge.className = 'badge ' + (c.is_example ? 'example' : 'real');
    $('dialog-title').textContent = c.title;
    $('dialog-artist').textContent = c.artist || '';
    $('dialog-pay').textContent = c.payout_text || '—';
    $('dialog-date').textContent = c.deadline ? 'Termina ' + fmtDate(c.deadline) : 'Sin fecha límite';
    var reqs = (c.requirements || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    // El engagement mínimo es un requisito estructurado: se muestra salvo que el
    // texto ya lo mencione (para no duplicarlo).
    if (c.min_engagement_pct > 0 && !/engagement/i.test(c.requirements || '')) {
      reqs.push('Engagement mínimo del ' + c.min_engagement_pct + '% (lo exige la campaña para aprobar el clip).');
    }
    $('dialog-requirements').innerHTML = reqs.length
      ? reqs.map(function (r) { return '<li>' + esc(r) + '</li>'; }).join('')
      : '<li>Sin requisitos publicados.</li>';
    $('dialog-brief').textContent = c.brief || '';
    var wrap = $('dialog-budget-wrap');
    if (budgetPct(c) === null) { wrap.hidden = true; }
    else {
      wrap.hidden = false;
      var pct = budgetPct(c);
      $('dialog-budget-numbers').textContent = 'US$ ' + c.budget_remaining + ' de US$ ' + c.budget_total + ' · ' + pct + '% disponible';
      $('dialog-budget-fill').style.width = pct + '%';
      $('dialog-budget-updated').textContent = 'Actualizado: ' + fmtDateTime(c.updated_at);
    }
    $('detail-dialog').showModal();
  }
  $('close-dialog').addEventListener('click', function () { $('detail-dialog').close(); });

  /* ---------------- Auth ---------------- */
  var authMode = 'login';

  function setAuthMode(mode) {
    authMode = mode;
    $('tab-login').classList.toggle('active', mode === 'login');
    $('tab-register').classList.toggle('active', mode === 'register');
    $('field-name').hidden = mode !== 'register';
    $('auth-title').textContent = mode === 'login' ? 'Iniciar sesión' : 'Crear cuenta';
    $('auth-submit').textContent = mode === 'login' ? 'Entrar' : 'Registrarme';
    $('auth-error').textContent = '';
  }
  $('tab-login').addEventListener('click', function () { setAuthMode('login'); });
  $('tab-register').addEventListener('click', function () { setAuthMode('register'); });

  function openAuth() { setAuthMode('login'); $('auth-dialog').showModal(); }
  $('login-open').addEventListener('click', openAuth);
  $('auth-close').addEventListener('click', function () { $('auth-dialog').close(); });

  $('auth-form').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    $('auth-error').textContent = '';
    var payload = {
      email: $('auth-email').value.trim(),
      password: $('auth-password').value
    };
    if (authMode === 'register') payload.name = $('auth-name').value.trim();
    try {
      var data = await api('/api/auth/' + authMode, { method: 'POST', body: JSON.stringify(payload) });
      $('auth-dialog').close();
      $('auth-form').reset();
      setUser(data.user);
    } catch (e) {
      $('auth-error').textContent = e.message;
    }
  });

  function setUser(user) {
    state.user = user;
    var area = $('auth-area');
    if (user) {
      var initial = esc((user.name || user.email || '?').charAt(0).toUpperCase());
      area.innerHTML = '<div class="user-chip"><span class="avatar">' + initial + '</span>' +
        '<span>' + esc(user.name) + '</span>' +
        '<button class="link-btn" id="logout-btn" type="button">Cerrar sesión</button></div>';
      $('logout-btn').addEventListener('click', async function () {
        await api('/api/auth/logout', { method: 'POST' }).catch(function () {});
        setUser(null);
      });
      $('sb-admin-nav').hidden = user.role !== 'admin';
    } else {
      area.innerHTML = '<button class="top-action" id="login-open" type="button">' +
        '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><path d="m10 17 5-5-5-5M15 12H3"/></svg>' +
        '<span class="signin-label">Iniciar sesión</span></button>';
      $('login-open').addEventListener('click', openAuth);
      $('sb-admin-nav').hidden = true;
    }
    loadNotifications();
  }

  async function checkSession() {
    try {
      var data = await api('/api/auth/me');
      setUser(data.user);
    } catch (e) {
      setUser(null);
    }
  }

  /* ---------------- Notificaciones ---------------- */
  function renderNotifications(list, unread) {
    var box = $('notifications-list');
    var dot = $('bell-dot');
    if (unread > 0) { dot.hidden = false; dot.textContent = unread > 99 ? '99+' : unread; }
    else { dot.hidden = true; }
    if (!state.user) {
      box.innerHTML = '<div class="notif-empty">Inicia sesión para ver tus notificaciones.</div>';
      return;
    }
    if (!list.length) {
      box.innerHTML = '<div class="notif-empty">No tienes notificaciones.</div>';
      return;
    }
    box.innerHTML = list.map(function (n) {
      return '<div class="notification-item' + (n.is_read ? '' : ' unread') + '"><strong>' + esc(n.title) + '</strong>' +
        (n.body ? '<p>' + esc(n.body) + '</p>' : '') +
        '<time>' + esc(fmtDateTime(n.created_at)) + '</time></div>';
    }).join('');
  }

  async function loadNotifications() {
    if (!state.user) { renderNotifications([], 0); return; }
    try {
      var data = await api('/api/notifications');
      lastUnread = data.unread;
      renderNotifications(data.notifications, data.unread);
    } catch (e) { renderNotifications([], 0); }
  }

  /* ---------------- Sondeo automático de novedades ---------------- */
  // Cada POLL_MS revisa si hay notificaciones nuevas y, si las hay, refresca
  // la vista actual (sin borrar lo que el admin esté escribiendo en los campos
  // de código). Así los cambios del otro lado aparecen solos, sin recargar.
  function currentPageName() {
    var page = document.querySelector('.app-page:not([hidden])');
    return page ? page.getAttribute('data-page') : null;
  }

  async function pollUpdates() {
    if (!state.user || document.hidden) return;
    try {
      var data = await api('/api/notifications');
      var hadNews = data.unread > lastUnread;
      lastUnread = data.unread;
      renderNotifications(data.notifications, data.unread);
      if (!hadNews) return;
      var page = currentPageName();
      if (page === 'admin') { loadAdminAccounts(true); loadAdminWallet(); loadAdminClips(); }
      else if (page === 'cuentas') loadAccounts();
      else if (page === 'mis-clips') loadClips();
    } catch (e) { /* sesión vencida o sin red: se reintenta solo */ }
  }
  setInterval(pollUpdates, POLL_MS);

  $('notifications-toggle').addEventListener('click', function () {
    var panel = $('notifications-panel');
    var open = panel.hidden;
    panel.hidden = !open;
    $('notifications-toggle').setAttribute('aria-expanded', String(open));
  });
  document.addEventListener('click', function (ev) {
    var panel = $('notifications-panel');
    if (!panel.hidden && !panel.contains(ev.target) && !$('notifications-toggle').contains(ev.target)) {
      panel.hidden = true;
      $('notifications-toggle').setAttribute('aria-expanded', 'false');
    }
  });
  $('notif-read-all').addEventListener('click', async function () {
    if (!state.user) return;
    await api('/api/notifications/read-all', { method: 'POST' }).catch(function () {});
    loadNotifications();
  });

  /* ---------------- Enviar un clip ---------------- */
  function openSubmit(preselectId) {
    $('submit-error').textContent = '';
    $('submit-ok').hidden = true;
    var loggedIn = !!state.user;
    $('submit-logged-out').hidden = loggedIn;
    $('submit-form').hidden = !loggedIn;
    if (loggedIn) {
      var sel = $('submit-campaign');
      sel.innerHTML = state.campaigns.filter(function (c) { return !c.is_example; }).map(function (c) {
        return '<option value="' + c.id + '"' + (c.id === preselectId ? ' selected' : '') + '>' + esc(c.title) + '</option>';
      }).join('') || '<option value="">Sin campañas reales disponibles</option>';
    }
    $('submit-dialog').showModal();
  }
  $('sb-submit').addEventListener('click', function () { openSubmit(null); });
  $('close-submit').addEventListener('click', function () { $('submit-dialog').close(); });
  $('dialog-submit-clip').addEventListener('click', function () {
    $('detail-dialog').close();
    openSubmit(state.detailCampaignId || null);
  });
  $('submit-goto-login').addEventListener('click', function () {
    $('submit-dialog').close(); openAuth();
  });
  $('submit-form').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    $('submit-error').textContent = '';
    try {
      await api('/api/clips', {
        method: 'POST',
        body: JSON.stringify({ campaign_id: Number($('submit-campaign').value), url: $('submit-url').value.trim() })
      });
      $('submit-form').reset();
      $('submit-form').hidden = true;
      $('submit-ok').hidden = false;
    } catch (e) {
      $('submit-error').textContent = e.message;
    }
  });

  /* ---------------- Mis clips / Billetera ---------------- */
  var statusLabel = { pending: 'En revisión', approved: 'Aprobado', rejected: 'Rechazado' };

  async function loadClips() {
    var card = $('clips-card');
    if (!state.user) { card.innerHTML = '<p>Inicia sesión para ver tus clips.</p>'; return; }
    try {
      var data = await api('/api/clips');
      if (!data.clips.length) { card.innerHTML = '<p>Aún no has enviado clips. Elige una campaña y usa el botón "Enviar un clip".</p>'; return; }
      card.innerHTML = '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Campaña</th><th>URL</th><th>Estado</th><th>Vistas</th><th>Ganancia est.</th><th>Acreditado</th></tr></thead><tbody>' +
        data.clips.map(function (c) {
          return '<tr><td>' + esc(c.campaign_title) + '</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.url) + '</td><td>' + esc(statusLabel[c.status] || c.status) + '</td><td>' + Number(c.views || 0).toLocaleString('es') + '</td><td>' + estCell(c) + '</td><td>' + creditedCell(c.credited_cents) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    } catch (e) { card.innerHTML = '<p>No se pudieron cargar tus clips.</p>'; }
  }

  function fmtUSD(cents) { return 'US$' + (cents / 100).toFixed(2); }

  // Celda de ganancia estimada con color: siempre proporcional a las vistas;
  // amarillo si ya cumple el mínimo (pagable), rojo si aún no lo cumple.
  function estCell(c) {
    if (c.estimate_note) return '<span class="muted">' + esc(c.estimate_note) + '</span>';
    var tip = c.meets_minimum ? '' : ' title="Aún no alcanza el mínimo de ' + Number(c.min_views || 0).toLocaleString('es') + ' vistas"';
    return '<span class="' + (c.meets_minimum ? 'est-met' : 'est-below') + '"' + tip + '>' + fmtUSD(c.estimated_cents) + '</span>';
  }
  // Celda de monto acreditado: verde cuando es mayor a cero.
  function creditedCell(cents) {
    cents = cents || 0;
    return cents > 0 ? '<span class="credited-ok">' + fmtUSD(cents) + '</span>' : fmtUSD(0);
  }

  function txStatusLabel(t) {
    if (t.kind === 'payout') return 'Pagado';
    if (t.status === 'held') {
      var f = t.available_at ? new Date(t.available_at.replace(' ', 'T') + 'Z') : null;
      return 'Retenido' + (f ? ' · se libera el ' + f.toLocaleDateString('es', { day: 'numeric', month: 'short' }) : '');
    }
    return 'Disponible';
  }

  function txDetail(t) {
    var d = t.campaign_title ? esc(t.campaign_title) : '';
    if (t.note) d += (d ? ' — ' : '') + esc(t.note);
    if (t.kind === 'earning') return d || 'Ganancia';
    if (t.kind === 'payout') return d || 'Pago por PANA';
    return d || 'Ajuste';
  }

  async function loadWallet() {
    var card = $('wallet-card');
    if (!state.user) { card.innerHTML = '<p>Inicia sesión para ver tu billetera.</p>'; return; }
    try {
      var data = await api('/api/wallet');
      var w = data.wallet;
      var h = '<div class="stat-row">' +
        '<div class="stat-box"><strong>' + fmtUSD(w.available_cents) + '</strong><span>disponible</span></div>' +
        '<div class="stat-box"><strong>' + fmtUSD(w.held_cents) + '</strong><span>retenido (' + w.hold_days + ' días)</span></div>' +
        '<div class="stat-box"><strong>' + fmtUSD(w.earned_cents) + '</strong><span>total ganado</span></div>' +
        '<div class="stat-box"><strong class="est-met">' + fmtUSD(w.estimated_total_cents || 0) + '</strong><span>ganancia estimada</span></div>' +
        '<div class="stat-box"><strong>' + fmtUSD(w.paid_cents) + '</strong><span>total retirado</span></div></div>' +
        '<p class="muted">' + esc(w.note) + '</p>';

      h += '<div class="panel-card" style="margin:16px 0"><h3>Tu cuenta PANA</h3>' +
        (w.pana_account
          ? '<p>Recibes tus pagos en: <strong>' + esc(w.pana_account) + '</strong></p>'
          : '<p class="muted">Aún no registras tu cuenta. Sin esto no podemos enviarte pagos.</p>') +
        '<div class="field-row"><div class="field"><label for="pana-input">Cuenta PANA</label>' +
        '<input id="pana-input" type="text" maxlength="120" placeholder="Tu usuario o número PANA" value="' + esc(w.pana_account) + '"></div>' +
        '<div class="field" style="align-self:end"><button class="btn small accent" id="pana-save" type="button">Guardar</button></div></div>' +
        '<p id="pana-msg" class="muted"></p></div>';

      if (w.transactions.length) {
        h += '<h3>Movimientos</h3><div class="table-wrap"><table class="admin-table"><thead><tr><th>Fecha</th><th>Detalle</th><th>Monto</th><th>Estado</th></tr></thead><tbody>' +
          w.transactions.map(function (t) {
            var f = new Date(t.created_at.replace(' ', 'T') + 'Z').toLocaleDateString('es', { day: 'numeric', month: 'short' });
            var monto = (t.amount_cents > 0 ? '+' : '') + fmtUSD(t.amount_cents);
            return '<tr><td>' + f + '</td><td>' + txDetail(t) + '</td><td>' + monto + '</td><td>' + esc(txStatusLabel(t)) + '</td></tr>';
          }).join('') + '</tbody></table></div>';
      } else {
        h += '<p class="muted">Aún no tienes movimientos. Cuando Wilson registre tus ganancias aparecerán aquí.</p>';
      }

      h += '<p class="muted" style="margin-top:12px">' + w.approved_clips + ' clips aprobados · ' + w.total_views + ' vistas totales</p>';
      card.innerHTML = h;

      $('pana-save').addEventListener('click', async function () {
        var v = $('pana-input').value.trim();
        var msg = $('pana-msg');
        if (!v) { msg.textContent = 'Escribe tu cuenta PANA.'; return; }
        try {
          var r = await api('/api/wallet/pana', { method: 'PUT', body: JSON.stringify({ pana_account: v }) });
          msg.textContent = 'Cuenta guardada.';
          loadWallet();
        } catch (e) { msg.textContent = e.message; }
      });
    } catch (e) { card.innerHTML = '<p>No se pudo cargar tu billetera.</p>'; }
  }

  /* ---------------- Mis cuentas (vinculación) ---------------- */
  var accountStatusLabel = {
    pending: 'Pendiente de revisión',
    code_sent: 'Código enviado — pégalo en tu bio',
    code_confirmed: 'Código pegado — por verificar',
    verified: 'Verificada',
    rejected: 'Rechazada'
  };

  function accountBadgeClass(s) {
    if (s === 'verified') return 'badge real';
    if (s === 'rejected') return 'badge example';
    return 'badge';
  }

  async function loadAccounts() {
    var card = $('accounts-card');
    if (!state.user) { card.innerHTML = '<p>Inicia sesión para vincular tus cuentas.</p>'; return; }
    try {
      var data = await api('/api/accounts');
      var rows = data.accounts.map(function (a) {
        var plat = a.platform === 'tiktok' ? 'TikTok' : 'Instagram';
        var h = '<div class="account-row"><div class="account-top"><div><strong>' + plat +
          '</strong><br><a href="' + esc(a.profile_url) + '" target="_blank" rel="noopener" class="muted">' +
          esc(a.profile_url) + '</a></div>' +
          '<span class="' + accountBadgeClass(a.status) + '">' + esc(accountStatusLabel[a.status] || a.status) + '</span></div>';
        if (a.status === 'code_sent' && a.verification_code) {
          h += '<div class="code-box"><span>Pégalo en tu bio, guarda los cambios y confirma:</span>' +
            '<strong>' + esc(a.verification_code) + '</strong>' +
            '<button class="btn small accent" data-confirm="' + a.id + '" type="button">Ya lo pegué en mi bio</button></div>';
        }
        if (a.status === 'rejected' && a.admin_note) {
          h += '<p class="muted">' + esc(a.admin_note) + '</p>';
        }
        if (a.status !== 'verified') {
          h += '<div><button class="link-btn" data-delacc="' + a.id + '" type="button">Eliminar esta cuenta</button></div>';
        }
        return h + '</div>';
      }).join('');
      card.innerHTML =
        '<h3>Vincular una cuenta</h3>' +
        '<form id="account-form"><div class="form-grid">' +
        '<div class="field-row"><div class="field"><label for="acc-platform">Plataforma</label>' +
        '<select id="acc-platform"><option value="tiktok">TikTok</option><option value="instagram">Instagram</option></select></div>' +
        '<div class="field"><label for="acc-url">Link de tu perfil</label>' +
        '<input id="acc-url" type="url" placeholder="https://www.tiktok.com/@tuusuario" required /></div></div>' +
        '<p class="form-error" id="account-error"></p>' +
        '<button class="btn accent" type="submit">Registrar cuenta</button>' +
        '</div></form>' +
        '<h3 style="margin-top:24px">Tus cuentas</h3>' +
        (rows || '<p class="muted">Aún no has registrado cuentas.</p>') +
        '<p class="muted">Cuando registres tu cuenta, Wilson la vinculará y te enviará un código para pegar en tu bio. No borres el código de tu bio hasta que tu cuenta aparezca como «Verificada».</p>';

      $('account-form').addEventListener('submit', async function (ev) {
        ev.preventDefault();
        $('account-error').textContent = '';
        try {
          await api('/api/accounts', {
            method: 'POST',
            body: JSON.stringify({ platform: $('acc-platform').value, profile_url: $('acc-url').value.trim() })
          });
          loadAccounts();
          loadNotifications();
        } catch (e) { $('account-error').textContent = e.message; }
      });
      card.querySelectorAll('[data-confirm]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await api('/api/accounts/' + btn.getAttribute('data-confirm') + '/confirm-code', { method: 'POST' });
            loadAccounts();
            loadNotifications();
          } catch (e) { alert(e.message); }
        });
      });
      card.querySelectorAll('[data-delacc]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('¿Eliminar esta cuenta?')) return;
          try {
            await api('/api/accounts/' + btn.getAttribute('data-delacc'), { method: 'DELETE' });
            loadAccounts();
          } catch (e) { alert(e.message); }
        });
      });
    } catch (e) { card.innerHTML = '<p>No se pudieron cargar tus cuentas.</p>'; }
  }

  async function loadAdminAccounts(preserveInputs) {
    var tbody = $('admin-accounts-rows');
    if (!tbody) return;
    if (!state.user || state.user.role !== 'admin') {
      tbody.innerHTML = '<tr><td colspan="5">Sin permiso.</td></tr>';
      return;
    }
    // Guarda lo que el admin esté escribiendo para no borrarlo al refrescar.
    var typed = {};
    if (preserveInputs) {
      tbody.querySelectorAll('[data-code]').forEach(function (inp) {
        typed[inp.getAttribute('data-code')] = inp.value;
      });
    }
    try {
      var data = await api('/api/accounts/admin/all');
      if (!data.accounts.length) { tbody.innerHTML = '<tr><td colspan="5">Sin solicitudes de vinculación.</td></tr>'; return; }
      tbody.innerHTML = data.accounts.map(function (a) {
        var plat = a.platform === 'tiktok' ? 'TikTok' : 'Instagram';
        var actions = '';
        if (a.status === 'pending' || a.status === 'code_sent' || a.status === 'code_confirmed' || a.status === 'rejected') {
          actions += '<input class="code-input" data-code="' + a.id + '" placeholder="Código de la bio" value="' +
            esc(a.verification_code || '') + '" />' +
            '<button class="btn small" data-sendcode="' + a.id + '" type="button">Enviar código</button>';
        }
        if (a.status === 'code_sent' || a.status === 'code_confirmed') {
          actions += '<span class="muted">Código enviado: <strong>' + esc(a.verification_code || '—') + '</strong></span>';
        }
        if (a.status !== 'verified') {
          actions += '<button class="btn small accent" data-verify="' + a.id + '" type="button">Marcar verificada</button>';
        }
        actions += '<button class="btn small danger" data-reject="' + a.id + '" type="button">Rechazar</button>';
        return '<tr><td>' + esc(a.user_name) + '<br><span class="muted">' + esc(a.user_email) + '</span></td>' +
          '<td>' + plat + '</td>' +
          '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="' +
          esc(a.profile_url) + '" target="_blank" rel="noopener">' + esc(a.profile_url) + '</a></td>' +
          '<td><span class="' + accountBadgeClass(a.status) + '">' + esc(accountStatusLabel[a.status] || a.status) + '</span></td>' +
          '<td><div class="row-actions">' + actions + '</div></td></tr>';
      }).join('');
      // Restaura lo que el admin estaba escribiendo antes del refresco.
      tbody.querySelectorAll('[data-code]').forEach(function (inp) {
        var id = inp.getAttribute('data-code');
        if (typed[id] !== undefined && typed[id] !== inp.value) inp.value = typed[id];
      });
      tbody.querySelectorAll('[data-sendcode]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-sendcode');
          var input = tbody.querySelector('[data-code="' + id + '"]');
          var code = input ? input.value.trim() : '';
          if (!code) { alert('Escribe el código de verificación primero.'); return; }
          try {
            await api('/api/accounts/admin/' + id + '/send-code', { method: 'POST', body: JSON.stringify({ code: code }) });
            loadAdminAccounts();
            loadNotifications();
          } catch (e) { alert(e.message); }
        });
      });
      tbody.querySelectorAll('[data-verify]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('¿Confirmar que verificaste esta cuenta en la plataforma?')) return;
          try {
            await api('/api/accounts/admin/' + btn.getAttribute('data-verify') + '/verify', { method: 'POST' });
            loadAdminAccounts();
            loadNotifications();
          } catch (e) { alert(e.message); }
        });
      });
      tbody.querySelectorAll('[data-reject]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var note = prompt('Motivo del rechazo (opcional, lo verá el clipper):') || '';
          try {
            await api('/api/accounts/admin/' + btn.getAttribute('data-reject') + '/reject', { method: 'POST', body: JSON.stringify({ note: note }) });
            loadAdminAccounts();
            loadNotifications();
          } catch (e) { alert(e.message); }
        });
      });
    } catch (e) { tbody.innerHTML = '<tr><td colspan="5">No se pudieron cargar las cuentas.</td></tr>'; }
  }

  /* ---------------- Admin ---------------- */
  function openCampaignForm(c) {
    state.editingId = c ? c.id : null;
    $('campaign-form-title').textContent = c ? 'Editar campaña' : 'Nueva campaña';
    $('cf-title').value = c ? c.title : '';
    $('cf-artist').value = c ? c.artist : '';
    $('cf-platform').value = c ? c.platform : '';
    $('cf-category').value = c ? c.category : 'musica';
    $('cf-deadline').value = c && c.deadline ? c.deadline.slice(0, 10) : '';
    $('cf-payout').value = c ? c.payout_text : '';
    $('cf-source-per1k').value = c && c.source_per_1k ? c.source_per_1k : 0;
    $('cf-source-min').value = c && c.source_min_clip ? c.source_min_clip : 0;
    $('cf-source-max').value = c && c.source_max_clip ? c.source_max_clip : 0;
    $('cf-margin').value = c && c.margin_pct !== undefined && c.margin_pct !== null ? c.margin_pct : 50;
    $('cf-engagement').value = c && c.source_min_engagement ? c.source_min_engagement : 0;
    $('cf-budget-total').value = c ? c.budget_total : 0;
    $('cf-budget-remaining').value = c ? c.budget_remaining : 0;
    $('cf-requirements').value = c ? c.requirements : '';
    $('cf-brief').value = c ? c.brief : '';
    $('cf-status').value = c ? c.status : 'active';
    $('cf-example').checked = c ? !!c.is_example : false;
    $('campaign-error').textContent = '';
    updateClipperPreview();
    $('campaign-dialog').showModal();
  }

  // Vista previa en vivo de la tarifa que verá el clipper.
  function updateClipperPreview() {
    var per1k = Number($('cf-source-per1k').value) || 0;
    var min = Number($('cf-source-min').value) || 0;
    var max = Number($('cf-source-max').value) || 0;
    var margin = Math.min(100, Math.max(0, Number($('cf-margin').value) || 0));
    var el = $('cf-clipper-preview');
    if (!el) return;
    if (per1k > 0) {
      var f = (100 - margin) / 100;
      var t = 'US$' + (per1k * f).toFixed(2) + ' por cada 1.000 vistas';
      if (min > 0 || max > 0) {
        t += ' (mín. US$' + (min * f).toFixed(2) + '/clip · máx. US$' + (max * f).toFixed(2) + '/clip)';
      }
      el.textContent = t;
    } else {
      el.textContent = 'Se usará el texto de pago manual.';
    }
  }
  ['cf-source-per1k', 'cf-source-min', 'cf-source-max', 'cf-margin'].forEach(function (id) {
    var el = $(id);
    if (el) el.addEventListener('input', updateClipperPreview);
  });
  $('campaign-new').addEventListener('click', function () { openCampaignForm(null); });
  $('campaign-close').addEventListener('click', function () { $('campaign-dialog').close(); });

  $('campaign-form').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    $('campaign-error').textContent = '';
    var payload = {
      title: $('cf-title').value.trim(),
      artist: $('cf-artist').value.trim(),
      platform: $('cf-platform').value.trim(),
      category: $('cf-category').value,
      deadline: $('cf-deadline').value,
      payout_text: $('cf-payout').value.trim(),
      source_per_1k: Number($('cf-source-per1k').value) || 0,
      source_min_clip: Number($('cf-source-min').value) || 0,
      source_max_clip: Number($('cf-source-max').value) || 0,
      margin_pct: $('cf-margin').value === '' ? 50 : Number($('cf-margin').value),
      source_min_engagement: Number($('cf-engagement').value) || 0,
      budget_total: Number($('cf-budget-total').value) || 0,
      budget_remaining: Number($('cf-budget-remaining').value) || 0,
      requirements: $('cf-requirements').value.trim(),
      brief: $('cf-brief').value.trim(),
      status: $('cf-status').value,
      is_example: $('cf-example').checked
    };
    try {
      if (state.editingId) {
        await api('/api/campaigns/' + state.editingId, { method: 'PUT', body: JSON.stringify(payload) });
      } else {
        await api('/api/campaigns', { method: 'POST', body: JSON.stringify(payload) });
      }
      $('campaign-dialog').close();
      await loadCampaigns();
      loadAdminTable();
    } catch (e) {
      $('campaign-error').textContent = e.message;
    }
  });

  /* ---------------- Importar campañas ---------------- */
  var importBtn = $('import-run');
  if (importBtn) {
    importBtn.addEventListener('click', async function () {
      var msg = $('import-msg');
      msg.textContent = '';
      var raw = $('import-json').value.trim();
      if (!raw) { msg.textContent = 'Pega primero el JSON de campañas.'; return; }
      var list;
      try {
        list = JSON.parse(raw);
        if (!Array.isArray(list)) list = [list];
      } catch (e) { msg.textContent = 'El JSON no es válido: ' + e.message; return; }
      msg.textContent = 'Importando ' + list.length + ' campañas…';
      try {
        var r = await api('/api/campaigns/admin/import', { method: 'POST', body: JSON.stringify({ campaigns: list }) });
        var t = 'Listo: ' + r.inserted + ' nuevas, ' + r.updated + ' actualizadas.';
        if (r.errors && r.errors.length) t += ' Errores: ' + r.errors.map(function (e) { return e.title; }).join(', ');
        msg.textContent = t;
        $('import-json').value = '';
        loadAdminTable();
      } catch (e) { msg.textContent = e.message; }
    });
  }

  /* ---------------- Clips admin (fase 4) ---------------- */
  function fmtDateShort(iso) {
    try { return new Date(iso.replace(' ', 'T') + 'Z').toLocaleDateString('es', { day: 'numeric', month: 'short' }); }
    catch (e) { return ''; }
  }

  async function loadAdminClips() {
    var tbodyR = $('admin-clips-review');
    var tbodyA = $('admin-clips-approved');
    if (!tbodyR || !tbodyA) return;
    if (!state.user || state.user.role !== 'admin') {
      tbodyR.innerHTML = '<tr><td colspan="7">Sin permiso.</td></tr>';
      tbodyA.innerHTML = '<tr><td colspan="6">Sin permiso.</td></tr>';
      return;
    }
    try {
      var rev = await api('/api/clips/admin/review');
      tbodyR.innerHTML = rev.clips.map(function (c) {
        return '<tr><td>' + esc(c.clipper_name) + '</td><td>' + esc(c.campaign_title) + '</td>' +
          '<td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="' + esc(c.url) + '" target="_blank" rel="noopener" class="muted">' + esc(c.url) + '</a></td>' +
          '<td><div class="row-actions"><input class="code-input" style="max-width:110px" type="number" min="0" step="1" value="' + c.views + '" data-views="' + c.id + '">' +
          '<button class="btn small" data-saveviews="' + c.id + '" type="button">Guardar</button></div></td><td>' + estCell(c) + '</td>' +
          '<td>' + fmtDateShort(c.created_at) + '</td>' +
          '<td><div class="row-actions"><button class="btn small accent" data-approve="' + c.id + '" type="button">Aprobar</button>' +
          '<button class="btn small ghost" data-reject="' + c.id + '" type="button">Rechazar</button></div></td></tr>';
      }).join('') || '<tr><td colspan="7">No hay clips pendientes.</td></tr>';
    } catch (e) { tbodyR.innerHTML = '<tr><td colspan="7">No se pudo cargar.</td></tr>'; }

    try {
      var ap = await api('/api/clips/admin/approved');
      tbodyA.innerHTML = ap.clips.map(function (c) {
        var creditCell;
        if (c.suggested_cents > 0) {
          creditCell = '<button class="btn small accent" data-credit="' + c.id + '" type="button">Acreditar ' + fmtUSD(c.suggested_cents) + '</button>';
        } else {
          creditCell = '<span class="muted">' + esc(c.suggest_text) + '</span>';
        }
        return '<tr><td>' + esc(c.clipper_name) + '</td><td>' + esc(c.campaign_title) + '</td>' +
          '<td><div class="row-actions"><input class="code-input" style="max-width:110px" type="number" min="0" step="1" value="' + c.views + '" data-views="' + c.id + '">' +
          '<button class="btn small" data-saveviews="' + c.id + '" type="button">Guardar</button></div></td>' +
          '<td>' + estCell(c) + '</td>' +
          '<td>' + creditedCell(c.credited_cents) + '</td><td>' + creditCell + '</td></tr>';
      }).join('') || '<tr><td colspan="6">No hay clips aprobados.</td></tr>';
    } catch (e) { tbodyA.innerHTML = '<tr><td colspan="6">No se pudo cargar.</td></tr>'; }
  }

  document.addEventListener('click', async function (ev) {
    var t = ev.target;
    if (!(t instanceof HTMLElement)) return;
    var msg;
    if (t.hasAttribute('data-approve')) {
      msg = $('review-msg'); msg.textContent = '';
      try {
        await api('/api/clips/admin/' + t.getAttribute('data-approve') + '/approve', { method: 'POST' });
        loadAdminClips();
      } catch (e) { msg.textContent = e.message; }
    } else if (t.hasAttribute('data-reject')) {
      var motivo = prompt('Motivo del rechazo (lo verá el clipper):') || '';
      msg = $('review-msg'); msg.textContent = '';
      try {
        await api('/api/clips/admin/' + t.getAttribute('data-reject') + '/reject', { method: 'POST', body: JSON.stringify({ note: motivo }) });
        loadAdminClips();
      } catch (e) { msg.textContent = e.message; }
    } else if (t.hasAttribute('data-saveviews')) {
      var id = t.getAttribute('data-saveviews');
      var input = document.querySelector('input[data-views="' + id + '"]');
      msg = t.closest('tbody') && t.closest('tbody').id === 'admin-clips-review' ? $('review-msg') : $('credit-msg');
      msg.textContent = '';
      try {
        await api('/api/clips/admin/' + id + '/views', { method: 'POST', body: JSON.stringify({ views: Number(input.value) }) });
        msg.textContent = 'Vistas actualizadas.';
        loadAdminClips();
      } catch (e) { msg.textContent = e.message; }
    } else if (t.hasAttribute('data-credit')) {
      var cid = t.getAttribute('data-credit');
      msg = $('credit-msg'); msg.textContent = '';
      if (!confirm('¿Acreditar la ganancia sugerida a la billetera del clipper (retenida 14 días)?')) return;
      try {
        var r = await api('/api/clips/admin/' + cid + '/credit', { method: 'POST', body: JSON.stringify({}) });
        msg.textContent = 'Acreditado: ' + fmtUSD(r.cents) + '.';
        loadAdminClips(); loadAdminWallet();
      } catch (e) { msg.textContent = e.message; }
    }
  });

  /* ---------------- Billetera admin ---------------- */
  async function loadAdminWallet() {
    var tbody = $('admin-wallet-rows');
    if (!tbody) return;
    if (!state.user || state.user.role !== 'admin') {
      tbody.innerHTML = '<tr><td colspan="6">Sin permiso.</td></tr>';
      return;
    }
    try {
      var data = await api('/api/wallet/admin/users');
      var sel = $('wallet-user');
      var current = sel.value;
      sel.innerHTML = data.users.map(function (u) {
        return '<option value="' + u.id + '">' + esc(u.name) + ' (' + esc(u.email) + ')</option>';
      }).join('') || '<option value="">Sin clippers</option>';
      if (current) sel.value = current;
      tbody.innerHTML = data.users.map(function (u) {
        return '<tr><td>' + esc(u.name) + '<br><span class="muted">' + esc(u.email) + '</span></td>' +
          '<td>' + (u.pana_account ? esc(u.pana_account) : '<span class="muted">sin registrar</span>') + '</td>' +
          '<td>' + fmtUSD(u.available_cents) + '</td>' +
          '<td>' + fmtUSD(u.held_cents) + '</td>' +
          '<td>' + fmtUSD(u.earned_cents) + '</td>' +
          '<td>' + fmtUSD(u.paid_cents) + '</td></tr>';
      }).join('') || '<tr><td colspan="6">Sin clippers registrados.</td></tr>';
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="6">No se pudo cargar.</td></tr>';
    }
  }

  async function walletAdminAction(endpoint, okMsg) {
    var msg = $('wallet-msg');
    var userId = Number($('wallet-user').value);
    var amount = $('wallet-amount').value;
    var concept = $('wallet-concept').value.trim();
    msg.textContent = '';
    if (!userId) { msg.textContent = 'Elige un clipper.'; return; }
    if (endpoint !== 'adjust' && !(Number(amount) > 0)) { msg.textContent = 'Escribe un monto mayor a 0.'; return; }
    var body = { user_id: userId, amount: Number(amount), note: '' };
    if (endpoint === 'credit') body.campaign_title = concept;
    else body.note = concept;
    try {
      await api('/api/wallet/admin/' + endpoint, { method: 'POST', body: JSON.stringify(body) });
      msg.textContent = okMsg;
      $('wallet-amount').value = '';
      $('wallet-concept').value = '';
      loadAdminWallet();
    } catch (e) { msg.textContent = e.message; }
  }

  var wcBtn = $('wallet-credit');
  if (wcBtn) {
    wcBtn.addEventListener('click', function () { walletAdminAction('credit', 'Ganancia registrada (retenida 14 días).'); });
    $('wallet-payout').addEventListener('click', function () { walletAdminAction('payout', 'Pago PANA registrado.'); });
    $('wallet-adjust').addEventListener('click', function () { walletAdminAction('adjust', 'Ajuste aplicado.'); });
  }

  async function loadAdminTable() {
    var tbody = $('admin-campaign-rows');
    if (!state.user || state.user.role !== 'admin') {
      tbody.innerHTML = '<tr><td colspan="5">Sin permiso.</td></tr>';
      return;
    }
    await loadCampaigns();
    // Lista del admin: incluye tarifa fuente y margen (nunca visible al público).
    var adminList = state.campaigns;
    try {
      var adminData = await api('/api/campaigns/admin/all');
      adminList = adminData.campaigns;
    } catch (e) { /* sin acceso: se usa la lista pública */ }
    tbody.innerHTML = adminList.map(function (c) {
      return '<tr><td>' + esc(c.title) + (c.is_example ? ' <span class="badge example">EJEMPLO</span>' : '') +
        (c.clipper_preview ? '<br><span class="muted">Clipper ve: ' + esc(c.clipper_preview) + '</span>' : '') + '</td>' +
        '<td>' + esc(c.platform || '—') + '</td>' +
        '<td>' + (c.status === 'active' ? 'Activa' : 'Inactiva') + '</td>' +
        '<td>US$ ' + esc(c.budget_remaining) + ' / US$ ' + esc(c.budget_total) + '</td>' +
        '<td><div class="row-actions">' +
        '<button class="btn small ghost" data-edit="' + c.id + '">Editar</button>' +
        '<button class="btn small danger" data-del="' + c.id + '">Eliminar</button>' +
        '</div></td></tr>';
    }).join('');
    tbody.querySelectorAll('[data-edit]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var c = adminList.find(function (x) { return x.id === Number(btn.getAttribute('data-edit')); });
        openCampaignForm(c);
      });
    });
    tbody.querySelectorAll('[data-del]').forEach(function (btn) {
      btn.addEventListener('click', async function () {
        if (!confirm('¿Eliminar esta campaña? Esta acción no se puede deshacer.')) return;
        try {
          await api('/api/campaigns/' + btn.getAttribute('data-del'), { method: 'DELETE' });
          await loadCampaigns();
          loadAdminTable();
        } catch (e) { alert(e.message); }
      });
    });
  }

  /* ---------------- Respaldo (admin) ---------------- */
  $('backup-download').addEventListener('click', function () {
    window.location.href = '/api/admin/backup';
  });
  $('backup-file').addEventListener('change', async function () {
    var f = $('backup-file').files[0];
    if (!f) return;
    if (!confirm('¿Restaurar este respaldo? Se reemplazarán los datos actuales. Después deberás reiniciar el servicio en Railway.')) {
      $('backup-file').value = '';
      return;
    }
    $('backup-msg').textContent = 'Subiendo respaldo…';
    try {
      var r = await fetch('/api/admin/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: f
      });
      var data = await r.json();
      if (!r.ok) throw new Error(data.error || 'Error al restaurar.');
      $('backup-msg').textContent = data.message;
    } catch (e) {
      $('backup-msg').textContent = e.message;
    }
    $('backup-file').value = '';
  });

  /* ---------------- Login con Google ---------------- */
  // Usa Google Identity Services (estándar actual). El botón oficial de Google
  // genera un ID token que el servidor verifica con la librería oficial.
  async function initGoogleLogin() {
    var wrap = $('google-btn-wrap');
    try {
      if (!wrap || typeof google === 'undefined' || !google.accounts || !google.accounts.id) return;
      var cfg = await api('/api/auth/google-client-id');
      if (!cfg.clientId) return; // aún sin configurar en el servidor
      google.accounts.id.initialize({
        client_id: cfg.clientId,
        callback: async function (resp) {
          $('google-error').textContent = '';
          try {
            var data = await api('/api/auth/google', {
              method: 'POST',
              body: JSON.stringify({ credential: resp.credential })
            });
            $('auth-dialog').close();
            setUser(data.user);
          } catch (e) {
            $('google-error').textContent = e.message;
          }
        }
      });
      google.accounts.id.renderButton($('google-btn'), {
        theme: 'outline',
        size: 'large',
        width: 300,
        text: 'continue_with',
        locale: 'es'
      });
      wrap.hidden = false;
    } catch (e) {
      if (wrap) wrap.hidden = true;
    }
  }
  // La librería de Google la llama al cargarse (onload en index.html).
  window.initGoogleLogin = initGoogleLogin;

  /* ---------------- Init ---------------- */
  loadCampaigns();
  checkSession();
})();
