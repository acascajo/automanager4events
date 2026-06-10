# Integración Web ↔ n8n (SmartAssign)

Documento de estado de la conexión entre la interfaz web (`web/`) y los workflows de n8n.
Última actualización: 2026-06-11.

## Resumen del estado

| Módulo | Conectado a n8n | Datos | Notas |
|--------|-----------------|-------|-------|
| **Catering** | ✅ end-to-end | Excel (2 archivos) | Gemini + fallback heurístico. Notificación email = simulada |
| **Guardias** | ✅ end-to-end | Web genera disponibilidades (ocultas) | Solver CSP sin correos ni Sheets. Flujo 2 pasos (enviar → generar) |
| **Software** | ✅ end-to-end | Excel (3 hojas) | Heurístico + desempate LLM (Gemini) con fallback |

Funcionalidades de plataforma: **historial real** (localStorage), **login real** (hash), **comparación de ejecuciones**.

## Cómo funciona la conexión (patrón general)

La web es estática (HTML+CSS+JS vanilla, servida con Live Server desde `http://127.0.0.1:5500`).
n8n corre en `http://localhost:5678` (se arranca con `ARRANCAR-n8n-BUENO.bat` del escritorio).

1. La web hace `POST {baseUrl}/webhook/<path>` con un payload JSON ([web/js/n8n.js](web/js/n8n.js), `callWebhook`).
2. El workflow tiene un nodo **Webhook** (trigger) + un nodo **Respond to Webhook** que devuelve el resultado.
3. La web pinta la respuesta real en la pestaña de Resultados.

### CORS
- n8n ya refleja el origen `127.0.0.1:5500` en `/healthz` (la verificación de conexión funciona).
- El nodo **Webhook** lleva la opción `allowedOrigins: "*"` para que el `POST` del navegador no sea bloqueado.
- Si se sirve la web desde otro origen/puerto, revisar esto.

## Detalle de Catering

### Workflows
- **Original** (no tocar): [workflows/catering/workflow.json](workflows/catering/workflow.json) — solo `Manual Trigger`, lee de Google Sheets.
- **Copia para la web**: [workflows/catering/workflow-web.json](workflows/catering/workflow-web.json) → en n8n se llama **"Laurel Catering v5 (Web+Excel)"**. Es la que debe estar **activa** (Publish). La intermedia "Laurel Catering v5 (Web)" quedó desactivada como backup.

### Nodos añadidos a la copia
- **Webhook (Web)**: `POST /webhook/catering-assign`, `responseMode: responseNode`, `allowedOrigins:*`.
- **Prep desde Excel** (Code): lee `body.{disponibilidad,camareros,eventos}`, fusiona disponibilidad+camareros por `telefono` (sustituye al nodo Merge) y alimenta al normalizador. **En modo webhook NO se leen las Google Sheets**; el Manual Trigger sí las sigue leyendo para pruebas internas.
- **Respond to Webhook**: `respondWith: allIncomingItems`, cuelga de "Aplanar".

### Robustez (Gemini falla con 503 con frecuencia)
- Nodo Gemini ("Message a model"): `onError: continueRegularOutput` (no detiene el flujo si la API falla).
- "Code in JavaScript1" (parser de la respuesta de Gemini): tolerante — si no hay JSON válido, devuelve `{ asignaciones: null }` (¡ojo: `JSON.parse(null)` devuelve `null` sin lanzar excepción, hay que comprobar el tipo!).
- "Aplanar": si no hay asignación de la IA, calcula el **fallback heurístico determinista** con `eventos` + `camareros_validos` → siempre devuelve solución.
- Resultado: con Gemini caído, `origen_asignacion: "fallback"`; cuando responde, `"ia"`.

### Lado web
- **Subida en DOS archivos** (catering):
  - **Archivo 1 — BD de camareros** (`plantilla_camareros_bd.xlsx`, hoja `Camareros` con columna `email`). Se sube una vez y **se conserva en `localStorage`** (`smartassign-catering-camareros`): no hay que resubirla en cada ejecución. Se restaura al cargar la página (`initCatering()`).
  - **Archivo 2 — respuestas + eventos** (`plantilla_respuestas_eventos.xlsx`, hojas `Disponibilidad` + `Eventos`). Se sube en cada ejecución.
  - Funciones en [web/js/app.js](web/js/app.js): `handleCateringUpload(kind)`, `parseCateringFile`, `updateCateringReady` (habilita "Lanzar" con BD + respuestas), `removeCateringFile`, `initCatering`.
