# SmartAssign — Plataforma de automatización de asignación de recursos

> Trabajo Fin de Grado · Pablo Albendea Obispo  
> Doble Grado Ingeniería Informática + ADE · Universidad Carlos III de Madrid  
> Tutor: Alberto Cascajo García · EPS Leganés, 2026

---

## ¿Qué es SmartAssign?

SmartAssign es una plataforma modular para la **automatización y optimización de procesos de asignación de recursos en entornos empresariales**. Nació de la observación directa de un problema que se repite en sectores muy distintos: la asignación de personas a tareas, turnos o eventos. Un proceso que en apariencia es simple pero que en la práctica consume tiempo, genera errores y escala muy mal cuando crece el número de personas o necesidades.

La motivación vino de tres casos reales y cercanos:

- **Catering**: trabajando en una empresa de catering, la asignación de camareros a eventos se hacía completamente a mano, revisando encuestas, verificando vehículos, valorando experiencia y comunicando por WhatsApp. El mismo proceso completo para cada nuevo evento.
- **Guardias médicas**: un familiar médico residente describió la carga mensual de planificar guardias teniendo en cuenta disponibilidades, restricciones de descanso, preferencias, años de residencia y cobertura obligatoria de cada día.
- **Proyectos software**: la experiencia en prácticas en Accenture Strategy evidenció cómo la asignación de tareas a desarrolladores —teniendo en cuenta habilidades, carga, prioridades y dependencias— se sigue haciendo en gran medida de forma manual.

Los tres casos, aparentemente muy distintos, comparten la misma estructura abstracta: un conjunto de **recursos humanos** con restricciones y características propias, un conjunto de **necesidades que cubrir** y un conjunto de **reglas** que gobiernan qué asignaciones son válidas. La plataforma demuestra que es posible automatizar ese patrón en múltiples dominios con una infraestructura común.

---

## Arquitectura del sistema

SmartAssign combina cuatro capas tecnológicas:

- **n8n** — orquestador de workflows. Cada caso de uso se implementa como un conjunto de workflows independientes con nodos de JavaScript, integraciones con Google Sheets, Gmail y la API de Gemini.
- **Google Gemini** — modelo de lenguaje. Se usa donde el razonamiento no estructurado aporta valor real: asignación de camareros, extracción de disponibilidades de correos en texto libre y scoring cualitativo de encaje persona-tarea.
- **Google Sheets** — capa de persistencia del prototipo. Cada ejecución genera una pestaña identificada con timestamp y hash, lo que permite trazabilidad y comparación entre soluciones.
- **Gmail API** — canal de comunicación bidireccional. Se usa para solicitar disponibilidades a los médicos y para notificar las asignaciones a los camareros.
- **Interfaz web** (este repositorio) — capa de presentación. El único punto de contacto del usuario con el sistema. Oculta completamente n8n, los workflows y las hojas de cálculo.

---

## Módulos de la plataforma

### Módulo 1 — Catering

**Problema que resuelve**: automatizar la asignación de camareros a eventos de catering, considerando disponibilidad, experiencia, vehículo propio y restricciones de solapamiento.

**Flujo completo**:
1. El usuario descarga la plantilla Excel (3 hojas: disponibilidades, base de datos de camareros con scoring, eventos y requisitos).
2. La rellena y la sube desde la interfaz web.
3. El sistema normaliza los datos y los vuelca en Google Sheets.
4. El motor de asignación (LLM con fallback heurístico) genera las asignaciones maximizando el score global.
5. Un validador determinista comprueba todas las restricciones duras.
6. Si el LLM viola alguna restricción, el fallback heurístico garantiza siempre una solución válida.
7. Se notifica a cada camarero asignado por correo con los detalles del evento.

**Restricciones duras que se garantizan**:
- El camarero debe estar activo, verificado y disponible.
- Cada evento recibe exactamente el número de camareros requerido.
- Al menos ⌈n/5⌉ camareros asignados por evento tienen vehículo propio.
- Un camarero no puede estar asignado a dos eventos el mismo día.

