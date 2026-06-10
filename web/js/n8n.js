/**
 * n8n.js — Módulo de conexión con n8n
 *
 * Aquí se gestiona toda la comunicación con n8n local.
 * Para conectar, abre la pantalla de Configuración de la app,
 * introduce la URL base de n8n y pulsa «Verificar». La configuración
 * (URL base + paths de webhooks) se persiste en localStorage.
 *
 * Si n8n no está conectado, la app funciona en «modo demo»: las
 * acciones de los módulos se simulan con datos de ejemplo.
 */

const N8N = (() => {

  // ── Estado de conexión ───────────────────────
  let state = {
    connected: false,
    baseUrl:   '',
    webhooks:  {
      'catering':      '/webhook/catering-assign',
      'guardias-send': '/webhook/guardias-run',
      'software':      '/webhook/software-assign',
    }
  };

  // ── Cargar configuración guardada ───────────
  function loadSaved() {
    try {
      const saved = localStorage.getItem('smartassign-n8n');
      if (saved) {
        const parsed = JSON.parse(saved);
        state = { ...state, ...parsed };
        if (state.baseUrl) {
          document.getElementById('n8n-base-url').value = state.baseUrl;
          fillWebhookInputs();
        }
      }
    } catch (e) {
      console.warn('[N8N] No se pudo cargar la configuración guardada:', e);
    }
  }

  // ── Guardar configuración ───────────────────
  function saveToStorage() {
    try {
      localStorage.setItem('smartassign-n8n', JSON.stringify(state));
    } catch (e) {
      console.warn('[N8N] No se pudo guardar la configuración:', e);
    }
  }

  // ── Rellenar inputs con los webhooks ────────
  function fillWebhookInputs() {
    const map = {
      'wh-catering':      'catering',
      'wh-guardias-send': 'guardias-send',
      'wh-software':      'software',
    };
    Object.entries(map).forEach(([inputId, key]) => {
      const el = document.getElementById(inputId);
      if (el && state.webhooks[key]) {
        el.value = state.webhooks[key];
      }
    });
  }

  // ── Verificar conexión con n8n ───────────────
  async function testConnection(baseUrl) {
    if (!baseUrl) return { ok: false, message: 'URL vacía' };

    // n8n expone /healthz o /api/v1/workflows — probamos /healthz
    const url = baseUrl.replace(/\/$/, '') + '/healthz';

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok || res.status === 404) {
        // 404 en /healthz aún significa que n8n responde
        return { ok: true, message: `Conectado a ${baseUrl}` };
      }
      return { ok: false, message: `n8n respondió con estado ${res.status}` };
    } catch (err) {
      if (err.name === 'TimeoutError') {
        return { ok: false, message: 'Timeout — ¿está n8n arrancado?' };
      }
      return { ok: false, message: `No se pudo conectar: ${err.message}` };
    }
  }

  // ── Llamar a un webhook de n8n ───────────────
  /**
   * @param {string} module  — clave del módulo ('catering', 'software', etc.)
   * @param {Object} payload — datos a enviar en el cuerpo JSON
   * @returns {Promise<{ok: boolean, data: any, error: string}>}
   */
  async function callWebhook(module, payload = {}) {
    if (!state.connected) {
      return { ok: false, error: 'n8n no está conectado. Configura la conexión primero.' };
    }

    const path    = state.webhooks[module];
    const baseUrl = state.baseUrl.replace(/\/$/, '');

    if (!path) {
      return { ok: false, error: `No hay webhook configurado para el módulo "${module}"` };
    }

    const url = baseUrl + path;

    try {
      const res = await fetch(url, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
        signal:  AbortSignal.timeout(120000), // workflows reales (LLM + Sheets) pueden tardar ~1-2 min
      });

      const text = await res.text();
      let data;
      try   { data = JSON.parse(text); }
      catch { data = { raw: text }; }

      if (!res.ok) {
        return { ok: false, error: `n8n devolvió ${res.status}`, data };
      }

      return { ok: true, data };

    } catch (err) {
      if (err.name === 'TimeoutError') {
        return { ok: false, error: 'El workflow tardó demasiado (>120 s). Revisa n8n.' };
      }
      return { ok: false, error: err.message };
    }
  }

  // ── Actualizar UI de estado de conexión ─────
  function updateConnectionUI(connected, detail = '') {
    state.connected = connected;

    // Dot + texto de la topbar
    const badge = document.getElementById('n8n-indicator');
    const badgeText = document.getElementById('n8n-badge-text');
    if (badge && badgeText) {
      badge.className = 'n8n-badge ' + (connected ? 'connected' : 'disconnected');
      badgeText.textContent = connected ? 'n8n conectado' : 'n8n desconectado';
    }

    // Pantalla de configuración
    const dot    = document.getElementById('n8n-dot');
    const text   = document.getElementById('n8n-status-text');
    const detEl  = document.getElementById('n8n-status-detail');
    const sess   = document.getElementById('session-n8n');

    if (dot)   dot.className   = 'status-dot ' + (connected ? 'connected' : 'disconnected');
    if (text)  text.innerHTML  = connected
      ? '<strong style="color:var(--teal-text)">n8n conectado</strong>'
      : '<strong>n8n desconectado</strong>';
    if (detEl) detEl.textContent = detail || (connected ? 'Todo listo' : 'Configura la URL base');
    if (sess)  sess.textContent  = connected ? 'Conectado ✓' : 'Desconectado';
  }

  // ── Auto-rellenar los paths por defecto si están vacíos ──
  function autoFillPaths() {
    const map = {
      'wh-catering':      '/webhook/catering-assign',
      'wh-guardias-send': '/webhook/guardias-run',
      'wh-software':      '/webhook/software-assign',
    };
    Object.entries(map).forEach(([id, path]) => {
      const el = document.getElementById(id);
      if (el && !el.value) el.value = path;
    });
  }

  // ── API pública ──────────────────────────────
  return {
    get connected() { return state.connected; },
    get baseUrl()   { return state.baseUrl; },

    init() {
      loadSaved();
      updateConnectionUI(state.connected, state.baseUrl ? `URL: ${state.baseUrl}` : '');
    },

    async verify(baseUrl) {
      const result = await testConnection(baseUrl);
      if (result.ok) {
        state.baseUrl   = baseUrl;
        state.connected = true;
        updateConnectionUI(true, result.message);
        fillWebhookInputs();
        autoFillPaths();
      } else {
        state.connected = false;
        updateConnectionUI(false, result.message);
      }
      return result;
    },

    saveConfig(baseUrl, webhooks) {
      state.baseUrl  = baseUrl;
      state.webhooks = { ...state.webhooks, ...webhooks };
      saveToStorage();
    },

    call: callWebhook,
    updateUI: updateConnectionUI,
    fillInputs: fillWebhookInputs,
  };

})();
