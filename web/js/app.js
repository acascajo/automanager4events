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
  const user = document.getElementById('login-user').value.trim() || 'prueba';
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
    return {
      // Los eventos, camareros y requisitos llegan en la plantilla; el motor es automático
      email: document.getElementById('catering-email')?.checked || false,
    };
  }
  if (module === 'guardias-send') {
    // Un solo clic establece el periodo completo: el mes, la fecha límite y la
    // distribución de residentes por semana. n8n envía los correos al instante y,
    // con un trigger nocturno, recoge/procesa las respuestas y genera el calendario
    // automáticamente tras la fecha límite.
    const semanas = [...document.querySelectorAll('#guardias-weeks [data-week]')]
      .map(s => ({ semana: Number(s.dataset.week), residentes: Number(s.value) }));
    return {
      mes:      document.getElementById('guardias-mes')?.value      || '',
      deadline: document.getElementById('guardias-deadline')?.value || '',
      semanas,
    };
  }
  if (module === 'software') {
    // Equipo, proyectos y tareas (con todos sus parámetros) vienen en la plantilla
    return {};
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
      if (module === 'guardias-send') {
        // Los correos se envían al instante; n8n procesa de madrugada y genera tras la fecha límite
        setStatus(mensajeSolicitudesEnviadas(false));
        return;
      }
      setStatus('✓ Workflow ejecutado correctamente. Revisa la pestaña Resultados.');
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
  // Catering: 3 hojas (disponibilidad/encuesta, base de datos de camareros, eventos).
  // Las columnas reproducen las hojas reales de Google Sheets del workflow.
  catering: {
    file: 'plantilla_catering.xlsx',
    sheets: [
      ['Disponibilidad', [
        ['fecha_evento', 'telefono', 'nombre', 'disponible', 'tiene_coche', 'observaciones'],
        ['2026-06-20', '672574623', 'Daniel García López', 'SI', 'NO', 'Puedo ir al montaje'],
      ]],
      ['Camareros', [
        ['telefono', 'nombre', 'fecha_alta', 'antiguedad_dias', 'horas_trabajadas', 'nota',
         'fecha_ultimo_evento', 'dias_desde_ultimo_evento', 'num_disponibilidades', 'num_respuestas',
         'ratio_disponibilidad', 'activo', 'verificado', 'score_fiable', 'score_prometedor', 'score_general'],
        ['625031064', 'Alicia Carmona Torres', '2021-04-14', 1970, 339, 9,
         '2026-01-27', 131, 12, 16, 0.74, 'SI', 'SI', 0.95, 0.65, 0.85],
      ]],
      ['Eventos', [
        ['event_id', 'fecha', 'hora_inicio', 'hora_fin', 'tipo', 'nombre_evento', 'ubicacion',
         'asistentes', 'camareros_necesarios', 'estado', 'prioridad', 'observaciones'],
        ['EVT001', '2026-06-20', '17:00', '23:00', 'boda', 'Boda Marta y Carlos', 'Finca Valdemorillo',
         60, 6, 'NEW', 1, ''],
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
        ['persona_id', 'nombre', 'rol', 'seniority', 'skills', 'capacidad_horas', 'disponibilidad', 'observacion'],
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

  // Guardias: residentes por semana + fecha límite según el mes elegido
  const mesSel = document.getElementById('guardias-mes');
  if (mesSel) mesSel.addEventListener('change', buildGuardiasWeeks);
  buildGuardiasWeeks();

  // Tabla de médicos y estado de respuestas (12 residentes)
  renderGuardiasMedicos();

  // Pre-rellenar las pestañas de resultados con el motor de demo
  if (window.DEMO) DEMO.init();
});
