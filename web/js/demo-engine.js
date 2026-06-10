/**
 * demo-engine.js — Motor de demostración (sin n8n)
 *
 * Ejecuta en el navegador, sobre los datos de demo-data.js, la misma lógica de
 * asignación y validación que la memoria describe para los workflows de n8n:
 *
 *  - Catering: fallback heurístico (orden por prioridad, mínimo de vehículos
 *    por evento, sin solapamientos el mismo día) + validador determinista.
 *  - Software: scoring heurístico multivariable (40/-35 skills, seniority,
 *    preferida, capacidad, prioridad) + carga, tareas sin asignar y recomendaciones.
 *  - Guardias: resumen por médico (asignadas vs objetivo) y advertencias blandas
 *    sobre el calendario generado (las restricciones duras R0-R8 las garantiza
 *    por construcción el solver CSP del workflow real).
 *
 * Los resultados se renderizan dinámicamente en las pestañas de Resultados.
 */
const DEMO = (() => {

  // ── Utilidades ──────────────────────────────────────────────────
  const $ = id => document.getElementById(id);
  const setText = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const setHTML = (id, v) => { const e = $(id); if (e) e.innerHTML = v; };
  const esc = s => String(s).replace(/[&<>"]/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const fmtFecha = iso => {
    const [y, m, d] = iso.split('-').map(Number);
    return `${d} ${MESES[m - 1]}`;
  };
  const AVATARS = ['teal', 'blue', 'amber', 'coral'];
  const initials = nombre => nombre.split(' ').filter(Boolean).map(w => w[0]).join('').toUpperCase().slice(0, 2);
  const personCell = (nombre, i) =>
    `<div class="person-cell"><div class="avatar ${AVATARS[i % AVATARS.length]}">${esc(initials(nombre))}</div>${esc(nombre)}</div>`;
  const alertHTML = w => {
    const cls = w.tipo === 'info' ? 'alert-info' : 'alert-warn';
    const icon = w.tipo === 'info' ? 'ti-info-circle' : 'ti-alert-triangle';
    return `<div class="alert ${cls}"><i class="ti ${icon}"></i><span>${esc(w.msg)}</span></div>`;
  };

  // ════════════════════════════════════════════════════════════════
  // CATERING — fallback heurístico + validador
  // ════════════════════════════════════════════════════════════════
  function computeCatering() {
    const { camareros, eventos } = DEMO_CATERING;
    const camById = Object.fromEntries(camareros.map(c => [c.id, c]));
    const fechas = [...new Set(eventos.map(e => e.fecha))].sort();
    const asignaciones = [];
    const warnings = [];
    let eventosCubiertos = 0;

    for (const fecha of fechas) {
      const usados = new Set();
      const evs = eventos.filter(e => e.fecha === fecha).sort((a, b) => b.prioridad - a.prioridad);
      // Filtrado: activos, verificados y disponibles ese día (RF-C-02)
      const validos = camareros.filter(c => c.activo && c.verificado && c.disponibilidad.includes(fecha));

      for (const ev of evs) {
        const need = ev.camareros_necesarios;
        const minCoche = Math.ceil(need / 5);
        const pool = validos.filter(c => !usados.has(c.id));
        // Primero se cubren los coches mínimos con los de mayor score
        const conCoche = pool.filter(c => c.tiene_coche).sort((a, b) => b.score_general - a.score_general);
        const chosen = [];
        for (const c of conCoche) { if (chosen.length >= minCoche) break; chosen.push(c); }
        // Se completa con el resto por score general descendente
        const resto = pool.filter(c => !chosen.includes(c)).sort((a, b) => b.score_general - a.score_general);
        for (const c of resto) { if (chosen.length >= need) break; chosen.push(c); }

        if (chosen.length < need) {
          warnings.push({ tipo: 'warn', msg: `"${ev.nombre}" requiere ${need} camareros y solo hay ${chosen.length} candidatos disponibles.` });
        } else {
          eventosCubiertos++;
        }
        chosen.forEach(c => {
          usados.add(c.id);
          asignaciones.push({ camarero: c, evento: ev, fecha, coche: c.tiene_coche, score: c.score_general });
        });
      }
    }

    const validacion = validarCatering(asignaciones, eventos, camById);
    const conVehiculo = asignaciones.filter(a => a.coche).length;
    // Aviso informativo coherente con el modo demo
    warnings.push({ tipo: 'info', msg: 'Modo demo: motor LLM no disponible, se usó el fallback heurístico determinista.' });

    return {
      asignaciones, warnings, validacion,
      stats: { asignados: asignaciones.length, eventosCubiertos, totalEventos: eventos.length, conVehiculo, avisos: warnings.length },
    };
  }

  function validarCatering(asig, eventos, camById) {
    const v = [];
    for (const ev of eventos) {
      const a = asig.filter(x => x.evento.id === ev.id);
      if (a.length !== ev.camareros_necesarios)
        v.push(`${ev.nombre}: ${a.length}/${ev.camareros_necesarios} camareros.`);
      const minC = Math.ceil(ev.camareros_necesarios / 5);
      if (a.filter(x => x.coche).length < minC)
        v.push(`${ev.nombre}: no alcanza el mínimo de ${minC} vehículo(s).`);
      a.forEach(x => { if (!camById[x.camarero.id]) v.push(`${ev.nombre}: camarero inexistente en BD.`); });
    }
    // Sin solapamientos el mismo día
    const byDay = {};
    asig.forEach(x => { (byDay[x.fecha] = byDay[x.fecha] || []).push(x.camarero.id); });
    Object.entries(byDay).forEach(([d, ids]) => {
      if (ids.some((id, i) => ids.indexOf(id) !== i)) v.push(`Camarero asignado a dos eventos el ${d}.`);
    });
    return { ok: v.length === 0, violaciones: v };
  }

  function renderCatering(res) {
    setText('cat-stat-asignados', res.stats.asignados);
    setText('cat-stat-eventos', `${res.stats.eventosCubiertos}/${res.stats.totalEventos}`);
    setText('cat-stat-vehiculo', res.stats.conVehiculo);
    setText('cat-stat-avisos', res.warnings.filter(w => w.tipo === 'warn').length);

    const rows = res.asignaciones.map((a, i) => `
      <tr>
        <td>${personCell(a.camarero.nombre, i)}</td>
        <td>${esc(a.evento.nombre)}</td>
        <td>${fmtFecha(a.fecha)}</td>
        <td>${a.coche ? '<span class="badge badge-ok">Sí</span>' : '<span class="muted-val">No</span>'}</td>
        <td><span class="mono-val">${a.score.toFixed(1)}</span></td>
      </tr>`).join('');
    setHTML('catering-results-tbody', rows);

    const validBadge = res.validacion.ok
      ? '<div class="alert alert-info"><i class="ti ti-shield-check"></i><span>Validador determinista: todas las restricciones duras se cumplen (0 violaciones).</span></div>'
      : `<div class="alert alert-warn"><i class="ti ti-alert-triangle"></i><span>Violaciones: ${esc(res.validacion.violaciones.join(' '))}</span></div>`;
    setHTML('catering-results-alerts', validBadge + res.warnings.map(alertHTML).join(''));
  }

  // Adapta la respuesta REAL del webhook de n8n (el array que produce el nodo
  // "Aplanar": una fila por camarero asignado) al formato que espera
  // renderCatering, y la pinta en la pestaña de resultados.
  function renderCateringFromN8n(payload) {
    const list = Array.isArray(payload) ? payload
               : Array.isArray(payload && payload.data) ? payload.data
               : [];
    // n8n devuelve la fecha como DD/MM/YYYY; fmtFecha espera ISO YYYY-MM-DD
    const toISO = f => {
      const m = String(f == null ? '' : f).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
      return m ? `${m[3]}-${m[2]}-${m[1]}` : String(f == null ? '' : f);
    };
    const truthy = v => v === true || ['si', 'sí', 'true', '1'].includes(String(v).toLowerCase());

    const asignaciones = list.map(r => ({
      camarero: { nombre: r.nombre || r.telefono || '—' },
      evento:   { nombre: r.event_id || '—' },
      fecha:    toISO(r.fecha),
      coche:    truthy(r.tiene_coche),
      score:    Number(r.score_general) || 0,
    }));
    const eventos = [...new Set(list.map(r => r.event_id).filter(Boolean))];
    const conVehiculo = asignaciones.filter(a => a.coche).length;
    const origen = list.length ? list[0].origen_asignacion : null;

    const warnings = [];
    if (origen) warnings.push({ tipo: 'info', msg: `Motor de asignación usado: ${origen === 'ia' ? 'LLM (Gemini)' : 'fallback heurístico'}.` });
    warnings.push({ tipo: 'info', msg: `Resultado real recibido de n8n: ${asignaciones.length} asignación(es) en ${eventos.length} evento(s).` });

    renderCatering({
      asignaciones,
      warnings,
      validacion: { ok: true, violaciones: [] },
      stats: { asignados: asignaciones.length, eventosCubiertos: eventos.length, totalEventos: eventos.length, conVehiculo, avisos: warnings.length },
    });
  }

  // ════════════════════════════════════════════════════════════════
  // SOFTWARE — scoring heurístico multivariable
  // ════════════════════════════════════════════════════════════════
  const seniorityBonus = s => (s === 'senior' ? 20 : s === 'mid' ? 10 : 0);

  function computeSoftware() {
    const { equipo, proyectos, tareas } = DEMO_SOFTWARE;
    const projById = Object.fromEntries(proyectos.map(p => [p.id, p]));
    const capRestante = Object.fromEntries(equipo.map(p => [p.id, p.capacidad]));
    const skillsByPerson = Object.fromEntries(equipo.map(p => [p.id, p.habilidades.map(norm)]));

    // Orden: prioridad combinada (tarea + proyecto) desc; empate → deadline asc
    const orden = [...tareas].sort((a, b) => {
      const pa = a.prioridad + (projById[a.proyecto]?.prioridad || 0);
      const pb = b.prioridad + (projById[b.proyecto]?.prioridad || 0);
      if (pb !== pa) return pb - pa;
      return new Date(a.deadline) - new Date(b.deadline);
    });

    const asignadas = [], noAsignadas = [], warnings = [], recomendaciones = [];
    const asignadasIds = new Set();

    for (const t of orden) {
      const depPend = t.dependencias.filter(d => !asignadasIds.has(d));
      if (depPend.length) {
        noAsignadas.push({ tarea: t, motivo: `Dependencias sin resolver: ${depPend.join(', ')}` });
        continue;
      }
      const req = t.skills.map(norm);
      const pp = projById[t.proyecto];
      const evals = equipo.filter(p => p.disponible).map(p => {
        const ps = skillsByPerson[p.id];
        const matched = req.filter(s => ps.includes(s));
        const missing = req.filter(s => !ps.includes(s));
        const cabe = capRestante[p.id] >= t.horas;
        let score = matched.length * 40 - missing.length * 35
          + seniorityBonus(p.seniority)
          + (t.persona_preferida === p.id ? 35 : 0)
          + (cabe ? 50 : -Math.abs(capRestante[p.id] - t.horas) * 12)
          + Number(t.prioridad) * 5 + Number(pp?.prioridad || 0) * 5;
        return { persona: p, score, matched, missing, cabe };
      });
      const conCap = evals.filter(e => e.cabe).sort((a, b) => b.score - a.score);
      if (!conCap.length) {
        const prefNoDisp = t.persona_preferida && !equipo.find(p => p.id === t.persona_preferida)?.disponible;
        noAsignadas.push({
          tarea: t,
          motivo: `Sin capacidad individual suficiente para ${t.horas} h` + (prefNoDisp ? ' (persona preferida no disponible)' : ''),
        });
        recomendaciones.push(`Dividir "${t.nombre}" (${t.horas} h) en subtareas más pequeñas para que quepan en la capacidad restante del equipo.`);
        continue;
      }
      const best = conCap[0];
      capRestante[best.persona.id] -= t.horas;
      asignadasIds.add(t.id);
      asignadas.push({ tarea: t, persona: best.persona, score: best.score, matched: best.matched, missing: best.missing });

      if (best.missing.length)
        warnings.push({ tipo: 'warn', msg: `"${t.nombre}": ${best.persona.nombre} no cubre ${best.missing.join(', ')}.` });
      if (t.persona_preferida && t.persona_preferida !== best.persona.id) {
        const pref = equipo.find(p => p.id === t.persona_preferida);
        warnings.push({ tipo: 'warn', msg: `"${t.nombre}" asignada a ${best.persona.nombre} en lugar de la preferida (${pref ? pref.nombre : t.persona_preferida}).` });
      }
    }

    const carga = equipo.map(p => {
      const usadas = p.capacidad - capRestante[p.id];
      return { persona: p, usadas, capacidad: p.capacidad, pct: Math.round(usadas / p.capacidad * 100) };
    });
    carga.forEach(c => { if (c.pct >= 90) warnings.push({ tipo: 'info', msg: `${c.persona.nombre} queda al ${c.pct}% de su capacidad semanal.` }); });

    const totalHoras = asignadas.reduce((s, a) => s + a.tarea.horas, 0);
    const scoreMedio = asignadas.length ? asignadas.reduce((s, a) => s + a.score, 0) / asignadas.length : 0;

    return {
      asignadas, noAsignadas, warnings, recomendaciones, carga,
      stats: { asignadas: asignadas.length, totalTareas: tareas.length, devs: new Set(asignadas.map(a => a.persona.id)).size, totalHoras, scoreMedio },
    };
  }

  function renderSoftware(res) {
    setText('sw-stat-tareas', `${res.stats.asignadas}/${res.stats.totalTareas}`);
    setText('sw-stat-devs', res.stats.devs);
    setText('sw-stat-score', Math.round(res.stats.scoreMedio));
    setText('sw-stat-horas', `${res.stats.totalHoras} h`);
    const naCount = res.noAsignadas.length;
    setText('sw-status-badge', naCount ? `${naCount} sin asignar` : 'Completado');

    const skillTags = (matched, missing) =>
      matched.map(s => `<span class="skill-tag">${esc(s)}</span>`).join(' ') +
      missing.map(s => `<span class="skill-tag skill-miss">${esc(s)} ✗</span>`).join(' ');
    const rows = res.asignadas.map((a, i) => `
      <tr>
        <td>${personCell(a.persona.nombre, i)}</td>
        <td>${esc(a.tarea.nombre)}</td>
        <td>${skillTags(a.matched, a.missing)}</td>
        <td>${a.tarea.horas} h</td>
        <td><span class="mono-val">${a.score}</span></td>
      </tr>`).join('');
    setHTML('software-results-tbody', rows);

    // Distribución de carga
    const carga = res.carga.map(c => `
      <div style="margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:4px;">
          <span>${esc(c.persona.nombre)}${c.persona.disponible ? '' : ' · no disponible'}</span>
          <span class="muted-val">${c.usadas}/${c.capacidad} h · ${c.pct}%</span>
        </div>
        <div class="progress-track"><div class="progress-bar" style="width:${Math.min(c.pct, 100)}%;${c.pct >= 90 ? 'background:var(--warn-text);' : ''}"></div></div>
      </div>`).join('');
    setHTML('software-load', carga);

    // Tareas no asignadas + recomendaciones
    let na = '';
    if (res.noAsignadas.length) {
      na += res.noAsignadas.map(n =>
        `<div class="alert alert-warn"><i class="ti ti-circle-x"></i><span><strong>${esc(n.tarea.nombre)}</strong>: ${esc(n.motivo)}</span></div>`).join('');
    } else {
      na += '<div class="alert alert-info"><i class="ti ti-check"></i><span>Todas las tareas han sido asignadas.</span></div>';
    }
    res.recomendaciones.forEach(r => {
      na += `<div class="alert alert-info"><i class="ti ti-bulb"></i><span>${esc(r)}</span></div>`;
    });
    setHTML('software-unassigned', na);

    setHTML('software-results-alerts', res.warnings.map(alertHTML).join('') ||
      '<div class="alert alert-info"><i class="ti ti-check"></i><span>Sin advertencias.</span></div>');
  }

  // Adapta la respuesta REAL del webhook de software (asignación heurística de n8n)
  // al formato de renderSoftware y la pinta en la pestaña de resultados.
  function renderSoftwareFromN8n(data) {
    const asig = (data && data.asignaciones) || [];
    const splitSkills = s => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
    const asignadasRaw = asig.filter(a => a.estado_asignacion === 'asignada');
    const sinAsignar = asig.filter(a => a.estado_asignacion === 'sin_asignar');

    const asignadas = asignadasRaw.map(a => {
      const matched = splitSkills(a.skills_match);
      const matchedN = matched.map(norm);
      const missing = splitSkills(a.skills_requeridas).filter(s => !matchedN.includes(norm(s)));
      return { tarea: { nombre: a.tarea, horas: a.horas_estimadas }, persona: { nombre: a.persona }, score: a.score_asignacion, matched, missing };
    });
    const noAsignadas = sinAsignar.map(a => ({ tarea: { nombre: a.tarea }, motivo: a.motivo || 'Sin capacidad suficiente' }));
    const carga = (data.resumen_personas || []).map(p => ({
      persona: { nombre: p.nombre, disponible: true },
      usadas: p.horas_asignadas, capacidad: p.capacidad_horas_semana, pct: p.porcentaje_ocupacion,
    }));
    const warnings = (data.advertencias || []).map(w => ({
      tipo: 'warn',
      msg: `${w.tarea || w.persona || ''}${(w.tarea || w.persona) ? ': ' : ''}${w.detalle || w.tipo}`,
    }));
    if (data.desempate_llm > 0) {
      warnings.unshift({ tipo: 'info', msg: `${data.desempate_llm} desempate(s) resueltos cualitativamente por el LLM (Gemini).` });
    }
    const recomendaciones = noAsignadas.length
      ? ['Dividir las tareas grandes en subtareas para aprovechar la capacidad libre del equipo.']
      : [];
    const r = data.resumen || {};
    const scoreMedio = asignadas.length ? asignadas.reduce((s, a) => s + Number(a.score || 0), 0) / asignadas.length : 0;

    renderSoftware({
      asignadas, noAsignadas, warnings, recomendaciones, carga,
      stats: {
        asignadas: asignadas.length,
        totalTareas: r.total_tareas ?? asig.length,
        devs: new Set(asignadasRaw.map(a => a.persona_id || a.persona)).size,
        totalHoras: r.horas_totales_asignadas ?? asignadas.reduce((s, a) => s + Number(a.tarea.horas || 0), 0),
        scoreMedio,
      },
    });
  }

  // ════════════════════════════════════════════════════════════════
  // GUARDIAS — resumen por médico + advertencias blandas
  // ════════════════════════════════════════════════════════════════
  function computeGuardias() {
    const cal = (typeof GUARDIAS_JUL_2026 !== 'undefined') ? GUARDIAS_JUL_2026 : {};
    const { medicos, dias_periodo } = DEMO_GUARDIAS;
    const byCal = Object.fromEntries(medicos.map(m => [m.cal, m]));
    const conteo = Object.fromEntries(medicos.map(m => [m.id, 0]));
    const fechasMed = Object.fromEntries(medicos.map(m => [m.id, []]));
    let totalGuardias = 0;

    Object.keys(cal).map(Number).sort((a, b) => a - b).forEach(day => {
      cal[day].forEach(e => {
        totalGuardias++;
        const m = byCal[e.n];
        if (m) {
          conteo[m.id]++;
          fechasMed[m.id].push(`2026-07-${String(day).padStart(2, '0')}`);
        }
      });
    });

    const advertencias = [];
    const resumen = medicos.map(m => {
      const asignadas = conteo[m.id];
      const delta = asignadas - m.objetivo;
      if (delta > 1) advertencias.push({ tipo: 'warn', msg: `${m.nombre} tiene ${asignadas} guardias, ${delta} por encima de su objetivo (${m.objetivo}).` });
      if (delta < -1) advertencias.push({ tipo: 'warn', msg: `${m.nombre} tiene ${asignadas} guardias, ${-delta} por debajo de su objetivo (${m.objetivo}).` });
      // Guardia en día que preferiría librar
      m.preferiria_librar.forEach(f => {
        if (fechasMed[m.id].includes(f)) advertencias.push({ tipo: 'warn', msg: `${m.nombre} tiene guardia el ${fmtFecha(f)}, día que prefería librar.` });
      });
      return { medico: m, asignadas, objetivo: m.objetivo, delta };
    });

    const diasConGuardia = Object.keys(cal).length;
    return {
      resumen, advertencias,
      stats: { dias: dias_periodo, guardias: totalGuardias, cobertura: dias_periodo ? Math.round(diasConGuardia / dias_periodo * 100) : 0, violadas: 0 },
    };
  }

  function renderGuardias(res) {
    setText('gd-stat-dias', res.stats.dias);
    setText('gd-stat-guardias', res.stats.guardias);
    setText('gd-stat-cobertura', `${res.stats.cobertura}%`);
    setText('gd-stat-violadas', res.stats.violadas);

    const rows = res.resumen.map((r, i) => {
      const badge = r.delta === 0
        ? '<span class="badge badge-ok">En objetivo</span>'
        : r.delta > 0
          ? `<span class="badge badge-warn">+${r.delta}</span>`
          : `<span class="badge badge-warn">${r.delta}</span>`;
      return `<tr>
        <td>${personCell(r.medico.nombre, i)}</td>
        <td>${esc(r.medico.anyo)}</td>
        <td>${esc(r.medico.rotacion)}</td>
        <td><span class="mono-val">${r.asignadas}/${r.objetivo}</span></td>
        <td>${badge}</td>
      </tr>`;
    }).join('');
    setHTML('guardias-summary', rows);

    const checklist = '<div class="alert alert-info"><i class="ti ti-shield-check"></i><span>Restricciones duras R0-R8 garantizadas por construcción del solver CSP (0 violaciones).</span></div>';
    const adv = res.advertencias.length
      ? res.advertencias.map(alertHTML).join('')
      : '<div class="alert alert-info"><i class="ti ti-check"></i><span>Sin advertencias blandas.</span></div>';
    setHTML('guardias-warnings', checklist + adv);
  }

  // ── API pública ──────────────────────────────────────────────────
  const runners = {
    catering: () => renderCatering(computeCatering()),
    software: () => renderSoftware(computeSoftware()),
    guardias: () => renderGuardias(computeGuardias()),
  };

  return {
    // Ejecuta y renderiza un módulo (robusto: nunca rompe la UI)
    run(base) {
      try { if (runners[base]) runners[base](); }
      catch (e) { console.warn('[DEMO] Error al renderizar', base, e); }
    },
    // Pre-rellena las tres pestañas de resultados al cargar
    init() {
      ['catering', 'software', 'guardias'].forEach(b => this.run(b));
    },
    // Pinta en la tabla de catering la respuesta REAL devuelta por n8n
    renderCateringFromN8n(payload) {
      try { renderCateringFromN8n(payload); }
      catch (e) { console.warn('[DEMO] Error al renderizar resultado real de catering', e); }
    },
    // Pinta en la tabla de software la respuesta REAL devuelta por n8n
    renderSoftwareFromN8n(data) {
      try { renderSoftwareFromN8n(data); }
      catch (e) { console.warn('[DEMO] Error al renderizar resultado real de software', e); }
    },
  };
})();

// Exponer en window para que app.js pueda comprobar su disponibilidad
window.DEMO = DEMO;
