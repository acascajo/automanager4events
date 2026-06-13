/**
 * app.js — Lógica principal de SmartAssign
 */

// ── Navegación ───────────────────────────────────────────────────
const PAGE_LABELS = {
  dashboard: 'Panel principal',
  catering:  'Catering',
  guardias:  'Guardias médicas',
  software:  'Proyectos software',
  historial: 'Historial',
  config:    'Configuración',
};

function gotoPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const pageEl = document.getElementById('page-' + page);
  const navEl  = document.getElementById('nav-' + page);
  // Las páginas de módulo arrancan con la clase .hidden (display:none !important),
  // que gana a .page.active; hay que quitarla además de activar.
  if (pageEl) { pageEl.classList.remove('hidden'); pageEl.classList.add('active'); }
  if (navEl)  navEl.classList.add('active');

  document.getElementById('topbar-bc').textContent = PAGE_LABELS[page] || page;

  // Al abrir el historial, refrescar desde Google Sheets (fuente de verdad)
  if (page === 'history' && typeof History !== 'undefined') History.load();
}

// ── Login / Registro / Logout (autenticación real: credencial con hash) ──
const AUTH_KEY = 'smartassign-auth';
const PREFILL_KEY = 'smartassign-login-prefill';   // autocompletado del login (prototipo)

async function sha256(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Siembra una credencial por defecto (admin / admin) la primera vez
async function ensureDefaultUser() {
  if (!localStorage.getItem(AUTH_KEY)) {
    localStorage.setItem(AUTH_KEY, JSON.stringify({ user: 'admin', hash: await sha256('admin') }));
    if (!localStorage.getItem(PREFILL_KEY)) localStorage.setItem(PREFILL_KEY, JSON.stringify({ user: 'admin', pass: 'admin' }));
  }
  prefillLogin();
}

// Autocompleta el login con las últimas credenciales (o las de por defecto)
function prefillLogin() {
  let pf = null;
  try { pf = JSON.parse(localStorage.getItem(PREFILL_KEY) || 'null'); } catch (e) {}
  const u = document.getElementById('login-user'), p = document.getElementById('login-pass');
  if (pf && u) u.value = pf.user || '';
  if (pf && p) p.value = pf.pass || '';
  const err = document.getElementById('login-error');
  if (err && !err.textContent) { err.style.color = 'var(--muted-text, #889)'; err.textContent = 'Credenciales por defecto: admin / admin'; }
}

// Registro de un nuevo usuario (sustituye la credencial y autocompleta el login)
async function doRegister() {
  const user = document.getElementById('reg-user').value.trim();
  const p1 = document.getElementById('reg-pass').value;
  const p2 = document.getElementById('reg-pass2').value;
  const errEl = document.getElementById('register-error');
  const setErr = m => { if (errEl) { errEl.style.color = 'var(--danger-text)'; errEl.textContent = m; } };
  if (!user || !p1) { setErr('Usuario y contraseña obligatorios.'); return; }
  if (p1.length < 4) { setErr('La contraseña debe tener al menos 4 caracteres.'); return; }
  if (p1 !== p2) { setErr('Las contraseñas no coinciden.'); return; }

  localStorage.setItem(AUTH_KEY, JSON.stringify({ user, hash: await sha256(p1) }));
  localStorage.setItem(PREFILL_KEY, JSON.stringify({ user, pass: p1 }));

  showLoginForm();
  document.getElementById('login-user').value = user;
  document.getElementById('login-pass').value = p1;
  const le = document.getElementById('login-error');
  if (le) { le.style.color = 'var(--teal-text)'; le.textContent = 'Cuenta creada. Ya puedes iniciar sesión.'; }
}

function showRegisterForm() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
  const e = document.getElementById('register-error'); if (e) e.textContent = '';
}
function showLoginForm() {
  document.getElementById('register-form').classList.add('hidden');
  document.getElementById('login-form').classList.remove('hidden');
}

function enterApp(user) {
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');
  const initials = user.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2) || 'U';
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-name').textContent = user;
  const sessUser = document.getElementById('session-user');
  if (sessUser) sessUser.textContent = user;
  N8N.init();
}

async function doLogin() {
  const user = document.getElementById('login-user').value.trim();
  const pass = document.getElementById('login-pass').value;
  const errEl = document.getElementById('login-error');
  const setErr = m => { if (errEl) { errEl.style.color = 'var(--danger-text)'; errEl.textContent = m; } };

  let cred = {};
  try { cred = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}'); } catch (e) {}
  if (!user || !pass) { setErr('Introduce usuario y contraseña.'); return; }
  const hash = await sha256(pass);
  if (user !== cred.user || hash !== cred.hash) { setErr('Usuario o contraseña incorrectos.'); return; }

  if (errEl) errEl.textContent = '';
  sessionStorage.setItem('smartassign-session', user);
  localStorage.setItem(PREFILL_KEY, JSON.stringify({ user, pass }));   // recordar para autocompletar
  enterApp(user);
}

function doLogout() {
  sessionStorage.removeItem('smartassign-session');
  document.getElementById('login-pass').value = '';
  document.getElementById('screen-app').classList.add('hidden');
  document.getElementById('screen-login').classList.remove('hidden');
}

// ── Tabs ─────────────────────────────────────────────────────────
function initTabs(groupId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.dataset.tab;
      // Tabs del mismo grupo
      group.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      // Panels: buscar en el mismo page padre
      const page = group.closest('.page');
      page.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
      const target = document.getElementById(targetId);
      // .hidden lleva !important, así que hay que quitarlo además de activar
      if (target) target.classList.remove('hidden');
      if (target) target.classList.add('active');
    });
  });
}

// Activa una pestaña concreta de un grupo de forma programática
function activateTab(groupId, panelId) {
  const group = document.getElementById(groupId);
  if (!group) return;
  group.querySelectorAll('.tab').forEach(t =>
    t.classList.toggle('active', t.dataset.tab === panelId));
  const page = group.closest('.page');
  if (!page) return;
  page.querySelectorAll('.tab-panel').forEach(p => {
    const isTarget = p.id === panelId;
    p.classList.toggle('active', isTarget);
    if (isTarget) p.classList.remove('hidden');
  });
}

// ── Subida de archivos ───────────────────────────────────────────
function triggerUpload(module) {
  const input = document.getElementById(module + '-file-input');
  if (input) input.click();
}

// Datos parseados del último Excel subido, por módulo (se envían a n8n al lanzar)
const UPLOADED = {};