**Optimización blanda**: maximizar la suma del `score_general` de los camareros asignados; priorizar eventos de mayor prioridad ante escasez de candidatos.

---

### Módulo 2 — Guardias médicas

**Problema que resuelve**: planificación mensual de guardias de médicos residentes con cobertura completa y respeto de restricciones de descanso, preferencias y nivel de residencia.

**Flujo completo** (3 workflows independientes):

**Workflow 1 — Envío de solicitudes**:
- El usuario configura el periodo (mes, fecha límite, distribución de guardias por día).
- El sistema identifica los médicos activos y envía correos personalizados según su año de residencia, solicitando disponibilidades, preferencias, rotación clínica y objetivos de guardias.

**Workflow 2 — Recogida de respuestas**:
- El sistema lee los correos de respuesta entrantes, valida que el remitente pertenece a un médico activo y los agrupa por persona.
- Gemini interpreta el texto libre de cada respuesta y extrae una estructura normalizada: días no disponibles, días preferidos para librar, si acepta dobletes, objetivo de guardias, rotación externa, etc.
- Los datos se almacenan en Google Sheets para el siguiente paso.

**Workflow 3 — Generación del calendario**:
- Un solver CSP propio (backtracking con forward checking, heurísticas MRV y LCV, branch and bound con límite de tiempo) genera el calendario mensual completo.
- Se usa CSP en lugar de LLM porque las restricciones duras son numerosas y el LLM produce asignaciones que las violan con frecuencia.
- Un validador independiente confirma que no hay ninguna violación antes de aceptar la solución.
- Se genera un informe en Markdown con el calendario, resumen por médico, grado de cumplimiento de objetivos y advertencias.
- La solución se persiste con timestamp y hash en una pestaña de Google Sheets.

**Restricciones duras (R1-R8)**:
- R1: el médico debe estar en la lista de candidatos válidos para esa guardia.
- R2: el médico no puede tener ese día en su lista de días no disponibles.
- R3: no puede haber dos asignaciones del mismo médico en la misma guardia.
- R4: no puede haber guardias en días consecutivos.
- R5: no puede haber guardias con dos días de diferencia salvo doblete pre-acordado.
- R6: cada día del periodo debe quedar cubierto con el número de guardias requerido (cobertura obligatoria).
- R7: en guardias dobles no pueden coincidir dos médicos R2.
- R8: un médico R2 no puede hacer una guardia unipersonal.

**Optimización blanda**: aproximar el número de guardias al objetivo de cada médico; penalizar asignaciones en días preferidos para librar; garantizar al menos una guardia por médico.

---

### Módulo 3 — Proyectos software

**Problema que resuelve**: asignación de tareas a miembros de un equipo de desarrollo maximizando el encaje de habilidades y respetando capacidad horaria, dependencias y prioridades.

**Flujo completo**:
1. El usuario descarga la plantilla Excel (3 hojas: equipo con habilidades y capacidad, proyectos activos, tareas con skills requeridas y dependencias).
2. La sube desde la interfaz.
3. El sistema lee en paralelo las tres hojas y normaliza las entidades.
4. Para cada tarea, el motor heurístico evalúa a los candidatos según encaje de skills, seniority, capacidad disponible, prioridad y deadline.
5. Cuando el scoring heurístico produce empate o diferencia reducida, Gemini evalúa cualitativamente el encaje entre el perfil completo del candidato y la descripción de la tarea.
6. Las tareas bloqueadas por dependencias no resueltas se dejan pendientes con su motivo.
7. Se genera un informe con asignaciones, tareas no asignadas, distribución de carga y recomendaciones.

**Restricciones duras**:
- La persona asignada debe estar disponible.
- Debe tener capacidad horaria suficiente para absorber las horas estimadas.
- Las tareas con dependencias no resueltas no se asignan.

