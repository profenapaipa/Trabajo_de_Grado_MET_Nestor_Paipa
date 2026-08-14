# PENDIENTES DE LA TESIS Y EL PROTOTIPO

*Última actualización: 2026-08-14*

Leyenda de prioridad: 🔴 CRÍTICO · 🟠 ALTO · 🟡 MEDIO · 🟢 BAJO

Ningún ítem marcado como pendiente aquí debe darse por resuelto sin verificación directa contra el código, el firmware, la tesis o el artículo primario correspondiente.

---

## Arquitectura física

| Pendiente | Prioridad | Estado | Dependencia | Evidencia necesaria | Próximo paso |
|---|---|---|---|---|---|
| Determinar protocolo exacto del cable cubo-base | 🔴 CRÍTICO | Sin resolver | Acceso al firmware del cubo o al esquema eléctrico | Inspección eléctrica o documentación del fabricante | El autor confirma si el cable solo cierra un contacto de posición o transporta algo más |
| Localizar firmware `Cubo-Esclavo.ino` | 🔴 CRÍTICO | No encontrado en este proyecto (referenciado en `GUIA_CONEXION.md` como ubicado fuera de esta carpeta) | Ninguna | El autor debe copiarlo al proyecto | Solicitar al autor que lo traiga |
| Determinar qué representa TCP 3333 en la arquitectura física real | — | ✅ **Cerrado**: el autor confirmó que `Maestro___Wifi_copy_20260813194508.ino` es el firmware físicamente instalado; TCP 3333 queda documentado como el canal de actuación maestro→cubos | — | — | — |
| Verificar función exacta del acoplamiento magnético | 🟡 MEDIO | Sin resolver (solo confirmado que activa un pin de posición en el maestro, vía `pinesBase[]`/`digitalRead`) | Ninguna | Esquema eléctrico o confirmación del autor | Preguntar al autor |
| Verificar si el cable transporta alimentación, datos, o ambos | 🟡 MEDIO | Sin resolver | Depende del punto anterior | Inspección eléctrica | Preguntar al autor |
| Verificar electrónica intermedia de las bases/casillas | 🟡 MEDIO | Sin resolver | Ninguna | Documentación o inspección física | Preguntar al autor |
| Verificar indicador luminoso de la base | 🟢 BAJO | Posible inconsistencia detectada: `GUIA_CONEXION.md` sugiere que es solo indicador de encendido/carga, sin relación con el estado de red, mientras Materiales lo describe como indicador de conexión de todos los cubos | Ninguna | Confirmación del autor | Revisar junto con Fase 7 |

---

## Tesis (`main.tex`)

