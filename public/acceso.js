// Página de acceso partida (/acceso): marca a la izquierda y, a la derecha,
// iniciar sesión / crear cuenta con correo o con Google. Al entrar, el
// servidor ya sirve la app completa en / (o el envío pendiente del brief).
(function () {
  function $(id) { return document.getElementById(id); }
  var params = new URLSearchParams(window.location.search);
  var submitId = Number(params.get('submit')) || null;
  var mode = params.get('modo') === 'registro' ? 'register' : 'login';

  function destination() {
    if (submitId) return '/?submit=' + submitId;
    // Si la puerta se mostró sobre la URL de un brief (/campana/<id>), tras
    // entrar se vuelve a ese brief.
    var m = window.location.pathname.match(/^\/campana\/(\d+)$/);
    if (m) return '/campana/' + m[1];
    return '/';
  }

  async function api(path, opts) {
    var r = await fetch(path, Object.assign({ headers: { 'Content-Type': 'application/json' } }, opts || {}));
    var data = await r.json().catch(function () { return {}; });
    if (!r.ok) throw new Error(data.error || 'Algo salió mal. Inténtalo de nuevo.');
    return data;
  }

  // Si ya hay sesión, directo a la app.
  api('/api/auth/me')
    .then(function () { window.location.replace(destination()); })
    .catch(function () { /* sin sesión: se muestra el formulario */ });

  function setMode(m) {
    mode = m;
    $('tab-login').classList.toggle('active', m === 'login');
    $('tab-register').classList.toggle('active', m === 'register');
    $('acc-name-field').hidden = m !== 'register';
    $('acc-title').textContent = m === 'login' ? 'Bienvenido de nuevo' : 'Crea tu cuenta';
    $('acc-sub').textContent = m === 'login'
      ? 'Entra a tu cuenta para seguir creando clips.'
      : 'Regístrate y entra a ver las campañas activas de hoy.';
    $('acc-submit').textContent = m === 'login' ? 'Entrar con correo' : 'Crear cuenta';
    $('acc-password').setAttribute('autocomplete', m === 'login' ? 'current-password' : 'new-password');
    $('acc-switch-login').hidden = m !== 'register';
    $('acc-switch-register').hidden = m !== 'login';
    $('acc-error').textContent = '';
  }
  $('tab-login').addEventListener('click', function () { setMode('login'); });
  $('tab-register').addEventListener('click', function () { setMode('register'); });
  document.querySelectorAll('[data-switch]').forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.getAttribute('data-switch')); });
  });
  setMode(mode);

  $('acc-form').addEventListener('submit', async function (ev) {
    ev.preventDefault();
    $('acc-error').textContent = '';
    var payload = {
      email: $('acc-email').value.trim(),
      password: $('acc-password').value,
    };
    if (mode === 'register') payload.name = $('acc-name').value.trim();
    try {
      await api('/api/auth/' + mode, { method: 'POST', body: JSON.stringify(payload) });
      window.location.replace(destination());
    } catch (e) {
      $('acc-error').textContent = e.message;
    }
  });

  // Contador en vivo del panel izquierdo (solo el número, como en la landing).
  fetch('/api/campaigns')
    .then(function (r) { return r.json(); })
    .then(function (d) {
      var n = typeof d.count === 'number'
        ? d.count
        : (d.campaigns || []).filter(function (c) { return !c.is_example; }).length;
      $('acc-count').textContent = n;
    })
    .catch(function () { $('acc-count').textContent = '—'; });

  // Botón de Google (mismo flujo que el de la app).
  window.initGoogleAcceso = async function () {
    try {
      if (typeof google === 'undefined' || !google.accounts || !google.accounts.id) return;
      var cfg = await api('/api/auth/google-client-id');
      if (!cfg.clientId) return;
      google.accounts.id.initialize({
        client_id: cfg.clientId,
        callback: async function (resp) {
          $('google-error').textContent = '';
          try {
            await api('/api/auth/google', {
              method: 'POST',
              body: JSON.stringify({ credential: resp.credential }),
            });
            window.location.replace(destination());
          } catch (e) {
            $('google-error').textContent = e.message;
          }
        },
      });
      google.accounts.id.renderButton($('google-btn'), {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        locale: 'es',
        width: 320,
      });
    } catch (e) { /* el botón simplemente no se muestra */ }
  };
})();