**Optimización blanda**: maximizar el encaje de skills; respetar la persona preferida indicada en la tarea; priorizar seniority alto para tareas críticas; distribuir carga de forma equilibrada.

---

## Decisiones técnicas clave

**¿Por qué LLM en catering pero CSP en guardias?**  
El LLM funciona bien cuando el espacio de soluciones válidas es amplio (pocos camareros, pocas restricciones duras). En guardias, las 8 restricciones duras y la cobertura obligatoria de cada día del mes generan un espacio muy estrecho donde el LLM viola restricciones con frecuencia. El solver CSP garantiza por construcción que la solución es siempre válida.

**¿Por qué validadores deterministas en todos los módulos?**  
Tanto el LLM como el motor heurístico son probabilísticos: pueden producir salidas incorrectas. La arquitectura de la plataforma separa el motor de asignación del validador: ninguna solución se acepta sin pasar por el validador determinista correspondiente.

**¿Por qué Google Sheets como persistencia?**  
Decisión de prototipado. Facilita la depuración, ofrece visibilidad inmediata de los datos y tiene integración nativa con n8n. En una versión productiva, se sustituiría por una base de datos relacional.

**¿Por qué n8n y no una solución propia?**  
n8n combina interfaz visual con capacidad de ejecutar JavaScript arbitrario en nodos, lo que permite implementar algoritmos complejos (el solver CSP, los validadores, los generadores de informes) directamente en el flujo sin infraestructura adicional.

---

## Requisitos del sistema

### Funcionales implementados

| ID | Descripción |
|----|-------------|
| RF-C-01 | Carga y normalización de datos de eventos y camareros |
| RF-C-02 | Filtrado automático de camareros inválidos |
| RF-C-03 | Asignación automática maximizando score global |
| RF-C-04 | Validación de restricciones duras del módulo de catering |
| RF-C-05 | Fallback heurístico cuando el LLM no supera la validación |
| RF-G-01 | Envío automático de solicitudes de disponibilidad personalizadas |
| RF-G-02 | Lectura automática de respuestas por correo |
| RF-G-03 | Extracción estructurada de disponibilidad desde texto libre (LLM) |
| RF-G-04 | Generación automática del calendario mensual (solver CSP) |
| RF-G-05 | Cumplimiento garantizado de las 8 restricciones duras de guardias |
| RF-G-06 | Generación de informe completo con calendario, resumen y advertencias |
| RF-S-01 | Carga y normalización de equipo, proyectos y tareas |
| RF-S-02 | Cálculo del score de encaje heurístico persona-tarea |
| RF-S-03 | Asignación respetando disponibilidad, capacidad y dependencias |
| RF-S-04 | Generación de advertencias, tareas no asignadas y recomendaciones |
| RF-P-01 | Interfaz web unificada para los tres módulos |
| RF-P-02 | Lanzamiento de workflows desde la interfaz, con visualización de resultados |
| RF-P-03 | Persistencia de resultados en Google Sheets con trazabilidad por ejecución |
| RF-P-04 | Plantillas de datos para los módulos con carga estructurada |

### No funcionales

| ID | Descripción |
|----|-------------|
| RNF-01 | La plataforma debe ser usable por perfiles no técnicos, ocultando n8n, Sheets y workflows |
| RNF-02 | Arquitectura modular: cada caso de uso es independiente y puede evolucionar sin afectar al resto |
| RNF-03 | Trazabilidad completa de cada ejecución: datos de entrada, resultado, validaciones, advertencias y timestamp |
| RNF-04 | Toda solución generada por motor probabilístico o heurístico pasa por un validador determinista antes de aceptarse |

---

## Estructura del proyecto