| Pendiente | Prioridad | Estado | Dependencia | Evidencia necesaria | Próximo paso |
|---|---|---|---|---|---|
| Elegir → Actuar en el resto de `main.tex` (Fase 9) | — | ✅ **Resuelto y verificado (2026-08-14)**: ejecutados los 13 puntos en alcance — 8 sustituciones de texto (líneas 364, 440, 1989, 2086, 2089, 2090, 2177, 2543) y renombrado atómico de 5 identificadores/referencias TikZ (`elegir`→`actuar`, `emo_elegir`→`emo_actuar`, líneas 2011, 2025, 2049, 2053, 2057). Compilado 2 veces (`pdflatex -halt-on-error`), 0 errores fatales, 79 páginas ambas pasadas, sin error de TikZ. Revisión visual directa de páginas 16, 18, 54, 55 y 64: correcto. `grep -in elegir main.tex` posterior devuelve exactamente las 6 líneas esperadas fuera de alcance (938 + las 5 de la fila siguiente) | — | — | — |
| Ocurrencias de "Elegir" dentro de los guiones experimentales (líneas 2746, 2789, 2794, 2824, 2844) | 🟡 MEDIO | Identificadas y registradas (2026-08-14); explícitamente **excluidas** del alcance de la Fase 9 porque caen dentro de `Guion experimental TEA nivel 1` y `Guión técnico experimental...` (Fase 12, sin resolver) | Fase 12 | Decisión metodológica del autor sobre la relación entre los dos guiones | Esperar resolución de la Fase 12; no editar mientras tanto |
| Corregir Figura 4.2 ("Agente Elegir" → "Agente Actuar") | — | ✅ Resuelto y verificado (compilado, revisado visualmente) | — | — | — |
| Revisar flechas de Figura 4.2 | 🟡 MEDIO | Parcial: se renombró el texto, pero **no** se corrigió la estructura (el diagrama muestra los 3 agentes como paralelos, mientras el texto de "flujo operativo" los describe como secuencia Pausar→Pensar→Actuar) | Autorización para tocar "Propuesta estructural integradora" | Confirmación del autor sobre si el modelo es paralelo o secuencial | Señalado, no corregido |
| Eliminar "Juego Inteligente xxxx" de Figuras 4.3 y 4.4 | — | ✅ Resuelto (captions reescritos con base en el contenido real de las imágenes) | — | — | — |
| Revisar figuras que se salen del ancho útil de la página | — | ✅ Resuelto: Figuras 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7 y Tablas 4.3/4.4 verificadas dentro del margen (compilado y revisado visualmente). Nota: la Figura 4.1 sigue siendo densa/de texto pequeño por ser una imagen fuente compleja — eso es una limitación del gráfico original, no un desborde de página | — | — | — |
| Revisar lenguaje de autonomía (Fase 10) | 🟠 ALTO | 🟡 **Parcial (2026-08-14)**: auditoría completa ejecutada (34 expresiones revisadas, verificadas contra `App.tsx`/`server/index.js` — sin disparadores automáticos en el código). Corregidas y compiladas 2 líneas fuera de los guiones: línea 2175 ("Detección, por parte del docente, de un intento impulsivo, y activación del agente Pausar.") y línea 2177 ("Confirmación deliberada por parte del docente y activación del agente Actuar."), con la autoría del sujeto confirmada por el autor (el docente controla remotamente los cubos; el estudiante solo juega y cumple las indicaciones). **Quedan sin corregir, registradas en la fila siguiente, 5 ocurrencias dentro del Guión técnico experimental** por depender de la Fase 12 | Fase 12 para las 5 restantes | Ninguna para las 2 ya corregidas | Esperar resolución de la Fase 12 para las 5 restantes |
| Lenguaje de autonomía dentro del Guión técnico experimental (líneas 2792, 2842, 2843, 2844, 2848) | 🟠 ALTO | Identificado en la auditoría de la Fase 10 (2026-08-14): "...agentes multisensoriales autónomos" (2792); "Activación automática del modo Pausar" (2842); "Transición programada al modo Pensar" (2843); "Activación del modo Elegir/Actuar" (2844, problemática por continuidad de la lista); "detección de movimiento del cubo o interacción física" como mecanismo de transición (2848). Verificado contra el código (`App.tsx`: `sendAction` solo se dispara por clic del docente en 3 botones, líneas 411/420/429; sin temporizadores ni sensores que disparen transiciones) que ninguna de estas afirmaciones tiene respaldo en la implementación real. No corregidas por regla de alcance: todo el bloque (2789-2857) depende de la relación entre los dos guiones | Fase 12 | Decisión metodológica del autor sobre los dos guiones | Esperar resolución de la Fase 12; no editar mientras tanto |
| Colisión de títulos de sección: `\subsection{Guión experimental TEA Nivel 1}` (línea 1992, teórico/conceptual, dentro de "Propuesta estructural integradora") y `\subsection{Guion experimental TEA nivel 1}` (línea 2677, el guion verbal/gestual real, dentro de "Procedimiento") | 🟡 MEDIO | Detectado durante la auditoría de la Fase 10 (2026-08-14) al mapear la estructura de `main.tex`. Son dos secciones distintas con título casi idéntico — riesgo de confusión para el lector/jurado. No corregido, solo registrado | Ninguna | Decidir con el autor si se renombra alguna de las dos secciones | Preguntar al autor (candidato natural: junto con la Fase 12, ya que una de las dos secciones en conflicto es uno de los guiones) |
| Unificar valores de PAUSAR/PENSAR/ACTUAR | 🟠 ALTO | Fase 9 ya cerrada (dependencia satisfecha); sin ejecutar; fuente de verdad ya decidida (`App.tsx`) | Ninguna | Ninguna adicional | Autorización (Fase 11) |
| Resolver relación entre los dos guiones experimentales | 🔴 CRÍTICO | 🔴 Bloqueada — decisión metodológica pendiente del autor | Respuesta del autor | Definición explícita: ¿condiciones comparativas, protocolo integrado, o versiones sucesivas? | Esperar decisión del autor |
| Nota de alcance preexperimental | 🟡 MEDIO | Sin ejecutar (diseño ya definido: párrafo breve en apertura de Metodología y de Resultados) | Ninguna | Ninguna | Autorización (Fase 8) |
| Participantes | 🔴 CRÍTICO | Sin definir — no hay datos reales, no deben inventarse | Ejecución futura de la fase experimental | Datos reales de los participantes | Esperar definición de muestra |
| Ética / consentimiento informado | 🔴 CRÍTICO | Sin proceso documentado | Gestión institucional por parte del autor | Aprobación de comité de ética / consentimiento firmado | El autor gestiona el trámite |
| Limitaciones | 🟡 MEDIO | No existe la sección en el documento | Ninguna | Ninguna | Redactar cuando se autorice |
| Puente HRS-EDU (referente → adaptación → simplificación → implementación → futuro) | 🟡 MEDIO | Diseñado, no redactado | Ninguna | Ninguna | Autorización (Fase 14) |
| Bibliografía | 🟠 ALTO | Ver tabla dedicada abajo | — | — | — |
| Placeholders residuales | 🟢 BAJO | Parcial: mAh del cubo (3.7V/180mAh) y la denominación del microcontrolador ya se corrigieron en "Descripción técnica de los cubos inteligentes" y "Funcionamiento electrónico de la base de los cubos". **Sigue sin resolver**: "Centro ACACIA de la Universidad..... xxx." | Confirmación del autor | Nombre completo de la universidad/centro | Preguntar al autor |
| Labels LaTeX duplicados preexistentes: `\label{MWM1}` (líneas 550, 598) y `\label{fig:placeholder}` (10 apariciones entre las líneas 1973 y 2673) | 🟡 MEDIO | Detectado en el log de compilación durante la verificación de la Fase 9 (2026-08-14): "LaTeX Warning: Label ... multiply defined." Ninguna de las líneas afectadas coincide con las editadas en la Fase 9 — confirmado que no fue introducido por esa fase; es un defecto estructural preexistente del documento. No corregido, por regla de alcance | Ninguna | Decidir con el autor cuáles instancias de cada label deben renombrarse | Autorización de una fase de limpieza de labels (candidata natural: Fase 18, auditoría final de LaTeX) |

