// PWA de Clippers Pro: registra el service worker y, cuando detecta que la
// visita es desde un celular y la app aún no está instalada, muestra la
// opción de instalarla (botón directo en Android/Chrome; instrucciones en
// iPhone, donde el navegador no permite el botón directo).
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('/sw.js').catch(function () {});
    });
  }

  var isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;
  if (isStandalone) return; // ya instalada: no se ofrece nada

  var ua = navigator.userAgent || '';
  var isIOS = /iphone|ipad|ipod/i.test(ua);
  var isAndroid = /android/i.test(ua);
  var isMobile = isIOS || isAndroid || (navigator.maxTouchPoints > 1 && screen.width < 1024);
  if (!isMobile) return; // en computadora no se muestra la opción

  var DISMISS_KEY = 'cp_install_dismissed';
  try {
    var last = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (Date.now() - last < 3 * 24 * 3600 * 1000) return; // no insistir por 3 días
  } catch (e) {}

  var deferredPrompt = null;
  var banner = null;

  var style = document.createElement('style');
  style.textContent =
    '#cp-install{position:fixed;left:12px;right:12px;bottom:12px;z-index:9999;display:flex;align-items:center;gap:12px;' +
    'background:#0c2321;border:1px solid #2dd4bf66;border-radius:14px;padding:12px 14px;box-shadow:0 10px 30px rgba(0,0,0,.45);' +
    'color:#e6fffb;font-family:Inter,system-ui,sans-serif;animation:cpup .3s ease}' +
    '@keyframes cpup{from{transform:translateY(16px);opacity:0}to{transform:none;opacity:1}}' +
    '#cp-install img{width:42px;height:42px;border-radius:10px;flex:none}' +
    '#cp-install .cp-txt{flex:1;font-size:13.5px;line-height:1.35}' +
    '#cp-install .cp-txt strong{display:block;font-size:14.5px}' +
    '#cp-install .cp-btn{background:#2dd4bf;color:#04211d;border:none;border-radius:10px;padding:10px 14px;font-weight:800;cursor:pointer;flex:none}' +
    '#cp-install .cp-x{background:none;border:none;color:#8fbdb5;font-size:18px;cursor:pointer;flex:none;padding:2px 4px}';
  document.head.appendChild(style);

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
    hide();
  }
  function hide() {
    if (banner) { banner.remove(); banner = null; }
  }

  function show(html, btnLabel, onBtn) {
    if (banner) return;
    banner = document.createElement('div');
    banner.id = 'cp-install';
    banner.innerHTML =
      '<img src="/icons/icon-192.png" alt="">' +
      '<div class="cp-txt">' + html + '</div>' +
      '<button class="cp-btn" type="button">' + btnLabel + '</button>' +
      '<button class="cp-x" type="button" aria-label="Cerrar">✕</button>';
    banner.querySelector('.cp-x').addEventListener('click', dismiss);
    banner.querySelector('.cp-btn').addEventListener('click', onBtn);
    document.body.appendChild(banner);
  }

  window.addEventListener('beforeinstallprompt', function (e) {
    e.preventDefault();
    deferredPrompt = e;
    show('<strong>Instala Clippers Pro</strong>Ten la app en tu pantalla de inicio: abre al instante, a pantalla completa.', 'Instalar', function () {
      if (!deferredPrompt) return dismiss();
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function () {
        deferredPrompt = null;
        hide();
      });
    });
  });

  window.addEventListener('appinstalled', hide);

  if (isIOS) {
    setTimeout(function () {
      show('<strong>Instala Clippers Pro</strong>Toca <b>Compartir</b> (el cuadro con la flecha ↑) y luego <b>«Agregar a pantalla de inicio»</b>.', 'Entendido', dismiss);
    }, 1500);
  } else if (isAndroid) {
    // Navegadores Android sin aviso automático (ej.: Firefox): se muestra la
    // ruta manual por el menú del navegador.
    setTimeout(function () {
      if (!deferredPrompt && !banner) {
        show('<strong>Instala Clippers Pro</strong>Abre el menú <b>⋮</b> de tu navegador y toca <b>«Instalar app»</b> o <b>«Agregar a pantalla de inicio»</b>.', 'Entendido', dismiss);
      }
    }, 3500);
  }
})();

// ---------- Suscripción a avisos push del celular ----------
// Funciona también (y sobre todo) con la app ya instalada. El botón
// #push-enable-btn vive en el panel de notificaciones de la app.
(function () {
  var btn = null;

  function urlBase64ToUint8Array(base64String) {
    var padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    var base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    var raw = atob(base64);
    var arr = new Uint8Array(raw.length);
    for (var i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
    return arr;
  }

  function supported() {
    return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
  }

  async function apiKey() {
    var r = await fetch('/api/push/key');
    if (!r.ok) return '';
    var d = await r.json().catch(function () { return {}; });
    return d.key || '';
  }

  async function currentSub() {
    var reg = await navigator.serviceWorker.ready;
    return reg.pushManager.getSubscription();
  }

  async function paint() {
    if (!btn) return;
    if (!supported()) { btn.hidden = true; return; }
    var key = await apiKey().catch(function () { return ''; });
    if (!key) { btn.hidden = true; return; } // servidor sin llaves: no se ofrece
    if (Notification.permission === 'denied') {
      btn.hidden = false;
      btn.disabled = true;
      btn.textContent = '🔕 Avisos bloqueados: actívalos en los ajustes de tu navegador';
      return;
    }
    var sub = await currentSub().catch(function () { return null; });
    btn.hidden = false;
    btn.disabled = false;
    btn.textContent = sub ? '🔔 Avisos activos en este celular (toca para desactivar)' : '🔔 Activar avisos en este celular';
    btn.dataset.on = sub ? '1' : '';
  }

  async function enable() {
    var key = await apiKey();
    if (!key) return;
    var perm = await Notification.requestPermission();
    if (perm !== 'granted') { paint(); return; }
    var reg = await navigator.serviceWorker.ready;
    var sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(key),
    });
    await fetch('/api/push/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ subscription: sub.toJSON() }),
    });
    paint();
  }

  async function disable() {
    var sub = await currentSub();
    if (sub) {
      await fetch('/api/push/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint: sub.endpoint }),
      }).catch(function () {});
      await sub.unsubscribe().catch(function () {});
    }
    paint();
  }

  async function boot() {
    btn = document.getElementById('push-enable-btn');
    if (!btn || !supported()) return;
    btn.addEventListener('click', function () {
      if (btn.dataset.on) disable(); else enable();
    });
    // Si el permiso ya estaba dado, se renueva la suscripción en silencio
    // (los navegadores rotan los endpoints de vez en cuando).
    if (Notification.permission === 'granted') {
      try {
        var key = await apiKey();
        if (key) {
          var reg = await navigator.serviceWorker.ready;
          var sub = await reg.pushManager.getSubscription();
          if (!sub) {
            sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: urlBase64ToUint8Array(key),
            });
          }
          await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ subscription: sub.toJSON() }),
          });
        }
      } catch (e) { /* sin sesión o sin red: se reintenta en la próxima visita */ }
    }
    paint();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