```
smartassign/
├── index.html          ← Punto de entrada. Toda la UI en un solo HTML
├── css/
│   └── main.css        ← Estilos organizados por sección
├── js/
│   ├── app.js          ← Navegación, tabs, subida/validación, pasos, plantillas y export
│   ├── n8n.js          ← Módulo de conexión con n8n (verify, callWebhook, persistencia)
│   ├── demo-data.js    ← Datasets de ejemplo fieles al modelo de datos del TFG
│   └── demo-engine.js  ← Motor de demo: ejecuta asignación/validación en el navegador
├── plantillas/         ← Reservada para plantillas servidas estáticamente (opcional)
└── README.md
```

> **Dependencias externas (vía CDN, no requieren instalación):** DM Sans/DM Mono
> (Google Fonts), Tabler Icons y **SheetJS** (`xlsx`), usado para generar las
> plantillas `.xlsx` y exportar los resultados directamente desde el navegador.
> Las plantillas se construyen en memoria con SheetJS, por lo que **no es
> necesario** colocar ningún archivo en `plantillas/` para que la descarga
> funcione.

---

## Cómo ejecutarlo en VS Code

### Opción recomendada — Live Server
1. Abre la carpeta `smartassign/` en VS Code.
2. Instala la extensión **Live Server** (ritwickdey.LiveServer).
3. Clic derecho en `index.html` → **Open with Live Server**.
4. Se abre en `http://127.0.0.1:5500`.

### Opción alternativa
Abre `index.html` directamente en el navegador. La subida de archivos y las llamadas fetch() pueden estar restringidas sin servidor en algunos navegadores.

---

## Modo demo (sin n8n)

**La aplicación es completamente navegable y demostrable sin n8n.** No se limita
a mostrar datos estáticos: incluye un **motor de demostración** (`demo-engine.js`)
que ejecuta en el navegador, sobre datasets de ejemplo (`demo-data.js`), la misma
lógica de asignación y validación que la memoria describe para los workflows de
n8n. Los resultados que se muestran están **calculados de verdad**, no escritos a
mano.

Qué hace cada módulo en modo demo:

- **Catering** — aplica el *fallback heurístico*: filtra camareros (activos,
  verificados y disponibles), ordena los eventos por prioridad, cubre el mínimo
  de vehículos por evento (⌈n/5⌉) y evita solapamientos el mismo día. Después un
  **validador determinista** comprueba las restricciones duras y se muestran las
  asignaciones, el scoring y las advertencias.
- **Proyectos software** — aplica el *scoring heurístico multivariable* descrito
  en la memoria (±40 por skill, seniority 20/10/0, +35 persona preferida, +50
  capacidad, prioridad de tarea y proyecto), respeta dependencias y capacidad,
  y genera la tabla de asignaciones, la **distribución de carga**, las **tareas
  no asignadas** con su motivo y las **recomendaciones** (p. ej. dividir tareas).
- **Guardias médicas** — sobre el calendario generado calcula el **resumen por
  médico** (guardias asignadas vs. objetivo) y las **advertencias blandas**
  (desviación del objetivo, guardia en día que prefería librar). Las restricciones
  duras R0-R8 las garantiza por construcción el solver CSP del workflow real.

El resto también funciona sin n8n: **login** (visual), **validación** de campos
antes de lanzar, **descarga de plantillas** `.xlsx` (generadas con SheetJS),
**exportación** de resultados `.xlsx`, **historial**, filtros, navegación y
calendario.

Cuando se verifica una conexión con n8n, los botones «Lanzar» dejan de simular y
envían el `payload` real al webhook correspondiente.

> Los datos de ejemplo viven en `js/demo-data.js` y reproducen el modelo de datos
> del TFG (camareros con scoring, médicos con disponibilidad, equipo/proyectos/
> tareas). Editarlos cambia directamente lo que se ve en pantalla.

---

## Conectar con n8n

1. Arranca n8n:
   ```bash
   npx n8n        # sin instalación global
   n8n start      # si está instalado globalmente
   ```
   Por defecto corre en `http://localhost:5678`.