- `buildPayload('catering')` compone `{ disponibilidad, camareros, eventos }` desde `UPLOADED.catering` (la web fusiona los dos archivos en un solo payload → el workflow no cambia).
- `TEMPLATES['catering-bd']` y `TEMPLATES['catering-resp']`: plantillas separadas, columnas REALES (Camareros 20 col con `email`; Eventos con `updated_at`).
- Al lanzar con n8n conectado, catering pinta los resultados reales.
- **Notificación por correo (SIMULADA)**: botón "Aceptar y enviar por correo" en Resultados (`sendCateringEmails()`). Resuelve el email de cada asignado desde la BD (`buildCateringRecipients`) y muestra a quién se enviaría. **No hay workflow de n8n de envío**: es una opción de UI que no envía nada realmente.
- [web/js/demo-engine.js](web/js/demo-engine.js): `DEMO.renderCateringFromN8n()` adapta la respuesta de n8n a la tabla.
- [web/js/n8n.js](web/js/n8n.js): timeout del `fetch` subido de 30 s a **120 s** (los workflows reales tardan).

### Estructura real de los datos (las 3 hojas)
- **Disponibilidad**: `fecha_evento, telefono, nombre, disponible (SI/NO), tiene_coche (SI/NO), observaciones`.
- **Camareros**: `telefono, nombre, email, fecha_alta, antiguedad_dias, horas_trabajadas, nota, fecha_ultimo_evento, dias_desde_ultimo_evento, fecha_ultima_disponibilidad_si, dias_desde_ultima_disponibilidad_si, num_disponibilidades_si, num_respuestas, ratio_disponibilidad, num_disponibilidades_coche, activo (SI/NO), verificado (SI/NO), score_fiable, score_prometedor, score_general`. (`email` añadido para la notificación.)
- **Eventos**: `event_id, fecha, hora_inicio, hora_fin, tipo, nombre_evento, ubicacion, asistentes, camareros_necesarios, estado (NEW), prioridad, observaciones, updated_at`.
- Reglas de cruce: el `telefono` enlaza Disponibilidad↔Camareros; la `fecha`/`fecha_evento` debe coincidir entre evento y disponibilidad; solo cuentan eventos `estado=NEW` y camareros `disponible=SI` + `activo=SI` + `verificado=SI`.
- Plantillas rellenadas con datos reales en `Descargas\`: `plantilla_camareros_bd_rellenada.xlsx` (800 camareros con email) y `plantilla_respuestas_eventos_rellenada.xlsx` (300 disponibilidades + 2 eventos).

## Cómo probar catering end-to-end
1. n8n arrancado y workflow **"Laurel Catering v5 (Web+Excel)" activo (Publish)**.
2. Web servida con Live Server en `127.0.0.1:5500`, recargada (Ctrl+F5).
3. Configuración → URL base `http://localhost:5678` → Verificar → Guardar.
4. Catering → subir `plantilla_camareros_bd_rellenada.xlsx` (BD, se queda guardada) y `plantilla_respuestas_eventos_rellenada.xlsx` (respuestas+eventos) → "Lanzar con n8n".
5. Resultados: tabla con las asignaciones reales. Botón "Aceptar y enviar por correo" → muestra los destinatarios (simulado).

Prueba directa del webhook (sin navegador):
```powershell
Invoke-WebRequest -Uri "http://localhost:5678/webhook/catering-assign" -Method POST -Body $jsonConDisponibilidadCamarerosEventos -ContentType "application/json"
```

## Detalle de Guardias
- **Copia**: [workflows/guardias/guardias-web.json](workflows/guardias/guardias-web.json) → en n8n "Guardias (Web)". Webhook `POST /webhook/guardias-run`. Original `03_generar_guardias.json` intacto.
- Copia del solver CSP (03) **sin Gmail ni Google Sheets**. Nodos clave: `Webhook → Prep disp (Web) / Prep guardias (Web) → Code limpiar disponibilidades / Code limpiar guardias → Preparar input asignacion → Resolver CSP → Validador final → Code in JavaScript (informe) → Respuesta web → Respond`. ("Code limpiar guardias" reescrito para normalizar filas diarias sin hardcode de junio.)
- **La web genera las disponibilidades internamente** (`generarDisponibilidadMedico` en app.js), ocultas al usuario, para que parezca que los médicos respondieron. Los médicos salen de `DEMO_GUARDIAS.medicos` (demo-data.js).
- **Flujo en 2 pasos** (más realista): "Enviar solicitudes" (Configurar) → simulado, sin correos → "Leer respuestas y generar" (Calendario) → llama a `guardias-run`, ejecuta el CSP y pinta el calendario (`renderGuardiasFromN8n`, grid genérico para cualquier mes).
- **Restricción R8**: los R2 solo hacen guardias dobles. Si ninguna semana tiene 2 residentes, los R2 salen a 0 guardias (correcto). La web muestra un aviso automático explicándolo.
- Respuesta del webhook: `{ recipients, calendario:{asignaciones}, resumen_medicos, validacion, total_puestos_* }`.

