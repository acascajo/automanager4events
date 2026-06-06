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
}

// ── Login / Logout ───────────────────────────────────────────────
function doLogin() {
  const user = document.getElementById('login-user').value.trim() || 'Admin';
  document.getElementById('screen-login').classList.add('hidden');
  document.getElementById('screen-app').classList.remove('hidden');

  // Mostrar nombre de usuario
  const initials = user.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('user-avatar').textContent = initials;
  document.getElementById('user-name').textContent   = user;
  const sessUser = document.getElementById('session-user');
  if (sessUser) sessUser.textContent = user;

  N8N.init();
}

function doLogout() {
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

  resetSteps(module);
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

// Recoge los parámetros del formulario según el módulo
function buildPayload(module) {
  if (module === 'catering') {
    return {
      nombre:    document.getElementById('catering-nombre')?.value   || '',
      vehiculos: document.getElementById('catering-vehiculos')?.value || 2,
      motor:     document.getElementById('catering-motor')?.value     || 'auto',
      email:     document.getElementById('catering-email')?.checked   || false,
    };
  }
  if (module === 'guardias-send') {
    return {
      mes:      document.getElementById('guardias-mes')?.value      || '',
      deadline: document.getElementById('guardias-deadline')?.value || '',
    };
  }
  if (module === 'guardias-plan') {
    return {
      mes:    document.getElementById('guardias-mes')?.value    || '',
      semana: document.getElementById('guardias-semana')?.value || '1',
      finde:  document.getElementById('guardias-finde')?.value  || '2',
    };
  }
  if (module === 'software') {
    return {
      nombre: document.getElementById('software-nombre')?.value   || '',
      // ?? (no ||): un checkbox desmarcado debe poder enviar false
      skills: document.getElementById('software-skills')?.checked ?? true,
      horas:  document.getElementById('software-horas')?.value    || 40,
      umbral: document.getElementById('software-umbral')?.value   || 6,
    };
  }
  return {};
}

// Validación de campos obligatorios. Devuelve un mensaje de error o null.
function validateModule(module) {
  if (module === 'catering' && !document.getElementById('catering-nombre')?.value.trim()) {
    return 'Introduce el nombre del evento antes de lanzar.';
  }
  if (module === 'software' && !document.getElementById('software-nombre')?.value.trim()) {
    return 'Introduce el nombre del sprint o proyecto antes de lanzar.';
  }
  if ((module === 'guardias-send' || module === 'guardias-plan') &&
      !document.getElementById('guardias-mes')?.value) {
    return 'Selecciona el mes de planificación.';
  }
  return null;
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

  const payload = buildPayload(module);
  if (runBtn) runBtn.disabled = true;

  // 2. Si n8n está conectado → llamada real al webhook
  if (N8N.connected) {
    setStatus('<span class="spinner"></span> Enviando a n8n…');
    const result = await N8N.call(module, payload);
    if (runBtn) runBtn.disabled = false;
    if (result.ok) {
      setStatus('✓ Workflow ejecutado correctamente. Revisa la pestaña Resultados.');
      await animateSteps(base);
      if (module !== 'guardias-send') showResults(base);
    } else {
      setStatus(`✗ Error: ${result.error}`);
    }
    return;
  }

  // 3. Sin n8n → modo demo: simula la ejecución con datos de ejemplo
  setStatus('<span class="spinner"></span> Modo demo (n8n no conectado) — simulando ejecución…');
  await animateSteps(base);
  if (runBtn) runBtn.disabled = false;

  if (module === 'guardias-send') {
    setStatus('✓ <strong>Modo demo:</strong> solicitudes preparadas. Conecta n8n en ' +
              '<strong>Configuración</strong> para enviarlas por email.');
    return;
  }
  setStatus('✓ <strong>Modo demo:</strong> mostrando resultados de ejemplo. ' +
            'Conecta n8n en <strong>Configuración</strong> para datos reales.');
  if (window.DEMO) DEMO.run(base);   // recalcula y renderiza con el motor de demo
  showResults(base);
}

// ── Descargar plantilla (.xlsx generado en el navegador con SheetJS) ──
// Cada plantilla define sus hojas como [nombre, filas]. La primera fila es
// la cabecera; la segunda, una fila de ejemplo para guiar al usuario.
const TEMPLATES = {
  // Catering: 3 hojas (disponibilidad, base de datos de camareros, eventos).
  catering: {
    file: 'plantilla_catering.xlsx',
    sheets: [
      ['Disponibilidad', [
        ['id_camarero', 'fecha', 'disponible'],
        ['CAM-001', '2026-07-14', 'Sí'],
      ]],
      ['Camareros', [
        ['id_camarero', 'nombre', 'telefono', 'vehiculo_propio', 'activo', 'verificado',
         'historial_eventos', 'score_fiable', 'score_prometedor', 'score_general', 'nota', 'observaciones'],
        ['CAM-001', 'Laura García', '600111222', 'Sí', 'Sí', 'Sí', 12, 9.0, 8.5, 9.2, 9, 'Prefiere turnos de tarde'],
      ]],
      ['Eventos', [
        ['id_evento', 'fecha', 'hora_inicio', 'hora_fin', 'tipo', 'nombre', 'ubicacion',
         'asistentes', 'camareros_necesarios', 'prioridad'],
        ['EVT-001', '2026-07-14', '19:00', '23:30', 'Gala', 'Gala Empresarial', 'Madrid Centro', 150, 6, 5],
      ]],
    ],
  },
  // Guardias: solo plantilla de la base de datos de médicos (dato maestro).
  // El periodo se configura en la web y las disponibilidades llegan por email.
  guardias: {
    file: 'plantilla_guardias_medicos.xlsx',
    sheets: [
      ['Medicos', [
        ['id_medico', 'nombre', 'email', 'anyo_residencia', 'rotacion', 'objetivo_guardias', 'activo'],
        ['MED-001', 'Marta García', 'marta@example.com', 'R2', 'Cardiología', 8, 'Sí'],
      ]],
    ],
  },
  // Software: 3 hojas (equipo, proyectos, tareas).
  software: {
    file: 'plantilla_software.xlsx',
    sheets: [
      ['Equipo', [
        ['id_persona', 'nombre', 'rol', 'seniority', 'habilidades', 'capacidad_horas_semana',
         'disponible', 'observaciones'],
        ['DEV-001', 'Alejandro Vega', 'Backend', 'senior', 'Node.js;REST;Docker', 40, 'Sí', 'Lidera el equipo de API'],
      ]],
      ['Proyectos', [
        ['id_proyecto', 'nombre', 'cliente', 'prioridad', 'fecha_inicio', 'deadline', 'estado', 'horas_estimadas'],
        ['PRJ-001', 'Plataforma de pagos', 'Banco X', 5, '2026-07-01', '2026-08-15', 'activo', 320],
      ]],
      ['Tareas', [
        ['id_tarea', 'id_proyecto', 'nombre', 'descripcion', 'skills_requeridas', 'horas_estimadas',
         'prioridad', 'deadline', 'dependencias', 'persona_preferida'],
        ['TSK-001', 'PRJ-001', 'Refactor API Gateway', 'Rediseño del gateway de pagos',
         'Node.js;REST', 20, 4, '2026-07-30', '', 'DEV-001'],
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
    const rows = [['Día', 'Residente', 'Doblete']];
    Object.keys(GUARDIAS_JUL_2026)
      .map(Number)
      .sort((a, b) => a - b)
      .forEach(day => {
        GUARDIAS_JUL_2026[day].forEach(e => {
          rows.push([day, e.n, e.d ? 'Sí' : 'No']);
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

// Botones «Ver» del historial → abren el módulo y su pestaña de resultados
function initHistoryView() {
  document.querySelectorAll('.history-row .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const mod = btn.closest('.history-row')?.dataset.module;
      if (!mod) return;
      gotoPage(mod);
      showResults(mod);
    });
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
    'guardias-plan': document.getElementById('wh-guardias-plan')?.value  || '',
    'software':      document.getElementById('wh-software')?.value       || '',
  };
  N8N.saveConfig(baseUrl, webhooks);
  alert('Configuración guardada correctamente.');
}

// ── Calendario de guardias (julio 2026) ──────────────────────────
// Datos de ejemplo del calendario. Cada día → lista de { n: nombre, d: doblete }.
// Al conectar n8n, este objeto se rellenaría con la respuesta del workflow.
const GUARDIAS_JUL_2026 = {
    1:  [{ n:'S. Ruiz', d:false }],
    2:  [{ n:'J. López', d:false }],
    3:  [{ n:'M. García', d:false }],
    4:  [{ n:'P. Martín', d:false }],
    5:  [{ n:'S. Ruiz', d:true }, { n:'J. López', d:true }],
    6:  [{ n:'M. García', d:true }, { n:'P. Martín', d:true }],
    7:  [{ n:'S. Ruiz', d:false }],
    8:  [{ n:'M. García', d:false }],
    9:  [{ n:'J. López', d:false }],
    10: [{ n:'P. Martín', d:false }],
    11: [{ n:'S. Ruiz', d:false }],
    12: [{ n:'M. García', d:true }, { n:'J. López', d:true }],
    13: [{ n:'P. Martín', d:true }, { n:'S. Ruiz', d:true }],
    14: [{ n:'M. García', d:false }],
    15: [{ n:'J. López', d:false }],
    16: [{ n:'S. Ruiz', d:false }],
    17: [{ n:'M. García', d:false }],
    18: [{ n:'P. Martín', d:false }],
    19: [{ n:'J. López', d:true }, { n:'S. Ruiz', d:true }],
    20: [{ n:'M. García', d:true }, { n:'P. Martín', d:true }],
    21: [{ n:'J. López', d:false }],
    22: [{ n:'S. Ruiz', d:false }],
    23: [{ n:'M. García', d:false }],
    24: [{ n:'J. López', d:false }],
    25: [{ n:'P. Martín', d:false }],
    26: [{ n:'S. Ruiz', d:true }, { n:'M. García', d:true }],
    27: [{ n:'J. López', d:true }, { n:'P. Martín', d:true }],
    28: [{ n:'S. Ruiz', d:false }],
    29: [{ n:'M. García', d:false }],
    30: [{ n:'J. López', d:false }],
    31: [{ n:'P. Martín', d:false }],
};

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

// ── Navegación por data-goto ─────────────────────────────────────
function initGotoLinks() {
  document.querySelectorAll('[data-goto]').forEach(el => {
    el.addEventListener('click', () => gotoPage(el.dataset.goto));
  });
}

// ── Inicialización ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {

  // Login
  document.getElementById('login-btn').addEventListener('click', doLogin);
  document.getElementById('login-pass').addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('logout-btn').addEventListener('click', doLogout);

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

  // Filtros del historial
  initHistorialFilters();

  // Botones «Ver» del historial
  initHistoryView();

  // Construir calendario
  buildCalendar();

  // Pre-rellenar las pestañas de resultados con el motor de demo
  if (window.DEMO) DEMO.init();
});