---

## Prototipo (código/firmware)

| Pendiente | Prioridad | Estado | Dependencia | Evidencia necesaria | Próximo paso |
|---|---|---|---|---|---|
| Integrar el comando sonoro en el software/firmware del cubo | 🟢 BAJO | Pendiente — es desarrollo tecnológico futuro, fuera de la edición de la tesis | Firmware del cubo esclavo (`Cubo-Esclavo.ino`) | Localizar ese archivo | No forma parte de esta serie de sesiones de edición |
| Revisar `fe2.ts` | 🟢 BAJO | Registrado: archivo vacío (`//Indefinida por el momento`), sin dependencias, no forma parte del flujo actual (`agents/actions/actuar/` no se importa desde ningún otro archivo) | Ninguna | Ninguna | Tarea independiente futura, no relacionada con la normalización de nombres |
| Corregir errores de compilación preexistentes del frontend | 🟢 BAJO | Confirmados 2 errores preexistentes, no introducidos por ningún cambio de estas sesiones: `Cube.tsx` (re-exportación de tipo con `isolatedModules`) y colisión de mayúsculas `Graph.ts`/`graph.ts` | Ninguna | Ninguna | Fuera del alcance de la edición de la tesis |

---

## Bibliografía

| Pendiente | Prioridad | Estado | Dependencia | Evidencia necesaria | Próximo paso |
|---|---|---|---|---|---|
| `Cardenas2017` | 🟠 ALTO | Sin verificar — el propio autor dejó una nota pendiente en `main.tex` (líneas 613-623) señalando datos posiblemente incompletos | Ninguna | Nombre completo de autores, año exacto, título exacto del documento original | El autor verifica contra el repositorio de la Universidad Distrital |
| `RodriguezLopez2017` | 🟠 ALTO | Sin verificar; además el título tiene un error de copiado ("aritmético s" con espacio) | Ninguna | Igual que arriba | Igual que arriba |
| `Natalia2017` | 🟠 ALTO | Sin verificar | Ninguna | Igual que arriba | Igual que arriba |
| `Frith2003` / `Frith1989` | 🟡 MEDIO | Posible entrada duplicada o ediciones distintas del mismo libro, sin campo `edition` para diferenciarlas; `Frith1989` no parece citada en el cuerpo del texto | Ninguna | Confirmación del autor sobre si son ediciones distintas | Preguntar al autor |
| Ejecutar BibTeX | 🟢 BAJO | Nunca ejecutado en estas sesiones (solo se corrió `pdflatex`, por eso las citas aparecen como "undefined" en el log) | Ninguna | Ninguna | Ejecutar `bibtex main` + 2 pasadas de `pdflatex` cuando se autorice una compilación completa |
| Resolver citas "undefined" | 🟢 BAJO | Consecuencia directa del punto anterior, no es un error de contenido | Ejecutar BibTeX | Ninguna | Se resuelve automáticamente al ejecutar BibTeX |
