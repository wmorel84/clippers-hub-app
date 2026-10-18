/* Hub de Wilson — lógica del frontend */
(function () {
  'use strict';

  var state = { user: null, campaigns: [], filter: 'all', query: '', editingId: null };

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
    if (page === 'admin') { loadAdminTable(); loadAdminAccounts(); }
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
        '<span class="platform-tag">' + esc(c.platform || '') + '</span></div>' +
        '<h3>' + esc(c.title) + '</h3>' +
        (c.artist ? '<p class="artist">' + esc(c.artist) + '</p>' : '') +
        (c.payout_text ? '<p class="pay">' + esc(c.payout_text) + '</p>' : '') +
        budgetHtml(c) +
        '<div class="card-actions"><button class="btn small" data-detail="' + c.id + '">Ver brief</button></div>';
      grid.appendChild(card);
    });
    grid.querySelectorAll('[data-detail]').forEach(function (btn) {
      btn.addEventListener('click', function () { openDetail(Number(btn.getAttribute('data-detail'))); });
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
      renderNotifications(data.notifications, data.unread);
    } catch (e) { renderNotifications([], 0); }
  }

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
  $('sb-submit').addEventListener('click', function () {
    $('submit-error').textContent = '';
    $('submit-ok').hidden = true;
    var loggedIn = !!state.user;
    $('submit-logged-out').hidden = loggedIn;
    $('submit-form').hidden = !loggedIn;
    if (loggedIn) {
      var sel = $('submit-campaign');
      sel.innerHTML = state.campaigns.filter(function (c) { return !c.is_example; }).map(function (c) {
        return '<option value="' + c.id + '">' + esc(c.title) + '</option>';
      }).join('') || '<option value="">Sin campañas reales disponibles</option>';
    }
    $('submit-dialog').showModal();
  });
  $('close-submit').addEventListener('click', function () { $('submit-dialog').close(); });
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
      card.innerHTML = '<div class="table-wrap"><table class="admin-table"><thead><tr><th>Campaña</th><th>URL</th><th>Estado</th><th>Vistas</th></tr></thead><tbody>' +
        data.clips.map(function (c) {
          return '<tr><td>' + esc(c.campaign_title) + '</td><td style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">' + esc(c.url) + '</td><td>' + esc(statusLabel[c.status] || c.status) + '</td><td>' + esc(c.views) + '</td></tr>';
        }).join('') + '</tbody></table></div>';
    } catch (e) { card.innerHTML = '<p>No se pudieron cargar tus clips.</p>'; }
  }

  async function loadWallet() {
    var card = $('wallet-card');
    if (!state.user) { card.innerHTML = '<p>Inicia sesión para ver tu billetera.</p>'; return; }
    try {
      var data = await api('/api/wallet');
      var w = data.wallet;
      card.innerHTML = '<div class="stat-row">' +
        '<div class="stat-box"><strong>' + w.total_clips + '</strong><span>clips enviados</span></div>' +
        '<div class="stat-box"><strong>' + w.approved_clips + '</strong><span>clips aprobados</span></div>' +
        '<div class="stat-box"><strong>' + w.pending_clips + '</strong><span>en revisión</span></div>' +
        '<div class="stat-box"><strong>' + w.total_views + '</strong><span>vistas totales</span></div></div>' +
        '<p>' + esc(w.note) + '</p>';
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
          h += '<div class="code-box"><span>Wilson te envió este código. Pégalo en tu bio y confirma:</span>' +
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
        } catch (e) { $('account-error').textContent = e.message; }
      });
      card.querySelectorAll('[data-confirm]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          try {
            await api('/api/accounts/' + btn.getAttribute('data-confirm') + '/confirm-code', { method: 'POST' });
            loadAccounts();
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

  async function loadAdminAccounts() {
    var tbody = $('admin-accounts-rows');
    if (!tbody) return;
    if (!state.user || state.user.role !== 'admin') {
      tbody.innerHTML = '<tr><td colspan="5">Sin permiso.</td></tr>';
      return;
    }
    try {
      var data = await api('/api/accounts/admin/all');
      if (!data.accounts.length) { tbody.innerHTML = '<tr><td colspan="5">Sin solicitudes de vinculación.</td></tr>'; return; }
      tbody.innerHTML = data.accounts.map(function (a) {
        var plat = a.platform === 'tiktok' ? 'TikTok' : 'Instagram';
        var actions = '';
        if (a.status === 'pending' || a.status === 'code_confirmed' || a.status === 'rejected') {
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
      tbody.querySelectorAll('[data-sendcode]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var id = btn.getAttribute('data-sendcode');
          var input = tbody.querySelector('[data-code="' + id + '"]');
          var code = input ? input.value.trim() : '';
          if (!code) { alert('Escribe el código de verificación primero.'); return; }
          try {
            await api('/api/accounts/admin/' + id + '/send-code', { method: 'POST', body: JSON.stringify({ code: code }) });
            loadAdminAccounts();
          } catch (e) { alert(e.message); }
        });
      });
      tbody.querySelectorAll('[data-verify]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          if (!confirm('¿Confirmar que verificaste esta cuenta en la plataforma?')) return;
          try {
            await api('/api/accounts/admin/' + btn.getAttribute('data-verify') + '/verify', { method: 'POST' });
            loadAdminAccounts();
          } catch (e) { alert(e.message); }
        });
      });
      tbody.querySelectorAll('[data-reject]').forEach(function (btn) {
        btn.addEventListener('click', async function () {
          var note = prompt('Motivo del rechazo (opcional, lo verá el clipper):') || '';
          try {
            await api('/api/accounts/admin/' + btn.getAttribute('data-reject') + '/reject', { method: 'POST', body: JSON.stringify({ note: note }) });
            loadAdminAccounts();
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
    $('cf-budget-total').value = c ? c.budget_total : 0;
    $('cf-budget-remaining').value = c ? c.budget_remaining : 0;
    $('cf-requirements').value = c ? c.requirements : '';
    $('cf-brief').value = c ? c.brief : '';
    $('cf-status').value = c ? c.status : 'active';
    $('cf-example').checked = c ? !!c.is_example : false;
    $('campaign-error').textContent = '';
    $('campaign-dialog').showModal();
  }
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

  async function loadAdminTable() {
    var tbody = $('admin-campaign-rows');
    if (!state.user || state.user.role !== 'admin') {
      tbody.innerHTML = '<tr><td colspan="5">Sin permiso.</td></tr>';
      return;
    }
    await loadCampaigns();
    tbody.innerHTML = state.campaigns.map(function (c) {
      return '<tr><td>' + esc(c.title) + (c.is_example ? ' <span class="badge example">EJEMPLO</span>' : '') + '</td>' +
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
        var c = state.campaigns.find(function (x) { return x.id === Number(btn.getAttribute('data-edit')); });
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
