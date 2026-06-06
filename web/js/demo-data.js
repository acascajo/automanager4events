/**
 * demo-data.js — Datos de ejemplo para el modo demo (sin n8n)
 *
 * Las estructuras reproducen el modelo de datos descrito en la memoria del TFG
 * (secciones 3.x «Entradas del sistema»). El motor de demostración
 * (demo-engine.js) ejecuta sobre estos datos la misma lógica de asignación y
 * validación que implementan los workflows de n8n, de forma que la interfaz es
 * plenamente demostrable sin backend.
 */

// ── Catering ──────────────────────────────────────────────────────
// Camareros con métricas de scoring, vehículo y disponibilidad por fecha.
const DEMO_CATERING = {
  camareros: [
    { id: 'CAM-001', nombre: 'Laura García',   email: 'laura@cat.es',   telefono: '600111222', tiene_coche: true,  activo: true, verificado: true, score_fiable: 9.0, score_prometedor: 8.6, score_general: 9.2, nota: 9, observaciones: 'Jefa de sala, prefiere eventos de tarde', disponibilidad: ['2026-07-14', '2026-07-15'] },
    { id: 'CAM-002', nombre: 'Miguel Ruiz',     email: 'miguel@cat.es',  telefono: '600111223', tiene_coche: true,  activo: true, verificado: true, score_fiable: 8.4, score_prometedor: 8.9, score_general: 8.7, nota: 8, observaciones: '',                                   disponibilidad: ['2026-07-14'] },
    { id: 'CAM-003', nombre: 'Ana Soler',       email: 'ana@cat.es',     telefono: '600111224', tiene_coche: false, activo: true, verificado: true, score_fiable: 8.0, score_prometedor: 8.3, score_general: 8.1, nota: 8, observaciones: 'No conduce',                          disponibilidad: ['2026-07-14', '2026-07-15'] },
    { id: 'CAM-004', nombre: 'Javier Pons',     email: 'javier@cat.es',  telefono: '600111225', tiene_coche: true,  activo: true, verificado: true, score_fiable: 7.8, score_prometedor: 8.1, score_general: 7.9, nota: 8, observaciones: '',                                   disponibilidad: ['2026-07-14', '2026-07-15'] },
    { id: 'CAM-005', nombre: 'Carlos Méndez',   email: 'carlos@cat.es',  telefono: '600111226', tiene_coche: true,  activo: true, verificado: true, score_fiable: 7.4, score_prometedor: 7.6, score_general: 7.5, nota: 7, observaciones: '',                                   disponibilidad: ['2026-07-14', '2026-07-15'] },
    { id: 'CAM-006', nombre: 'Sara Gil',        email: 'sara@cat.es',    telefono: '600111227', tiene_coche: false, activo: true, verificado: true, score_fiable: 7.2, score_prometedor: 7.5, score_general: 7.3, nota: 7, observaciones: '',                                   disponibilidad: ['2026-07-14'] },
    { id: 'CAM-007', nombre: 'Diego Romero',    email: 'diego@cat.es',   telefono: '600111228', tiene_coche: true,  activo: true, verificado: true, score_fiable: 7.0, score_prometedor: 6.8, score_general: 6.9, nota: 7, observaciones: '',                                   disponibilidad: ['2026-07-15'] },
    { id: 'CAM-008', nombre: 'Nuria Fernández', email: 'nuria@cat.es',   telefono: '600111229', tiene_coche: false, activo: true, verificado: true, score_fiable: 6.6, score_prometedor: 6.9, score_general: 6.8, nota: 7, observaciones: '',                                   disponibilidad: ['2026-07-15'] },
    // No verificado → debe ser descartado por el filtrado
    { id: 'CAM-009', nombre: 'Pablo Antón',     email: 'pablo@cat.es',   telefono: '600111230', tiene_coche: true,  activo: true, verificado: false, score_fiable: 9.5, score_prometedor: 9.5, score_general: 9.5, nota: 10, observaciones: 'Pendiente de verificar',            disponibilidad: ['2026-07-14', '2026-07-15'] },
    // Inactivo → descartado
    { id: 'CAM-010', nombre: 'Elena Vidal',     email: 'elena@cat.es',   telefono: '600111231', tiene_coche: true,  activo: false, verificado: true, score_fiable: 8.8, score_prometedor: 8.8, score_general: 8.8, nota: 9, observaciones: 'Baja temporal',                     disponibilidad: ['2026-07-14'] },
  ],
  eventos: [
    { id: 'EVT-001', fecha: '2026-07-14', hora_inicio: '19:00', hora_fin: '23:30', tipo: 'Gala',     nombre: 'Gala Empresarial',     ubicacion: 'Madrid Centro',  asistentes: 150, camareros_necesarios: 4, prioridad: 5 },
    { id: 'EVT-002', fecha: '2026-07-14', hora_inicio: '12:00', hora_fin: '16:00', tipo: 'Cóctel',   nombre: 'Cóctel Madrid Norte',  ubicacion: 'Alcobendas',     asistentes: 60,  camareros_necesarios: 2, prioridad: 3 },
    { id: 'EVT-003', fecha: '2026-07-15', hora_inicio: '14:00', hora_fin: '18:00', tipo: 'Banquete', nombre: 'Banquete Leganés',     ubicacion: 'Leganés',        asistentes: 90,  camareros_necesarios: 3, prioridad: 4 },
  ],
};