// Lee el .xlsx subido con SheetJS y guarda sus hojas como JSON para enviarlas a n8n.
// Cada hoja se localiza por nombre (el de la plantilla) y, si no, por posición.
function parseUploadedExcel(file, module) {
  if (typeof XLSX === 'undefined') { console.warn('[upload] SheetJS no disponible'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const sheet = (name, idx) => {
        const sn = wb.SheetNames.find(s => s.toLowerCase() === name.toLowerCase()) || wb.SheetNames[idx];
        return sn ? XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' }) : [];
      };
      if (module === 'catering') {
        UPLOADED.catering = {
          disponibilidad: sheet('Disponibilidad', 0),
          camareros:      sheet('Camareros', 1),
          eventos:        sheet('Eventos', 2),
        };
        const c = UPLOADED.catering;
        console.log(`[upload] catering: ${c.disponibilidad.length} disponibilidad · ${c.camareros.length} camareros · ${c.eventos.length} eventos`);
      } else if (module === 'software') {
        UPLOADED.software = {
          equipo:    sheet('Equipo', 0),
          proyectos: sheet('Proyectos', 1),
          tareas:    sheet('Tareas', 2),
        };
        const s = UPLOADED.software;
        console.log(`[upload] software: ${s.equipo.length} equipo · ${s.proyectos.length} proyectos · ${s.tareas.length} tareas`);
      }
    } catch (err) {
      console.warn('[upload] No se pudo parsear el Excel:', err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function handleFileUpload(event, module) {
  const file = event.target.files[0];
  if (!file) return;

  const zone  = document.getElementById(module + '-upload-zone');
  const info  = document.getElementById(module + '-file-info');
  const name  = document.getElementById(module + '-file-name');
  const meta  = document.getElementById(module + '-file-meta');

  if (zone) zone.classList.add('hidden');
  if (info) info.classList.remove('hidden');
  if (name) name.textContent = file.name;
  if (meta) meta.textContent = `${(file.size / 1024).toFixed(0)} KB · Listo para procesar`;

  // Habilitar botón de ejecución
  const runBtn = document.getElementById(module + '-run-btn');
  if (runBtn) runBtn.disabled = false;

  const status = document.getElementById(module + '-run-status');
  if (status) status.textContent = 'Archivo cargado. Configura los parámetros y lanza.';

  // Parsear el Excel y guardar sus datos para enviarlos a n8n al lanzar
  parseUploadedExcel(file, module);

  // Avanzar paso 1 → 2 en el indicador de progreso
  advanceStep(module, 1);
}

function removeFile(module) {
  const zone  = document.getElementById(module + '-upload-zone');
  const info  = document.getElementById(module + '-file-info');
  const input = document.getElementById(module + '-file-input');
  const runBtn = document.getElementById(module + '-run-btn');
  const status = document.getElementById(module + '-run-status');

  if (zone)  zone.classList.remove('hidden');
  if (info)  info.classList.add('hidden');
  if (input) input.value = '';
  if (runBtn) runBtn.disabled = true;
  if (status) status.textContent = 'Sube el archivo para continuar';

  delete UPLOADED[module];   // descartar los datos parseados del archivo anterior

  resetSteps(module);
}

// ── Catering: dos archivos (BD de camareros PERSISTENTE + respuestas/eventos) ──
// La BD de camareros se guarda en localStorage: se sube una vez y se conserva
// entre sesiones; solo hay que subir las respuestas/eventos en cada ejecución.
const CATERING_BD_KEY = 'smartassign-catering-camareros';

function handleCateringUpload(event, kind) {       // kind = 'bd' | 'resp'
  const file = event.target.files[0];
  if (!file) return;
  const slot = 'catering-' + kind;
  const zone = document.getElementById(slot + '-upload-zone');
  const info = document.getElementById(slot + '-file-info');
  const name = document.getElementById(slot + '-file-name');
  const meta = document.getElementById(slot + '-file-meta');
  if (zone) zone.classList.add('hidden');
  if (info) info.classList.remove('hidden');
  if (name) name.textContent = file.name;
  if (meta) meta.textContent = 'leyendo…';
  parseCateringFile(file, kind, meta);
}

function parseCateringFile(file, kind, metaEl) {
  if (typeof XLSX === 'undefined') { console.warn('[upload] SheetJS no disponible'); return; }
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const wb = XLSX.read(e.target.result, { type: 'array' });
      const sheet = (name, idx) => {
        const sn = wb.SheetNames.find(s => s.toLowerCase() === name.toLowerCase()) || wb.SheetNames[idx];
        return sn ? XLSX.utils.sheet_to_json(wb.Sheets[sn], { defval: '' }) : [];
      };
      UPLOADED.catering = UPLOADED.catering || {};
      if (kind === 'bd') {
        const cam = sheet('Camareros', 0);
        UPLOADED.catering.camareros = cam;
        try { localStorage.setItem(CATERING_BD_KEY, JSON.stringify(cam)); }
        catch (e2) { console.warn('[catering] no se pudo guardar la BD (¿demasiado grande?)', e2); }
        if (metaEl) metaEl.textContent = `${cam.length} camareros · guardada en el navegador`;
      } else {
        UPLOADED.catering.disponibilidad = sheet('Disponibilidad', 0);
        UPLOADED.catering.eventos = sheet('Eventos', 1);
        if (metaEl) metaEl.textContent = `${UPLOADED.catering.disponibilidad.length} disponibilidades · ${UPLOADED.catering.eventos.length} eventos`;
      }
      updateCateringReady();
    } catch (err) {
      console.warn('[upload] No se pudo parsear el Excel:', err);
    }
  };
  reader.readAsArrayBuffer(file);
}

function removeCateringFile(kind) {
  const slot = 'catering-' + kind;
  const zone = document.getElementById(slot + '-upload-zone');
  const info = document.getElementById(slot + '-file-info');
  const input = document.getElementById(slot + '-file-input');
  if (zone) zone.classList.remove('hidden');
  if (info) info.classList.add('hidden');
  if (input) input.value = '';
  UPLOADED.catering = UPLOADED.catering || {};
  if (kind === 'bd') {
    delete UPLOADED.catering.camareros;
    try { localStorage.removeItem(CATERING_BD_KEY); } catch (e) {}
  } else {
    delete UPLOADED.catering.disponibilidad;
    delete UPLOADED.catering.eventos;
  }
  updateCateringReady();
}

// Habilita "Lanzar" cuando hay BD de camareros + (disponibilidad y eventos)
function updateCateringReady() {
  const d = UPLOADED.catering || {};
  const hasBD   = Array.isArray(d.camareros) && d.camareros.length > 0;
  const hasResp = Array.isArray(d.disponibilidad) && Array.isArray(d.eventos) && d.eventos.length > 0;
  const btn = document.getElementById('catering-run-btn');
  if (btn) btn.disabled = !(hasBD && hasResp);
  const status = document.getElementById('catering-run-status');
  if (status) {
    if (hasBD && hasResp)  status.textContent = 'Archivos listos. Pulsa para lanzar.';
    else if (hasBD)        status.textContent = 'BD de camareros lista. Sube las respuestas y eventos.';
    else if (hasResp)      status.textContent = 'Respuestas listas. Sube la base de datos de camareros.';
    else                   status.textContent = 'Sube los dos archivos para continuar';
  }
  if (hasBD && hasResp) advanceStep('catering', 1);
}

// Restaura la BD de camareros guardada (no hay que volver a subirla)
function initCatering() {
  try {
    const saved = localStorage.getItem(CATERING_BD_KEY);
    if (saved) {
      const cam = JSON.parse(saved);
      if (Array.isArray(cam) && cam.length) {
        UPLOADED.catering = UPLOADED.catering || {};
        UPLOADED.catering.camareros = cam;
        const zone = document.getElementById('catering-bd-upload-zone');
        const info = document.getElementById('catering-bd-file-info');
        const name = document.getElementById('catering-bd-file-name');
        const meta = document.getElementById('catering-bd-file-meta');
        if (zone) zone.classList.add('hidden');
        if (info) info.classList.remove('hidden');
        if (name) name.textContent = 'Base de datos guardada';
        if (meta) meta.textContent = `${cam.length} camareros · guardada en el navegador`;
      }
    }
  } catch (e) { console.warn('[catering] no se pudo restaurar la BD', e); }
  updateCateringReady();
}

// ── Notificación por correo a los camareros asignados (SIMULADA) ──────────
// Resuelve el email de cada asignado desde la BD de camareros.
let lastCateringAssignments = [];
function buildCateringRecipients(data) {
  const list = Array.isArray(data) ? data : [];
  const cam = (UPLOADED.catering && UPLOADED.catering.camareros) || [];
  const emailByTel = {};
  for (const c of cam) emailByTel[String(c.telefono).trim()] = c.email || '';
  lastCateringAssignments = list.map(r => ({
    nombre: r.nombre, telefono: r.telefono, event_id: r.event_id,
    email: emailByTel[String(r.telefono).trim()] || '',
  }));
}

// Opción de envío: SIMULADA (no hay workflow de n8n de envío asignado)
function sendCateringEmails() {
  const cont = document.getElementById('catering-email-result');
  if (!lastCateringAssignments.length) {
    if (cont) cont.innerHTML = '<div class="alert alert-warn"><i class="ti ti-alert-triangle"></i><span>Lanza primero una asignación con n8n para tener a quién notificar.</span></div>';
    return;
  }
  const conEmail = lastCateringAssignments.filter(a => a.email);
  const sinEmail = lastCateringAssignments.length - conEmail.length;
  const lista = conEmail.map(a => `${a.nombre} (${a.email})`).join(', ');
  const aviso = sinEmail ? ` · ${sinEmail} sin email en la BD` : '';
  if (cont) cont.innerHTML =
    '<div class="alert alert-info"><i class="ti ti-mail-check"></i><span>' +
    `<strong>Asignaciones aceptadas.</strong> Se enviarían ${conEmail.length} correos${aviso} a: ${lista}.` +
    '<br><em>Simulado: no hay un workflow de n8n de envío configurado, así que no se envía nada realmente.</em>' +
    '</span></div>';
}

// ── Indicador de pasos ───────────────────────────────────────────
function advanceStep(module, completedStep) {
  const container = document.getElementById(module + '-steps');
  if (!container) return;
  const items = container.querySelectorAll('.step-num');
  items.forEach((el, i) => {
    el.classList.remove('step-active', 'step-done');
    if (i < completedStep) {
      el.classList.add('step-done');
      el.innerHTML = '<i class="ti ti-check"></i>';
    } else if (i === completedStep) {
      el.classList.add('step-active');
      el.textContent = i + 1;
    } else {
      el.textContent = i + 1;
    }
  });
}

function resetSteps(module) {
  const container = document.getElementById(module + '-steps');
  if (!container) return;
  container.querySelectorAll('.step-num').forEach((el, i) => {
    el.className = 'step-num' + (i === 0 ? ' step-active' : '');
    el.textContent = i + 1;
  });
}

// ── Lanzar workflow con n8n (o simularlo en modo demo) ───────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── Utilidades de meses / semanas (módulo de guardias) ───────────
const MES_NUM = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6,
  julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
};
const MES_ABR = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

function parseMes(valor) {
  const [nombre, anyo] = (valor || '').toLowerCase().trim().split(/\s+/);
  return { month: MES_NUM[nombre] || 0, year: Number(anyo) || 0 };
}
function toISO(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
// Divide el mes en semanas (bloques de lunes a domingo) que solapan con él
function weeksOfMonth(year, month) {
  const dias = new Date(year, month, 0).getDate();
  const weeks = [];
  let cur = null;
  for (let d = 1; d <= dias; d++) {
    const dow = (new Date(year, month - 1, d).getDay() + 6) % 7; // 0=lunes … 6=domingo
    if (cur === null || dow === 0) { cur = { start: d, end: d }; weeks.push(cur); }
    else cur.end = d;
  }
  return weeks.map(w => ({ ...w, label: `${w.start}–${w.end} ${MES_ABR[month - 1]}` }));
}
// Fecha máxima de respuesta: 15 días antes del inicio del periodo
function maxDeadline(year, month) {
  const inicio = new Date(year, month - 1, 1);
  inicio.setDate(inicio.getDate() - 15);
  return inicio;
}
const MES_LARGO = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
function addDias(iso, n) {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return toISO(d);
}
function fechaLarga(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} de ${MES_LARGO[m - 1]} de ${y}`;
}
// Mensaje tras enviar solicitudes: los resultados estarán el día siguiente a la fecha límite
function mensajeSolicitudesEnviadas(demo) {
  const dl = document.getElementById('guardias-deadline')?.value;
  const disp = dl ? fechaLarga(addDias(dl, 1)) : 'el día siguiente a la fecha límite';
  const lim = dl ? fechaLarga(dl) : 'la fecha límite';
  return `${demo ? '<strong>Modo demo:</strong> ' : ''}✓ Solicitudes de disponibilidad enviadas a los residentes. ` +
    `Las respuestas se recogen y procesan automáticamente. ` +
    `Los <strong>resultados estarán disponibles el ${disp}</strong> (día siguiente a la fecha límite, ${lim}).`;
}

// Reconstruye los selectores de residentes por semana y ajusta la fecha límite
function buildGuardiasWeeks() {
  const sel  = document.getElementById('guardias-mes');
  const cont = document.getElementById('guardias-weeks');
  if (!sel || !cont) return;
  const { year, month } = parseMes(sel.value);
  if (!month) { cont.innerHTML = ''; return; }
  cont.innerHTML = weeksOfMonth(year, month).map((w, i) => `
    <div class="config-row">
      <div><div class="config-label">Semana ${i + 1}</div><div class="config-sub">${w.label}</div></div>
      <select class="config-select config-input-sm" data-week="${i + 1}">
        <option value="1">1 residente</option>
        <option value="2">2 residentes</option>
      </select>
    </div>`).join('');

  // Corrección 3: fecha límite ≤ inicio del periodo − 15 días
  const dl = document.getElementById('guardias-deadline');
  if (dl) {
    const maxIso = toISO(maxDeadline(year, month));
    dl.max = maxIso;
    if (!dl.value || dl.value > maxIso) dl.value = maxIso;
  }
}

// Recoge los parámetros del formulario según el módulo
function buildPayload(module) {
  if (module === 'catering') {
    const data = UPLOADED.catering || {};
    return {
      // Datos de los Excel subidos (BD camareros + respuestas/eventos):
      // el workflow los usa en lugar de Google Sheets
      disponibilidad: data.disponibilidad || [],
      camareros:      data.camareros || [],
      eventos:        data.eventos || [],
    };
  }
  if (module === 'guardias-send') {
    // Simulación: la web genera internamente las disponibilidades de los médicos
    // (como si hubieran respondido por correo) + las guardias necesarias del periodo,
    // y se las manda al webhook guardias-run, que ejecuta el solver CSP sin enviar
    // correos ni escribir en Google Sheets.
    return buildGuardiasSimData();
  }
  if (module === 'software') {
    const d = UPLOADED.software || {};
    return { equipo: d.equipo || [], proyectos: d.proyectos || [], tareas: d.tareas || [] };
  }
  return {};
}

// Validación de campos obligatorios. Devuelve un mensaje de error o null.
function validateModule(module) {
  // Catering y software: los datos vienen en la plantilla; el botón ya exige archivo subido.
  if (module === 'guardias-send') {
    const mesVal = document.getElementById('guardias-mes')?.value;
    if (!mesVal) return 'Selecciona el mes de planificación.';
    // Corrección 3: la fecha límite no puede ser posterior a 15 días antes del inicio
    const dl = document.getElementById('guardias-deadline')?.value;
    const { year, month } = parseMes(mesVal);
    if (dl && month) {
      const maxIso = toISO(maxDeadline(year, month));
      if (dl > maxIso) {
        return `La fecha límite debe ser como muy tarde el ${maxIso} (15 días antes del inicio del periodo).`;
      }
    }
  }
  return null;
}

// Validación de FORMATO de la plantilla: detecta entradas mal formateadas
// (hojas vacías, columnas obligatorias ausentes, valores no numéricos) antes
// de lanzar el workflow. Devuelve un mensaje de error comprensible o null.
function validateDataFormat(module) {
  const base = module.split('-')[0];

  // Comprueba que la hoja existe, no está vacía y contiene las columnas obligatorias
  const reqCols = (rows, sheet, cols) => {
    if (!Array.isArray(rows) || rows.length === 0) {
      return `la hoja «${sheet}» está vacía o no existe en la plantilla`;
    }
    const present = Object.keys(rows[0] || {});
    const missing = cols.filter(c => !present.includes(c));
    if (missing.length) {
      return `a la hoja «${sheet}» le falta(n) la(s) columna(s) obligatoria(s) ${missing.map(c => `«${c}»`).join(', ')}`;
    }
    return null;
  };

  // Comprueba que una columna que debe ser numérica no contiene texto
  const reqNum = (rows, sheet, col) => {
    for (let i = 0; i < (rows || []).length; i++) {
      const v = rows[i][col];
      if (v === '' || v === null || v === undefined) continue; // vacío lo gestiona el motor
      if (isNaN(Number(v))) {
        return `la hoja «${sheet}» tiene un valor no numérico en la columna «${col}» (fila ${i + 2}: «${v}»)`;
      }
    }
    return null;
  };

  if (base === 'software') {
    const d = UPLOADED.software || {};
    return reqCols(d.equipo, 'Equipo', ['persona_id', 'nombre', 'skills', 'capacidad_horas_semana'])
        || reqCols(d.proyectos, 'Proyectos', ['proyecto_id', 'nombre'])
        || reqCols(d.tareas, 'Tareas', ['tarea_id', 'nombre', 'skills_requeridas', 'horas_estimadas'])
        || reqNum(d.equipo, 'Equipo', 'capacidad_horas_semana')
        || reqNum(d.tareas, 'Tareas', 'horas_estimadas');
  }

  if (base === 'catering') {
    const d = UPLOADED.catering || {};
    return reqCols(d.camareros, 'Camareros', ['telefono', 'nombre'])
        || reqCols(d.disponibilidad, 'Disponibilidad', ['telefono'])
        || reqCols(d.eventos, 'Eventos', ['event_id']);
  }

  return null; // guardias: los datos se generan internamente, no hay plantilla que validar
}

// Anima el indicador de pasos de 0 a N para dar feedback visual
async function animateSteps(base) {
  const container = document.getElementById(base + '-steps');
  if (!container) return;
  const total = container.querySelectorAll('.step-num').length;
  for (let i = 0; i <= total; i++) {
    advanceStep(base, i);
    await sleep(420);
  }
}

// Lleva al usuario a la pestaña de resultados del módulo
function showResults(base) {
  const map = {
    catering: ['catering-tabs', 'catering-resultados'],
    software: ['software-tabs', 'software-resultados'],
    guardias: ['guardias-tabs', 'guardias-calendario'],
  };
  const target = map[base];
  if (target) activateTab(target[0], target[1]);
}

async function runWorkflow(module) {
  const base     = module.split('-')[0];
  const statusEl = document.getElementById(base + '-run-status');
  const runBtn   = document.getElementById(module + '-run-btn') ||
                   document.getElementById(base + '-run-btn');
  const setStatus = html => { if (statusEl) statusEl.innerHTML = html; };

  // 1. Validación de campos obligatorios
  const error = validateModule(module);
  if (error) { setStatus(`⚠ ${error}`); return; }

  // 1b. Validación de FORMATO de la plantilla → si está mal formateada, salida de fallo
  //     (no se ejecuta ningún workflow ni se genera ninguna asignación)
  const fmtError = validateDataFormat(module);
  if (fmtError) {
    setStatus(
      '<div class="alert alert-danger"><i class="ti ti-file-alert"></i><span>' +
      `<strong>Plantilla no válida.</strong> El proceso se ha detenido porque ${escHtml(fmtError)}. ` +
      'Revisa que la plantilla siga el formato esperado. No se ha generado ninguna asignación.</span></div>'
    );
    // Registrar el error en el historial de forma comprensible
    History.add({
      module: base,
      label: 'Ejecución rechazada',
      summary: `Plantilla no válida: ${fmtError}`,
      warn: 'Error de formato',
      error: fmtError,
    });
    return;
  }

  const payload = buildPayload(module);
  if (runBtn) runBtn.disabled = true;

  // 2. Si n8n está conectado → llamada real al webhook
  if (N8N.connected) {
    setStatus('<span class="spinner"></span> Enviando a n8n…');
    const result = await N8N.call(module, payload);
    if (runBtn) runBtn.disabled = false;
    if (result.ok) {
      if (module === 'guardias-send') {
        // Simulación: el webhook devuelve destinatarios (envío simulado) + calendario CSP
        renderGuardiasFromN8n(result.data);
        setStatus(mensajeEnvioSimulado(result.data));
        showResults('guardias');   // ir a la pestaña Calendario
        return;
      }
      setStatus('✓ Workflow ejecutado en n8n. Mostrando resultados reales.');
      // Pintar la respuesta REAL de n8n en la tabla del módulo + registrar en historial
      if (base === 'catering') {
        buildCateringRecipients(result.data);   // resuelve emails para la opción de envío
        const er = document.getElementById('catering-email-result');
        if (er) er.innerHTML = '';               // limpiar notificación anterior
        if (window.DEMO && DEMO.renderCateringFromN8n) DEMO.renderCateringFromN8n(result.data);
        registrarHistorialCatering(result.data);
      } else if (base === 'software') {
        if (window.DEMO && DEMO.renderSoftwareFromN8n) DEMO.renderSoftwareFromN8n(result.data);
        registrarHistorialSoftware(result.data);
      }
      await animateSteps(base);
      showResults(base);
    } else {
      setStatus(`✗ Error: ${result.error}`);
    }
    return;
  }

  // 3. Sin n8n → modo demo: simula la ejecución con datos de ejemplo
  if (module === 'guardias-send') {
    setStatus('<span class="spinner"></span> Enviando solicitudes…');
    await sleep(800);
    if (runBtn) runBtn.disabled = false;
    setStatus(mensajeSolicitudesEnviadas(true));
    return;
  }

  setStatus('<span class="spinner"></span> Modo demo (n8n no conectado) — simulando ejecución…');
  await animateSteps(base);
  if (runBtn) runBtn.disabled = false;
  setStatus('✓ <strong>Modo demo:</strong> mostrando resultados de ejemplo. ' +
            'Conecta n8n en <strong>Configuración</strong> para datos reales.');
  if (window.DEMO) DEMO.run(base);   // recalcula y renderiza con el motor de demo
  showResults(base);
}

// ── Descargar plantilla (.xlsx generado en el navegador con SheetJS) ──
// Cada plantilla define sus hojas como [nombre, filas]. La primera fila es
// la cabecera; la segunda, una fila de ejemplo para guiar al usuario.
const TEMPLATES = {
  // Catering — archivo 1: base de datos de camareros (con email). Dato maestro
  // que se sube una vez y se conserva en el navegador.
  'catering-bd': {
    file: 'plantilla_camareros_bd.xlsx',
    sheets: [
      ['Camareros', [
        ['telefono', 'nombre', 'email', 'fecha_alta', 'antiguedad_dias', 'horas_trabajadas', 'nota',
         'fecha_ultimo_evento', 'dias_desde_ultimo_evento', 'fecha_ultima_disponibilidad_si',
         'dias_desde_ultima_disponibilidad_si', 'num_disponibilidades_si', 'num_respuestas',
         'ratio_disponibilidad', 'num_disponibilidades_coche', 'activo', 'verificado',
         'score_fiable', 'score_prometedor', 'score_general'],
        ['625031064', 'Alicia Carmona Torres', 'alicia.carmona@cateringlaurel.es', '2021-04-14', 1970, 339, 9,
         '2026-01-27', 131, '2026-05-10', 31, 12, 16, 0.74, 8, 'SI', 'SI', 0.95, 0.65, 0.85],
      ]],
    ],
  },
  // Catering — archivo 2: respuestas de disponibilidad + eventos a cubrir.
  'catering-resp': {
    file: 'plantilla_respuestas_eventos.xlsx',
    sheets: [
      ['Disponibilidad', [
        ['fecha_evento', 'telefono', 'nombre', 'disponible', 'tiene_coche', 'observaciones'],
        ['2026-06-20', '672574623', 'Daniel García López', 'SI', 'NO', 'Puedo ir al montaje'],
      ]],
      ['Eventos', [
        ['event_id', 'fecha', 'hora_inicio', 'hora_fin', 'tipo', 'nombre_evento', 'ubicacion',
         'asistentes', 'camareros_necesarios', 'estado', 'prioridad', 'observaciones', 'updated_at'],
        ['EVT001', '2026-06-20', '17:00', '23:00', 'boda', 'Boda Marta y Carlos', 'Finca Valdemorillo',
         60, 6, 'NEW', 1, '', '2026-06-01'],
      ]],
    ],
  },
  // Guardias: solo plantilla de la base de datos de médicos (dato maestro).
  // El periodo se configura en la web y las disponibilidades llegan por email.
  guardias: {
    file: 'plantilla_guardias_medicos.xlsx',
    sheets: [
      ['Medicos', [
        ['medico_id', 'anio_residencia', 'nombre', 'email', 'activo'],
        [1, 'R4', 'Iván', 'al364930@uji.es', 'sí'],
      ]],
    ],
  },
  // Software: 3 hojas (equipo, proyectos, tareas).
  software: {
    file: 'plantilla_software.xlsx',
    sheets: [
      ['Equipo', [
        ['persona_id', 'nombre', 'rol', 'seniority', 'skills', 'capacidad_horas_semana', 'disponibilidad', 'observaciones'],
        ['P01', 'Ana', 'Frontend', 'Senior', 'React, TypeScript, CSS', 32, 'disponible', 'Buena para tareas críticas de frontend'],
      ]],
      ['Proyectos', [
        ['proyecto_id', 'nombre', 'cliente', 'prioridad', 'fecha_inicio', 'deadline', 'estado', 'horas_estimadas', 'observaciones'],
        ['PR01', 'Portal Clientes', 'Cliente Bancario', 5, '2026-06-01', '2026-06-28', 'activo', 160, 'Proyecto más crítico del mes'],
      ]],
      ['Tareas', [
        ['tarea_id', 'proyecto_id', 'nombre', 'descripcion', 'skills_requeridas', 'horas_estimadas',
         'prioridad', 'deadline', 'dependencias', 'bloqueada', 'persona_preferida'],
        ['T001', 'PR01', 'Diseño flujo login', 'Definir pantallas y flujo de acceso', 'UX, UI, Figma',
         12, 5, '2026-06-05', '', 'no', 'Elena'],
      ]],
    ],
  },
};

function downloadTemplate(module) {
  const def = TEMPLATES[module];
  if (!def) return;
  if (typeof XLSX === 'undefined') {
    alert('No se pudo cargar la librería de Excel (¿sin conexión a la CDN?).');
    return;
  }
  const wb = XLSX.utils.book_new();
  def.sheets.forEach(([name, rows]) => {
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name);
  });
  XLSX.writeFile(wb, def.file);
}

// ── Exportar resultados a .xlsx ───────────────────────────────────
function exportResults(module) {
  if (typeof XLSX === 'undefined') {
    alert('No se pudo cargar la librería de Excel (¿sin conexión a la CDN?).');
    return;
  }
  const wb = XLSX.utils.book_new();

  if (module === 'guardias') {
    const rows = [['Día', 'Residente', 'Tipo de guardia']];
    Object.keys(GUARDIAS_JUL_2026)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(day => {
        const g = GUARDIAS_JUL_2026[day];
        const tipo = g.length > 1 ? 'Doble (2 residentes)' : 'Simple (1 residente)';
        g.forEach(e => {
          rows.push([day, e.n, tipo]);
        });
      });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), 'Calendario');
    XLSX.writeFile(wb, 'resultado_guardias_julio_2026.xlsx');
    return;
  }

  const table = document.getElementById(module + '-results-table');
  if (!table) { alert('No hay resultados para exportar.'); return; }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.table_to_sheet(table), 'Asignaciones');
  XLSX.writeFile(wb, `resultado_${module}.xlsx`);
}

// ── Historial — filtro ────────────────────────────────────────────
function initHistorialFilters() {
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const filter = btn.dataset.filter;
      document.querySelectorAll('.history-row').forEach(row => {
        row.style.display =
          (filter === 'all' || row.dataset.module === filter) ? 'flex' : 'none';
      });
    });
  });
}

// ── Historial REAL de ejecuciones (persistido en localStorage) ────────────
const HISTORY_KEY = 'smartassign-history';
const MODULE_LABEL = { catering: 'Catering', guardias: 'Guardias', software: 'Software' };
const MODULE_BADGE = { catering: 'badge-catering', guardias: 'badge-guardias', software: 'badge-software' };

const History = {
  sel: new Set(),   // ids seleccionados para comparar
  all() { try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]'); } catch (e) { return []; } },
  add(rec) {
    const list = this.all();
    rec.ts = Date.now();
    rec.id = rec.id || (rec.module.slice(0, 3).toUpperCase() + '-' + rec.ts.toString(36).slice(-5).toUpperCase());
    list.unshift(rec);
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, 100))); } catch (e) { console.warn('[historial] no se pudo guardar', e); }
    renderHistory();
    // Una ejecución correcta se persiste en Google Sheets desde el propio workflow;
    // tras un margen, resincronizamos el historial desde Sheets (fuente de verdad).
    if (!rec.error && N8N.connected) setTimeout(() => this.load(), 2500);
    return rec;
  },
  // Lee el historial desde Google Sheets (vía webhook de n8n) y lo fusiona con los
  // registros locales que NO se persisten en Sheets (p. ej. ejecuciones rechazadas
  // por error de formato). Si n8n/Sheets no responde, se conserva el historial local.
  async load() {
    try {
      const res = await N8N.call('historial', {});
      if (!res.ok || !res.data || !Array.isArray(res.data.historial)) return;
      const sheets = res.data.historial.map(r => ({
        id: r.id, module: r.module, ts: r.ts, label: r.label, summary: r.summary,
        data: r.data, periodo: r.data && r.data.periodo, warn: '',
      }));
      const localErrors = this.all().filter(r => r.error);
      const merged = [...sheets, ...localErrors].sort((a, b) => b.ts - a.ts);
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(merged.slice(0, 100))); } catch (e) {}
      renderHistory();
    } catch (e) { console.warn('[historial] no se pudo leer de Sheets', e); }
  },
  clear() { localStorage.removeItem(HISTORY_KEY); this.sel.clear(); const c = document.getElementById('history-compare'); if (c) c.innerHTML = ''; },
  toggleSel(id, on) { if (on) this.sel.add(id); else this.sel.delete(id); this._updateCompareBtn(); },
  _updateCompareBtn() {
    const b = document.getElementById('history-compare-btn');
    if (b) { b.textContent = `Comparar (${this.sel.size})`; b.disabled = this.sel.size !== 2; }
  },
  compare() {
    const recs = this.all().filter(r => this.sel.has(r.id));
    if (recs.length === 2) renderComparison(recs[0], recs[1]);
  },
  // Reabre una ejecución guardada: re-renderiza sus resultados y va al módulo
  view(id) {
    const rec = this.all().find(r => r.id === id);
    if (!rec) return;
    if (rec.error) { gotoPage(rec.module); return; } // ejecución rechazada: no hay resultados que reabrir
    try {
      if (rec.module === 'catering' && window.DEMO) { buildCateringRecipients(rec.data); DEMO.renderCateringFromN8n(rec.data); }
      else if (rec.module === 'software' && window.DEMO) { DEMO.renderSoftwareFromN8n(rec.data); }
      else if (rec.module === 'guardias') { renderGuardiasFromN8n(rec.data, rec.periodo); }
    } catch (e) { console.warn('[historial] error al reabrir', e); }
    gotoPage(rec.module);
    showResults(rec.module);
  },
};

function fmtTs(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('es-ES') + ' ' + d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

function renderHistory() {
  const cont = document.getElementById('history-list');
  const countEl = document.getElementById('history-count');
  if (!cont) return;
  const list = History.all();
  if (countEl) countEl.textContent = `${list.length} ${list.length === 1 ? 'ejecución registrada' : 'ejecuciones registradas'}`;
  if (!list.length) {
    cont.innerHTML = '<div class="card-body"><p class="help-text">Aún no hay ejecuciones. Lanza un módulo con n8n y se registrarán aquí.</p></div>';
    return;
  }
  const activeFilter = document.querySelector('.filter-btn.active')?.dataset.filter || 'all';
  cont.innerHTML = list.map(r => `
    <div class="history-row" data-module="${r.module}" style="${activeFilter === 'all' || activeFilter === r.module ? '' : 'display:none;'}">
      <input type="checkbox" class="hist-check" title="Seleccionar para comparar" onchange="History.toggleSel('${r.id}', this.checked)" ${History.sel.has(r.id) ? 'checked' : ''} style="margin-right:2px;" />
      <span class="history-id">${escHtml(r.id)}</span>
      <span class="badge ${MODULE_BADGE[r.module] || ''}">${MODULE_LABEL[r.module] || r.module}</span>
      <div class="exec-info"><div class="exec-name">${escHtml(r.label || '')}</div><div class="exec-meta">${fmtTs(r.ts)} · ${escHtml(r.summary || '')}</div></div>
      <span class="badge ${r.error ? 'badge-danger' : (r.warn ? 'badge-warn' : 'badge-ok')}">${escHtml(r.warn || 'Completado')}</span>
      <button class="btn btn-sm" onclick="History.view('${r.id}')">Ver</button>
    </div>`).join('');
  History._updateCompareBtn();
}

// Métricas clave de una ejecución, según su módulo (para comparar)
function histMetrics(rec) {
  const d = rec.data;
  if (rec.module === 'catering') {
    const l = Array.isArray(d) ? d : [];
    const ev = new Set(l.map(r => r.event_id).filter(Boolean));
    return { 'Asignaciones': l.length, 'Eventos': ev.size, 'Con coche': l.filter(r => r.tiene_coche === true || String(r.tiene_coche).toLowerCase() === 'true').length, 'Motor': l[0]?.origen_asignacion || '—' };
  }
  if (rec.module === 'software') {
    const r = d.resumen || {};
    return { 'Tareas asignadas': `${r.tareas_asignadas ?? 0}/${r.total_tareas ?? 0}`, 'Sin asignar': r.tareas_sin_asignar ?? 0, 'Horas asignadas': r.horas_totales_asignadas ?? 0 };
  }
  if (rec.module === 'guardias') {
    const v = d.validacion || {};
    return { 'Puestos cubiertos': `${d.total_puestos_cubiertos ?? 0}/${d.total_puestos_necesarios ?? 0}`, 'Huecos': d.total_huecos ?? 0, 'Violaciones duras': v.total_violaciones_hard ?? 0 };
  }
  return {};
}

function renderComparison(a, b) {
  const cont = document.getElementById('history-compare');
  if (!cont) return;
  const sameModule = a.module === b.module;
  const ma = histMetrics(a), mb = histMetrics(b);
  const keys = [...new Set([...Object.keys(ma), ...Object.keys(mb)])];
  const rows = sameModule
    ? keys.map(k => {
        const va = ma[k] ?? '—', vb = mb[k] ?? '—';
        const diff = String(va) !== String(vb);
        const st = diff ? ' style="font-weight:600;color:var(--teal-text);"' : '';
        return `<tr><td>${escHtml(k)}</td><td${st}>${escHtml(String(va))}</td><td${st}>${escHtml(String(vb))}</td></tr>`;
      }).join('')
    : `<tr><td>Resumen</td><td>${escHtml(a.summary || '')}</td><td>${escHtml(b.summary || '')}</td></tr>`;
  cont.innerHTML = `<div class="card" style="margin-bottom:16px;">
    <div class="section-header"><div class="section-title">Comparación de ejecuciones</div>
      <button class="btn btn-sm" onclick="document.getElementById('history-compare').innerHTML=''">Cerrar</button></div>
    <table class="data-table">
      <thead><tr><th>Métrica</th><th>${escHtml(a.id)}<br><span class="muted-val" style="font-weight:400;">${fmtTs(a.ts)}</span></th><th>${escHtml(b.id)}<br><span class="muted-val" style="font-weight:400;">${fmtTs(b.ts)}</span></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${sameModule ? '' : '<div class="card-body"><p class="help-text">Las dos ejecuciones son de módulos distintos; se compara solo el resumen.</p></div>'}
  </div>`;
}

// Registradores por módulo (llamados tras una ejecución real con n8n)
function registrarHistorialCatering(data) {
  const list = Array.isArray(data) ? data : [];
  const eventos = [...new Set(list.map(r => r.event_id).filter(Boolean))];
  const conCoche = list.filter(r => r.tiene_coche === true || String(r.tiene_coche).toLowerCase() === 'true').length;
  History.add({
    module: 'catering',
    label: `Eventos: ${eventos.join(', ') || '—'}`,
    summary: `${list.length} camareros · ${eventos.length} evento(s) · ${conCoche} con coche · motor ${list[0]?.origen_asignacion || '—'}`,
    data,
  });
}
function registrarHistorialSoftware(data) {
  const r = (data && data.resumen) || {};
  const proy = (data && data.resumen_proyectos && data.resumen_proyectos[0]) ? data.resumen_proyectos[0].nombre : 'Asignación';
  History.add({
    module: 'software',
    label: proy,
    summary: `${r.tareas_asignadas ?? 0}/${r.total_tareas ?? 0} tareas asignadas · ${r.horas_totales_asignadas ?? 0}h`,
    warn: r.tareas_sin_asignar ? `${r.tareas_sin_asignar} sin asignar` : '',
    data,
  });
}
function registrarHistorialGuardias(data, periodo) {
  const v = (data && data.validacion) || {};
  History.add({
    module: 'guardias',
    label: `Calendario ${periodo || ''}`.trim(),
    summary: `${data.total_puestos_cubiertos ?? 0}/${data.total_puestos_necesarios ?? 0} puestos · ${v.total_violaciones_hard ?? 0} violaciones`,
    warn: (v.total_violaciones_hard ? `${v.total_violaciones_hard} violaciones` : ''),
    periodo,
    data,
  });
}

// ── Configuración n8n ─────────────────────────────────────────────
async function testN8nConnection() {
  const baseUrl = document.getElementById('n8n-base-url')?.value.trim();
  if (!baseUrl) { alert('Introduce la URL base de n8n primero.'); return; }

  const statusText = document.getElementById('n8n-status-text');
  const statusDetail = document.getElementById('n8n-status-detail');
  if (statusText) statusText.innerHTML = '<strong>Verificando…</strong>';
  if (statusDetail) statusDetail.textContent = `Conectando a ${baseUrl}`;

  const result = await N8N.verify(baseUrl);
  if (!result.ok) {
    if (statusText) statusText.innerHTML = `<strong style="color:var(--danger-text)">Sin conexión</strong>`;
    if (statusDetail) statusDetail.textContent = result.message;
  }
}

function saveConfig() {
  const baseUrl = document.getElementById('n8n-base-url')?.value.trim() || '';
  const webhooks = {
    'catering':      document.getElementById('wh-catering')?.value      || '',
    'guardias-send': document.getElementById('wh-guardias-send')?.value  || '',
    'software':      document.getElementById('wh-software')?.value       || '',
  };
  N8N.saveConfig(baseUrl, webhooks);
  alert('Configuración guardada correctamente.');
}

// ── Calendario de guardias ────────────────────────────────────────
// Se genera a partir de los 12 médicos (demo-data.js) y la distribución por
// semanas: las semanas indicadas en `semanas_dobles` llevan 2 residentes/día
// (guardia doble) y el resto 1 residente/día. La generación respeta:
//   · R8 — los R2 solo hacen guardias dobles (nunca un día de 1 residente)
//   · R7 — en una guardia doble nunca coinciden dos R2
//   · R4 — ningún médico hace guardia dos días seguidos
// (Una "guardia doble" = 2 residentes ese día; NO es un "doblete", que es un
//  médico que hace guardia, libra un día y vuelve a hacer guardia.)
function generarCalendarioGuardias(year, month, medicos, semanasDobles) {
  const esDoble = {};
  weeksOfMonth(year, month).forEach((w, i) => {
    const doble = semanasDobles.includes(i + 1);
    for (let d = w.start; d <= w.end; d++) esDoble[d] = doble;
  });
  const dias = new Date(year, month, 0).getDate();
  const r2   = medicos.filter(m => m.anyo === 'R2');
  const noR2 = medicos.filter(m => m.anyo !== 'R2');
  const count = {}, last = {};
  medicos.forEach(m => { count[m.cal] = 0; last[m.cal] = -10; });
  // Elige el candidato con menos guardias y que lleve más tiempo sin hacerla,
  // excluyendo a quien hizo guardia el día anterior (evita días consecutivos)
  const pick = (pool, day) => {
    const cand = pool
      .filter(m => last[m.cal] !== day - 1)
      .sort((a, b) => count[a.cal] - count[b.cal] || last[a.cal] - last[b.cal]);
    return (cand[0] || pool[0]);
  };
  const cal = {};
  for (let d = 1; d <= dias; d++) {
    const elegidos = [];
    if (esDoble[d]) {
      elegidos.push(pick(r2, d));     // 1 R2 (R7: solo uno; R8: R2 solo en dobles)
      elegidos.push(pick(noR2, d));   // + 1 no-R2
    } else {
      elegidos.push(pick(noR2, d));   // día simple: solo no-R2
    }
    cal[d] = elegidos.map(m => ({ n: m.cal }));
    elegidos.forEach(m => { count[m.cal]++; last[m.cal] = d; });
  }
  return cal;
}

const GUARDIAS_JUL_2026 = generarCalendarioGuardias(
  DEMO_GUARDIAS.anio, DEMO_GUARDIAS.mes, DEMO_GUARDIAS.medicos, DEMO_GUARDIAS.semanas_dobles);

function buildCalendar() {
  const container = document.getElementById('calendar-jul-2026');
  if (!container) return;

  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  // Julio 2026 empieza en miércoles (índice 2)
  const firstDayIndex = 2;
  const totalDays = 31;

  // Cabeceras
  let html = days.map(d => `<div class="cal-header-cell">${d}</div>`).join('');

  // Celdas vacías iniciales
  for (let i = 0; i < firstDayIndex; i++) {
    html += `<div class="cal-day"></div>`;
  }

  // Días del mes
  for (let day = 1; day <= totalDays; day++) {
    const g = GUARDIAS_JUL_2026[day] || [];
    const hasGuard = g.length > 0;
    const isDouble = g.length > 1;
    html += `<div class="cal-day${hasGuard ? ' has-guard' : ''}">
      <div class="cal-day-num">${day}</div>
      ${g.map(e => `<div class="cal-event${isDouble ? ' double' : ''}">${e.n}</div>`).join('')}
    </div>`;
  }

  // Celdas vacías finales para completar la fila
  const total = firstDayIndex + totalDays;
  const remainder = total % 7;
  if (remainder !== 0) {
    for (let i = 0; i < 7 - remainder; i++) {
      html += `<div class="cal-day"></div>`;
    }
  }

  container.innerHTML = html;
}

// ── Guardias con n8n: simulación (envío sin correos + calendario real CSP) ──
const escHtml = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// RNG determinista por médico/mes → disponibilidades estables entre ejecuciones
function seededRand(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}

// Genera la disponibilidad "como si el médico hubiera respondido por correo".
// La crea la WEB internamente (oculta al usuario) para que la demo sea realista.
function generarDisponibilidadMedico(m, year, month) {
  const dias = new Date(year, month, 0).getDate();
  const rnd = seededRand((Number(m.id) || 1) * 97 + month * 13 + (year % 100) * 7);
  const pick = n => {
    const set = new Set();
    let guard = 0;
    while (set.size < n && guard++ < 200) set.add(1 + Math.floor(rnd() * dias));
    return [...set].map(d => toISO(new Date(year, month - 1, d)));
  };
  const noPuedo = pick(2 + Math.floor(rnd() * 3));                       // 2-4 días
  const prefLibrar = pick(2).filter(f => !noPuedo.includes(f));
  const prefGuardia = pick(2).filter(f => !noPuedo.includes(f) && !prefLibrar.includes(f));
  const dobletes = rnd() > 0.6 ? pick(1) : [];
  return {
    medico_id: m.id, nombre_medico: m.nombre || m.cal, email_medico: m.email || '',
    anio_residencia: m.anyo || m.anio_residencia || '', rotacion: m.rotacion || '', rotacion_externa: 'no',
    objetivo_guardias: m.objetivo || 0, restricciones: '', observaciones: '',
    no_puedo: noPuedo, preferiria_librar: prefLibrar, prefiere_guardia: prefGuardia, dobletes,
  };
}

// Construye el payload para el webhook guardias-run: disponibilidades (internas)
// + guardias necesarias (de la config de semanas) + periodo.
function buildGuardiasSimData() {
  const sel = document.getElementById('guardias-mes')?.value || '';
  const { year, month } = parseMes(sel);
  const medicos = (typeof DEMO_GUARDIAS !== 'undefined') ? DEMO_GUARDIAS.medicos : [];

  const resBySemana = {};
  document.querySelectorAll('#guardias-weeks [data-week]').forEach(s => {
    resBySemana[Number(s.dataset.week)] = Number(s.value);
  });

  const guardias = [];
  weeksOfMonth(year, month).forEach((w, i) => {
    const residentes = resBySemana[i + 1] || 1;
    for (let d = w.start; d <= w.end; d++) {
      guardias.push({
        fecha: toISO(new Date(year, month - 1, d)),
        semana: `Semana ${i + 1}`,
        num_guardias: residentes,
        doble_residente: residentes >= 2,
      });
    }
  });

  const disponibilidades = medicos.map(m => generarDisponibilidadMedico(m, year, month));
  return { periodo: sel, deadline: document.getElementById('guardias-deadline')?.value || '', disponibilidades, guardias };
}

// Mensaje de "envío simulado"
function mensajeEnvioSimulado(data) {
  const n = (data && data.recipients) ? data.recipients.length : 0;
  return `✓ <strong>Simulado:</strong> se enviarían ${n} solicitudes de disponibilidad por correo ` +
    `(no se envía nada realmente, no hay workflow de envío). Calendario generado con el solver CSP — ver pestaña <strong>Calendario</strong>.`;
}

// Pinta el grid del calendario para CUALQUIER mes a partir de las asignaciones
function renderCalendarGrid(year, month, byFecha) {
  const container = document.getElementById('calendar-jul-2026');
  if (!container) return;
  const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
  const firstDayIndex = (new Date(year, month - 1, 1).getDay() + 6) % 7; // 0 = lunes
  const totalDays = new Date(year, month, 0).getDate();
  let html = days.map(d => `<div class="cal-header-cell">${d}</div>`).join('');
  for (let i = 0; i < firstDayIndex; i++) html += `<div class="cal-day"></div>`;
  for (let day = 1; day <= totalDays; day++) {
    const iso = toISO(new Date(year, month - 1, day));
    const g = byFecha[iso] || [];
    const isDouble = g.length > 1;
    html += `<div class="cal-day${g.length ? ' has-guard' : ''}"><div class="cal-day-num">${day}</div>` +
      g.map(e => `<div class="cal-event${isDouble ? ' double' : ''}">${escHtml(e.n)}</div>`).join('') + `</div>`;
  }
  const rem = (firstDayIndex + totalDays) % 7;
  if (rem !== 0) for (let i = 0; i < 7 - rem; i++) html += `<div class="cal-day"></div>`;
  container.innerHTML = html;
}

// Renderiza el calendario REAL devuelto por el webhook guardias-run (solver CSP)
function renderGuardiasFromN8n(data, periodoOverride) {
  if (!data) return;
  const sel = periodoOverride || document.getElementById('guardias-mes')?.value || '';
  const { year, month } = parseMes(sel);
  const asigs = (data.calendario && data.calendario.asignaciones) || [];
  const resumen = data.resumen_medicos || [];
  const medicos = (typeof DEMO_GUARDIAS !== 'undefined') ? DEMO_GUARDIAS.medicos : [];

  const nameById = {}, rotById = {};
  medicos.forEach(m => { nameById[String(m.id)] = m.nombre || m.cal; rotById[String(m.id)] = m.rotacion || ''; });
  resumen.forEach(r => { if (!nameById[String(r.medico_id)]) nameById[String(r.medico_id)] = r.nombre_medico; });

  const byFecha = {};
  asigs.forEach(a => { byFecha[a.fecha] = (a.medico_ids || []).map(id => ({ n: nameById[String(id)] || ('#' + id) })); });
  renderCalendarGrid(year, month, byFecha);

  // Títulos
  const t = document.getElementById('guardias-cal-title');
  if (t) t.textContent = `Calendario ${sel || ''}`.trim();
  const meta = document.getElementById('guardias-cal-meta');
  if (meta) meta.textContent = `Generado con n8n · Solver CSP · ${data.total_puestos_cubiertos ?? 0}/${data.total_puestos_necesarios ?? 0} puestos cubiertos`;
  const cm = document.getElementById('guardias-cal-month');
  if (cm) cm.textContent = sel || '';

  // Stats
  const diasMes = new Date(year, month, 0).getDate();
  const setT = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  setT('gd-stat-dias', diasMes);
  setT('gd-stat-guardias', data.total_puestos_cubiertos ?? asigs.reduce((s, a) => s + (a.medico_ids || []).length, 0));
  setT('gd-stat-cobertura', (data.total_puestos_necesarios ? Math.round((data.total_puestos_cubiertos / data.total_puestos_necesarios) * 100) : 0) + '%');
  setT('gd-stat-violadas', (data.validacion && data.validacion.total_violaciones_hard) || 0);

  // Resumen por médico
  const colors = ['blue', 'teal', 'amber', 'coral'];
  const rows = resumen.map((r, i) => {
    const obj = r.objetivo_efectivo ?? r.objetivo_explicito ?? 0;
    const asign = r.num_guardias_asignadas ?? 0;
    const delta = r.diferencia_vs_objetivo ?? (asign - obj);
    const badge = Math.abs(delta) < 0.5
      ? '<span class="badge badge-ok">En objetivo</span>'
      : `<span class="badge badge-warn">${delta > 0 ? '+' : ''}${delta}</span>`;
    const ini = String(r.nombre_medico || '?').trim().charAt(0).toUpperCase();
    return `<tr>
      <td><div class="person-cell"><div class="avatar ${colors[i % colors.length]}">${escHtml(ini)}</div>${escHtml(r.nombre_medico)}</div></td>
      <td>${escHtml(r.anio_residencia || '')}</td>
      <td>${escHtml(rotById[String(r.medico_id)] || '')}</td>
      <td><span class="mono-val">${asign}/${typeof obj === 'number' ? Math.round(obj * 10) / 10 : obj}</span></td>
      <td>${badge}</td>
    </tr>`;
  }).join('');
  const tbody = document.getElementById('guardias-summary');
  if (tbody) tbody.innerHTML = rows;

  // Validación y advertencias
  const v = data.validacion || {};
  const head = v.valido_hard
    ? '<div class="alert alert-info"><i class="ti ti-shield-check"></i><span>Validador determinista: 0 violaciones de restricciones duras (R1–R8).</span></div>'
    : `<div class="alert alert-warn"><i class="ti ti-alert-triangle"></i><span>${(v.total_violaciones_hard || 0)} violaciones duras detectadas.</span></div>`;
  const advs = (v.advertencias_soft || []).slice(0, 12).map(a => {
    let msg = a.tipo;
    if (a.tipo === 'MEDICO_BAJO_OBJETIVO') msg = `${a.nombre_medico}: ${a.asignadas}/${a.objetivo} guardias (${a.deficit} por debajo).`;
    else if (a.tipo === 'MEDICO_SOBRE_OBJETIVO') msg = `${a.nombre_medico}: ${a.asignadas}/${a.objetivo} guardias (+${a.exceso}).`;
    else if (a.tipo === 'ASIGNADO_EN_PREFERIRIA_LIBRAR') msg = `${a.nombre_medico}: guardia el ${a.fecha}, día que prefería librar.`;
    else if (a.tipo === 'COBERTURA_NO_EXACTA') msg = `${a.fecha}: ${a.asignadas}/${a.esperadas} cubiertos (${a.huecos} hueco/s).`;
    return `<div class="alert alert-warn"><i class="ti ti-alert-triangle"></i><span>${escHtml(msg)}</span></div>`;
  }).join('');
  // Nota explicativa: R2 a 0 porque no hay guardias dobles (restricción R8)
  const r2cero = resumen.filter(r => String(r.anio_residencia) === 'R2' && (r.num_guardias_asignadas || 0) === 0);
  const hayDobles = asigs.some(a => (a.medico_ids || []).length > 1);
  const notaR8 = (r2cero.length && !hayDobles)
    ? `<div class="alert alert-warn"><i class="ti ti-info-circle"></i><span><strong>${r2cero.length} residentes R2 con 0 guardias:</strong> por la restricción R8, los R2 solo pueden hacer guardias <strong>dobles</strong> (2 residentes/día). No hay ninguna semana configurada con 2 residentes, así que no pueden asignarse. Pon alguna semana en «2 residentes» para incluirlos.</span></div>`
    : '';

  const warn = document.getElementById('guardias-warnings');
  if (warn) warn.innerHTML = head + notaR8 + (advs || '<div class="alert alert-info"><i class="ti ti-check"></i><span>Sin advertencias blandas.</span></div>');
}

// Paso 1: envío de solicitudes (SIMULADO, sin correos). No genera calendario.
let guardiasSolicitudesEnviadas = false;
function enviarSolicitudesGuardias() {
  const statusEl = document.getElementById('guardias-run-status');
  const set = html => { if (statusEl) statusEl.innerHTML = html; };
  const error = validateModule('guardias-send');
  if (error) { set(`⚠ ${error}`); return; }
  const medicos = (typeof DEMO_GUARDIAS !== 'undefined') ? DEMO_GUARDIAS.medicos : [];
  const n = medicos.filter(m => m.email).length;
  guardiasSolicitudesEnviadas = true;
  set(`✓ <strong>Simulado:</strong> se enviarían ${n} solicitudes de disponibilidad por correo (no se envía nada realmente). ` +
      `Cuando "respondan", ve a <strong>Calendario</strong> y pulsa <em>«Leer respuestas y generar»</em>.`);
  advanceStep('guardias', 2);
  activateTab('guardias-tabs', 'guardias-calendario');
}

// Paso 2: leer respuestas (simulado) + generar el calendario con el CSP (n8n)
async function leerRespuestasYGenerar() {
  const statusEl = document.getElementById('guardias-gen-status');
  const set = html => { if (statusEl) statusEl.innerHTML = html; };
  if (!guardiasSolicitudesEnviadas) {
    set('<div class="alert alert-warn"><i class="ti ti-alert-triangle"></i><span>Primero pulsa «Enviar solicitudes» en la pestaña Configurar.</span></div>');
    return;
  }
  const error = validateModule('guardias-send');
  if (error) { set(`<div class="alert alert-warn"><i class="ti ti-alert-triangle"></i><span>${escHtml(error)}</span></div>`); return; }

  if (N8N.connected) {
    set('<div class="alert alert-info"><span class="spinner"></span> <span>Leyendo respuestas y ejecutando el solver CSP en n8n… (puede tardar ~30 s)</span></div>');
    const result = await N8N.call('guardias-send', buildGuardiasSimData());
    if (result.ok) {
      renderGuardiasFromN8n(result.data);
      const v = result.data.validacion || {};
      registrarHistorialGuardias(result.data, document.getElementById('guardias-mes')?.value || '');
      set(`<div class="alert alert-info"><i class="ti ti-circle-check"></i><span><strong>Respuestas procesadas y calendario generado</strong> con el solver CSP: ` +
          `${result.data.total_puestos_cubiertos}/${result.data.total_puestos_necesarios} puestos cubiertos, ${v.total_violaciones_hard ?? 0} violaciones duras.</span></div>`);
    } else {
      set(`<div class="alert alert-warn"><i class="ti ti-alert-triangle"></i><span>Error al generar: ${escHtml(result.error)}</span></div>`);
    }
  } else {
    if (window.DEMO) DEMO.run('guardias');
    buildCalendar();
    set('<div class="alert alert-info"><i class="ti ti-info-circle"></i><span>Modo demo (n8n no conectado): mostrando calendario de ejemplo (julio 2026).</span></div>');
  }
}

// ── Navegación por data-goto ─────────────────────────────────────
function initGotoLinks() {
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => gotoPage(el.dataset.goto));
  });
}

// Rellena la tabla de médicos y el panel de respuestas desde los datos de demo
function renderGuardiasMedicos() {
  if (typeof DEMO_GUARDIAS === 'undefined') return;
  const meds = DEMO_GUARDIAS.medicos;
  const colors = ['blue', 'teal', 'amber', 'coral'];
  const tbody = document.getElementById('guardias-medicos-tbody');
  if (tbody) {
    tbody.innerHTML = meds.map((m, i) => `
      <tr>
        <td><div class="person-cell"><div class="avatar ${colors[i % colors.length]}">${(m.nombre[0] || '').toUpperCase()}</div>${m.nombre}</div></td>
        <td>${m.anyo}</td>
        <td>${m.rotacion}</td>
        <td>${m.objetivo}</td>
        <td><span class="badge badge-ok">Activo</span></td>
      </tr>`).join('');
  }
  // Estado de respuestas (demo): todos menos los 2 últimos han respondido
  const total = meds.length;
  const recibidas = Math.max(0, total - 2);
  const cont = document.getElementById('guardias-respuestas');
  if (cont) {
    cont.innerHTML = meds.map((m, i) =>
      `<div class="response-row"><span>${m.nombre}</span>${
        i < recibidas ? '<span class="badge badge-ok">Recibida</span>'
                      : '<span class="badge badge-warn">Pendiente</span>'}</div>`).join('');
  }
  const bar = document.getElementById('guardias-respuestas-bar');
  if (bar) bar.style.width = Math.round(recibidas / total * 100) + '%';
  const txt = document.getElementById('guardias-respuestas-txt');
  if (txt) txt.textContent = `${recibidas} de ${total} residentes han respondido`;
}

// ── Inicialización ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Login
  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('logout-btn').addEventListener('click', doLogout);

  // Registro: alternar formularios + crear cuenta
  document.getElementById('show-register').addEventListener('click', e => { e.preventDefault(); showRegisterForm(); });
  document.getElementById('show-login').addEventListener('click', e => { e.preventDefault(); showLoginForm(); });
  document.getElementById('register-btn').addEventListener('click', doRegister);
  document.getElementById('reg-pass2').addEventListener('keydown', e => { if (e.key === 'Enter') doRegister(); });

  // Navegación sidebar
  document.querySelectorAll('.nav-item[data-page]').forEach(btn => {
    btn.addEventListener('click', () => gotoPage(btn.dataset.page));
  });

  // Links data-goto (tarjetas de módulo, botón "ver todo", etc.)
  initGotoLinks();

  // Tabs de cada módulo
  initTabs('catering-tabs');
  initTabs('guardias-tabs');
  initTabs('software-tabs');

  // Filtros del historial + render del historial real (localStorage como caché)
  initHistorialFilters();
  renderHistory();
  // Refrescar desde Google Sheets si n8n está conectado (fuente de verdad)
  History.load();

  // Login: sembrar credencial por defecto (admin/admin) y mostrar pista
  ensureDefaultUser();

  // Construir calendario
  buildCalendar();

  // Guardias: residentes por semana + fecha límite según el mes elegido
  const mesSel = document.getElementById('guardias-mes');
  if (mesSel) mesSel.addEventListener('change', buildGuardiasWeeks);
  buildGuardiasWeeks();

  // Tabla de médicos y estado de respuestas (12 residentes)
  renderGuardiasMedicos();

  // Catering: restaurar la BD de camareros guardada y ajustar el estado de subida
  initCatering();

  // Pre-rellenar las pestañas de resultados con el motor de demo
  if (window.DEMO) DEMO.init();
});