2. En n8n crea un workflow por módulo con un nodo **Webhook** como trigger:

   | Módulo | Método | Path sugerido |
   |--------|--------|---------------|
   | Catering | POST | `/webhook/catering-assign` |
   | Guardias — envío | POST | `/webhook/guardias-send` |
   | Guardias — planificación | POST | `/webhook/guardias-plan` |
   | Software | POST | `/webhook/software-assign` |

3. En la app ve a **Configuración**, introduce `http://localhost:5678` y pulsa **Verificar**. Las rutas se rellenarán automáticamente.

4. Guarda la configuración. La app la persiste en `localStorage`.

> ### ⚠️ Importante: CORS
> La interfaz (servida, p. ej., desde `http://127.0.0.1:5500`) y n8n
> (`http://localhost:5678`) están en **orígenes distintos**, así que el
> navegador aplica la política CORS. Por defecto n8n **no** envía las cabeceras
> CORS necesarias y la verificación fallará («Sin conexión») aunque n8n esté
> arrancado. Para permitir las llamadas desde la interfaz, arranca n8n con el
> origen permitido:
>
> ```bash
> # PowerShell (Windows)
> $env:N8N_CORS_ALLOW_ORIGIN = "http://127.0.0.1:5500"; npx n8n
>
> # bash / macOS / Linux
> N8N_CORS_ALLOW_ORIGIN="http://127.0.0.1:5500" npx n8n
> ```
>
> Usa exactamente el origen desde el que sirves la interfaz (host y puerto). En
> desarrollo puedes usar `*`, pero **no en producción**. Mientras no resuelvas
> el CORS, la app seguirá siendo plenamente usable en **modo demo**.

### Payloads que envía la app a cada webhook

**Catering**
```json
{
  "nombre":    "Gala julio 2026",
  "vehiculos": 2,
  "motor":     "auto | llm | heuristic",
  "email":     false
}
```

**Guardias — envío de solicitudes**
```json
{
  "mes":      "Julio 2026",
  "deadline": "2026-06-20"
}
```

**Guardias — generación de calendario**
```json
{
  "mes":    "Julio 2026",
  "semana": "1",
  "finde":  "2"
}
```

**Software**
```json
{
  "nombre": "Sprint 15",
  "skills": true,
  "horas":  40,
  "umbral": 6
}
```

---

## Marco legal y privacidad

La plataforma trata datos personales (nombres, correos, disponibilidades, perfiles profesionales) y está diseñada teniendo en cuenta el RGPD y la LOPDGDD:

- **Minimización**: solo se recogen los datos necesarios para la asignación.
- **Limitación de finalidad**: los datos se usan exclusivamente para la asignación de turnos o tareas.
- **OAuth 2.0**: la autenticación con Google Sheets y Gmail se hace mediante OAuth 2.0 (RFC 6749), sin compartir credenciales.
- **Cifrado en tránsito**: todas las comunicaciones con APIs externas usan HTTPS/TLS.
- **Consentimiento**: los médicos residentes que participan en el módulo de guardias han firmado un documento de consentimiento informado que detalla el tratamiento, los sistemas involucrados (incluido el envío de correos a la API de Gemini) y sus derechos RGPD.

En producción, Google Sheets debería sustituirse por una base de datos propia para mejorar el control sobre plazos de conservación y procedimientos de supresión.

---

## Funcionalidades futuras

Las siguientes funcionalidades están identificadas como trabajo futuro derivado del análisis del TFG. Están ordenadas por prioridad y bloque temático.

### Interfaz web