// ── Guardias médicas ──────────────────────────────────────────────
// Los nombres coinciden con los del calendario (GUARDIAS_JUL_2026) para poder
// cruzar asignaciones con objetivos. no_puedo / preferiria_librar permiten
// ejercer el validador de restricciones blandas.
const DEMO_GUARDIAS = {
  periodo: 'Julio 2026',
  dias_periodo: 31,
  distribucion: { entre_semana: 1, finde_festivo: 2 },
  medicos: [
    { id: 'MED-001', cal: 'M. García', nombre: 'Marta García',  email: 'marta@hosp.es',  anyo: 'R2', rotacion: 'Cardiología',      objetivo: 8,  no_puedo: ['2026-07-10'],              preferiria_librar: ['2026-07-25'] },
    { id: 'MED-002', cal: 'J. López',  nombre: 'Juan López',     email: 'juan@hosp.es',   anyo: 'R1', rotacion: 'Urgencias',        objetivo: 6,  no_puedo: [],                          preferiria_librar: [] },
    { id: 'MED-003', cal: 'S. Ruiz',   nombre: 'Sara Ruiz',      email: 'sara@hosp.es',   anyo: 'R3', rotacion: 'UCI',              objetivo: 10, no_puedo: [],                          preferiria_librar: ['2026-07-26'] },
    { id: 'MED-004', cal: 'P. Martín', nombre: 'Pedro Martín',   email: 'pedro@hosp.es',  anyo: 'R2', rotacion: 'Medicina interna', objetivo: 8,  no_puedo: ['2026-07-09'],              preferiria_librar: [] },
  ],
};

// ── Proyectos software ────────────────────────────────────────────
// Equipo, proyectos y tareas. Las dependencias y la capacidad permiten
// ejercer el motor heurístico, las advertencias y las recomendaciones.
const DEMO_SOFTWARE = {
  equipo: [
    { id: 'DEV-001', nombre: 'Alejandro Vega',  rol: 'Backend',  seniority: 'senior', habilidades: ['node.js', 'rest', 'docker', 'github actions'], capacidad: 40, disponible: true, observaciones: 'Lidera el equipo de API' },
    { id: 'DEV-002', nombre: 'Isabel Romero',   rol: 'Security', seniority: 'senior', habilidades: ['security', 'oauth', 'node.js'],                capacidad: 32, disponible: true, observaciones: 'Especialista en autenticación' },
    { id: 'DEV-003', nombre: 'Diego Marín',     rol: 'Data',     seniority: 'mid',    habilidades: ['sql', 'postgres', 'python'],                   capacidad: 40, disponible: true, observaciones: '' },
    { id: 'DEV-004', nombre: 'Nuria Fuentes',   rol: 'QA',       seniority: 'mid',    habilidades: ['jest', 'testing', 'cypress'],                  capacidad: 24, disponible: true, observaciones: 'Buen ojo para edge cases' },
    { id: 'DEV-005', nombre: 'Hugo Salas',      rol: 'Frontend', seniority: 'junior', habilidades: ['react', 'css', 'jest'],                        capacidad: 40, disponible: false, observaciones: 'De vacaciones esta semana' },
  ],
  proyectos: [
    { id: 'PRJ-001', nombre: 'Plataforma de pagos', cliente: 'Banco X', prioridad: 5, fecha_inicio: '2026-07-01', deadline: '2026-08-15', estado: 'activo', horas_estimadas: 320 },
  ],
  tareas: [
    { id: 'TSK-001', proyecto: 'PRJ-001', nombre: 'Refactor API Gateway',   descripcion: 'Rediseño del gateway de pagos',     skills: ['node.js', 'rest'],     horas: 20, prioridad: 4, deadline: '2026-07-30', dependencias: [],          persona_preferida: 'DEV-001' },
    { id: 'TSK-002', proyecto: 'PRJ-001', nombre: 'Auth con OAuth2',        descripcion: 'Login federado y tokens',           skills: ['security', 'oauth'],   horas: 24, prioridad: 5, deadline: '2026-07-28', dependencias: [],          persona_preferida: '' },
    { id: 'TSK-003', proyecto: 'PRJ-001', nombre: 'Migración base de datos', descripcion: 'Paso a Postgres particionado',      skills: ['sql', 'postgres'],     horas: 32, prioridad: 4, deadline: '2026-08-05', dependencias: [],          persona_preferida: '' },
    { id: 'TSK-004', proyecto: 'PRJ-001', nombre: 'Tests de integración',   descripcion: 'Suite end-to-end del flujo de pago', skills: ['jest', 'testing'],    horas: 18, prioridad: 3, deadline: '2026-08-10', dependencias: ['TSK-001'], persona_preferida: '' },
    { id: 'TSK-005', proyecto: 'PRJ-001', nombre: 'CI/CD pipeline',         descripcion: 'Automatizar build y despliegue',    skills: ['docker', 'github actions'], horas: 16, prioridad: 3, deadline: '2026-08-12', dependencias: [],     persona_preferida: '' },
    { id: 'TSK-006', proyecto: 'PRJ-001', nombre: 'Dashboard de métricas',  descripcion: 'Panel React de observabilidad',     skills: ['react', 'css'],        horas: 22, prioridad: 2, deadline: '2026-08-14', dependencias: [],          persona_preferida: 'DEV-005' },
    // Tarea grande sin candidato con capacidad suficiente → recomendación de división
    { id: 'TSK-007', proyecto: 'PRJ-001', nombre: 'Motor de conciliación',  descripcion: 'Cálculo masivo de conciliación bancaria', skills: ['python', 'sql'], horas: 60, prioridad: 4, deadline: '2026-08-15', dependencias: [], persona_preferida: '' },
  ],
};