## Detalle de Software
- **Copia**: [workflows/software-project-management/software-web.json](workflows/software-project-management/software-web.json) → "Gestor proyectos software (Web)". Webhook `POST /webhook/software-assign`. Original intacto.
- Nodos: `Webhook → Prep desde Excel → Code in JavaScript (normalizador) → Code in JavaScript1 (heurístico, emite empates) → Desempate LLM (Gemini) → Aplicar desempate → Respond`.
- **Desempate LLM (RF-S-02)**: el heurístico asigna por score; si el 2º candidato está a ≤35 pts (empate), Gemini elige cualitativamente. Robusto: Gemini `onError: continueRegularOutput` + parser tolerante; si falla (503) se mantiene el heurístico. Campo `desempate_llm` cuenta los empates resueltos por el LLM (confirmó o cambió). Verificado.
- ⚠️ Plantilla: la columna del equipo debe ser **`capacidad_horas_semana`** (no `capacidad_horas`), o nadie tendría capacidad.
- Datos sheets: Equipo (`persona_id, nombre, rol, seniority, skills, capacidad_horas_semana, disponibilidad, observaciones`), Proyectos (`proyecto_id, nombre, cliente, prioridad, fecha_inicio, deadline, estado, horas_estimadas`), Tareas (`tarea_id, proyecto_id, nombre, descripcion, skills_requeridas, horas_estimadas, prioridad, deadline, dependencias, bloqueada, persona_preferida`). Ejemplo: `Descargas\plantilla_software_rellenada.xlsx`.

## Plataforma (web)
- **Historial real** (`History` en app.js, localStorage `smartassign-history`): cada ejecución real con n8n se registra (id, ts, módulo, label, resumen, data). Pantalla Historial dinámica con filtros, "Ver" (reabre y re-renderiza), "Limpiar".
- **Login real**: valida usuario+contraseña con hash SHA-256 (`crypto.subtle`) guardado en localStorage (`smartassign-auth`). Credencial por defecto **admin / admin** (se siembra sola). Sesión en sessionStorage. (Sigue siendo cliente; auth con backend = trabajo futuro.)
- **Comparación de ejecuciones**: casillas en el historial → seleccionar 2 → "Comparar" → tabla lado a lado con métricas por módulo, resaltando diferencias.

## Pendiente / próximos pasos
- [ ] Cosmético catering: cabecera de Resultados (`Eventos · 14-15 jul 2026`, `ID: CAT-2026-014`, badge `Completado`) hardcodeada en `web/index.html`; debería reflejar datos reales. Mismo punto para guardias (ya se actualizan título/meta vía `guardias-cal-*`).
- [ ] Cosmético catering: mensaje "Validador determinista: 0 violaciones" reutilizado del demo; reformular a algo honesto.
- [ ] **Gap 3** (decisión tomada): notificación real por correo en catering queda **simulada** → reflejar como trabajo futuro en la memoria del TFG.
- [ ] Memoria TFG: el índice de figuras del .docx está copiado de OTRO TFG (SmartWay/Route4me/TSP/Firebase) — rehacer entero. Faltan intro, diagramas/flujos, capturas (cap 5), formato de tablas (cap 6) y ejecutar/documentar las pruebas CP-*.
- [ ] Opcional: plantilla de software CON un empate para demostrar el desempate LLM en vivo (los datos demo no tienen empates).
- [ ] Opcional: arreglar la rama IA original del workflow de catering (`If` con condición vacía siempre va a IA; `Unificar2` lee `asignaciones_fallback` inexistente). Hoy se ignora porque "Aplanar" hace el fallback inline.

## Notas de entorno (n8n)
- n8n 2.19.5. El login es **obligatorio** y no se puede desactivar (la var `N8N_USER_MANAGEMENT_DISABLED` se eliminó en n8n 1.0).
- Para no re-loguear en cada arranque, el `.bat` fija `N8N_USER_MANAGEMENT_JWT_SECRET` (estable) y `N8N_USER_MANAGEMENT_JWT_DURATION_HOURS=8760`.
- Datos de n8n en `%USERPROFILE%\.n8n\database.sqlite`.