- [ ] **Parseo real del Excel subido** — integrar SheetJS en el frontend para leer el contenido del archivo al subirlo, validar su estructura antes de enviarlo y enviar los datos ya parseados al webhook de n8n en lugar del archivo binario.
- [x] **Renderizado dinámico de resultados** — implementado: las vistas de resultados (tabla de asignaciones, indicadores de cabecera, distribución de carga, tareas no asignadas, resumen por médico y avisos) se rellenan dinámicamente desde el motor de demo (`demo-engine.js`). Pendiente: conectar el mismo renderizado a la respuesta JSON real de n8n en lugar de a los datos de ejemplo.
- [ ] **Historial persistente real** — almacenar en `localStorage` (o en una API propia) el registro de ejecuciones con su ID, timestamp, módulo, resumen y resultado, y leerlo dinámicamente en la pantalla de historial.
- [ ] **Comparación de ejecuciones** — permitir seleccionar dos ejecuciones del historial y mostrar en paralelo sus diferencias: cambios en asignaciones, variación de scores, restricciones que antes fallaban y ahora se cumplen.
- [ ] **Autenticación real** — implementar un sistema de login con JWT o sesión de servidor. Actualmente el login es solo visual.
- [ ] **Modo oscuro** — detectar la preferencia del sistema operativo y aplicar un tema oscuro coherente.
- [x] **Exportar resultados (.xlsx)** — implementado con SheetJS: el botón «Exportar» descarga las asignaciones (o el calendario de guardias) en Excel. Pendiente: exportación a PDF.
- [ ] **Notificaciones en tiempo real** — mientras el workflow de n8n se ejecuta (puede tardar segundos o minutos), mostrar el progreso en tiempo real mediante polling al webhook o mediante WebSockets si n8n lo soporta.
- [x] **Validación de formularios** — implementada validación de campos obligatorios antes de lanzar (nombre de evento/sprint, mes de planificación), con mensaje en la barra de estado. Pendiente: validación de formato campo a campo e inline por campo.
- [ ] **Gestión de plantillas desde la UI** — permitir al usuario subir, actualizar y versionar las plantillas Excel desde la propia interfaz, sin necesidad de acceder a la carpeta del proyecto.

### Motor de asignación — Catering

- [ ] **Aprendizaje del historial** — enriquecer el perfil del camarero con métricas derivadas de ejecuciones anteriores: tasa de confirmación, puntuación media en eventos pasados, frecuencia de asignación a eventos de alta prioridad.
- [ ] **Asignación multi-día** — resolver la asignación de varios días simultáneamente en lugar de día a día, para optimizar la distribución de carga semanal o mensual.
- [ ] **Preferencias de parejas** — incorporar restricciones del tipo "estos dos camareros trabajan mejor juntos" o "estos dos no deben coincidir en el mismo evento".
- [ ] **Integración con Google Calendar** — leer la disponibilidad directamente del calendario del camarero en lugar de depender de una encuesta manual.

### Motor de asignación — Guardias médicas

- [ ] **Solver con metaheurísticas** — explorar algoritmos genéticos o búsqueda tabú para obtener mejores soluciones en instancias con muchas restricciones blandas, en las que el solver CSP actual puede quedar atrapado en óptimos locales.
- [ ] **Guardias de fin de semana largo** — añadir soporte para periodos festivos con distribución especial de guardias (Navidad, Semana Santa).
- [ ] **Rotaciones cruzadas entre servicios** — ampliar el modelo para coordinar guardias entre dos o más servicios hospitalarios que comparten residentes en determinados periodos.
- [ ] **Recordatorios automáticos** — si un médico no ha respondido a la solicitud de disponibilidad antes de la fecha límite, enviar un recordatorio automático personalizado.
- [ ] **Confirmación y reclamaciones** — flujo de confirmación por parte de los médicos y canal para solicitar cambios de guardia, gestionado automáticamente por n8n.

### Motor de asignación — Proyectos software

- [ ] **Integración con Jira / Linear** — leer las tareas directamente del gestor de proyectos y escribir las asignaciones de vuelta, eliminando la necesidad de la plantilla Excel.
- [ ] **Seguimiento de velocidad del equipo** — incorporar la velocidad histórica de cada desarrollador para estimar mejor la capacidad real disponible.
- [ ] **Detección de conflictos de dependencias** — visualizar el grafo de dependencias entre tareas e identificar cuellos de botella antes de lanzar la asignación.
- [ ] **Reasignación parcial** — permitir reasignar solo las tareas afectadas cuando cambia la disponibilidad de un miembro del equipo a mitad de sprint, sin recalcular todo.
- [ ] **Soporte para equipos distribuidos** — añadir zonas horarias y solapamiento de horas de trabajo como restricciones en la asignación de tareas colaborativas.

### Infraestructura y arquitectura

- [ ] **Sustituir Google Sheets por base de datos propia** — migrar la capa de persistencia a PostgreSQL o MongoDB para mejorar el control sobre los datos, los tiempos de respuesta y el cumplimiento del RGPD (plazos de supresión, portabilidad).
- [ ] **Soporte para Ollama (modelos locales)** — añadir configuración en la pantalla de ajustes para usar un LLM local (Mistral u otros) en lugar de la API de Gemini, para entornos donde la privacidad impide enviar datos a servicios externos.
- [ ] **API propia entre frontend y n8n** — introducir una capa de backend ligera (Express/Fastify) entre la interfaz y n8n para gestionar autenticación, validación de payloads, registro de ejecuciones y control de acceso por módulo.
- [ ] **Despliegue en servidor** — dockerizar la interfaz web y configurar un despliegue en servidor propio o en la nube, con n8n también en contenedor, para que la plataforma sea accesible sin ejecutar nada en local.
- [ ] **Multiusuario y roles** — implementar un sistema de roles (administrador, operador por módulo, solo lectura) para que diferentes personas de la organización accedan solo a lo que les corresponde.
- [ ] **Auditoría de acciones** — registrar qué usuario lanzó cada ejecución, con qué parámetros y en qué momento, para cumplir con las obligaciones de trazabilidad del RGPD.

### Extensibilidad de la plataforma

- [ ] **Nuevos módulos de dominio** — la arquitectura modular de la plataforma está diseñada para que añadir un cuarto dominio (enfermería, logística, docencia, etc.) solo requiera implementar su workflow, su validador y su vista en la interfaz, sin modificar el resto.
- [ ] **Módulo de enrutamiento (TSP)** — integrar un módulo de optimización de rutas para eventos de catering con múltiples ubicaciones, resolviendo el problema del Viajante de Comercio para minimizar desplazamientos.
- [ ] **API pública documentada** — exponer los tres motores de asignación como endpoints REST documentados con OpenAPI, para que otras aplicaciones puedan usarlos directamente.
- [ ] **Panel de analítica** — añadir una pantalla de métricas agregadas: evolución del score medio de asignaciones, carga histórica por persona, tasa de violaciones de restricciones blandas, tiempo medio de ejecución de cada workflow.

---

## Tecnologías utilizadas

| Componente | Tecnología | Licencia |
|------------|-----------|----------|
| Orquestador de workflows | n8n | Sustainable Use License |
| Modelo de lenguaje | Google Gemini 2.5 Flash / Flash Lite | Google AI Terms of Service |
| Persistencia | Google Sheets | Google Workspace Terms |
| Comunicación | Gmail API (OAuth 2.0) | Google Workspace Terms |
| Interfaz web | HTML + CSS + JavaScript (vanilla) | Elaboración propia |
| Lógica de asignación y validadores | JavaScript (nodos de n8n) | Elaboración propia |
| Solver CSP (guardias) | JavaScript (backtracking + MRV + LCV + branch and bound) | Elaboración propia |
| Iconografía | Tabler Icons | MIT |
| Tipografía | DM Sans + DM Mono (Google Fonts) | OFL |

---

*SmartAssign — TFG 2025-2026 · Universidad Carlos III de Madrid*
