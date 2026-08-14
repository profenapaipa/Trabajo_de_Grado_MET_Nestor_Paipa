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
| Elegir → Actuar en el resto de `main.tex` | 🟠 ALTO | Sin ejecutar (19 ubicaciones ya mapeadas: 12 texto + 5 identificadores TikZ) | Ninguna | Ninguna adicional | Autorización explícita (Fase 9) |
| Corregir Figura 4.2 ("Agente Elegir" → "Agente Actuar") | — | ✅ Resuelto y verificado (compilado, revisado visualmente) | — | — | — |
| Revisar flechas de Figura 4.2 | 🟡 MEDIO | Parcial: se renombró el texto, pero **no** se corrigió la estructura (el diagrama muestra los 3 agentes como paralelos, mientras el texto de "flujo operativo" los describe como secuencia Pausar→Pensar→Actuar) | Autorización para tocar "Propuesta estructural integradora" | Confirmación del autor sobre si el modelo es paralelo o secuencial | Señalado, no corregido |
| Eliminar "Juego Inteligente xxxx" de Figuras 4.3 y 4.4 | — | ✅ Resuelto (captions reescritos con base en el contenido real de las imágenes) | — | — | — |
| Revisar figuras que se salen del ancho útil de la página | — | ✅ Resuelto: Figuras 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7 y Tablas 4.3/4.4 verificadas dentro del margen (compilado y revisado visualmente). Nota: la Figura 4.1 sigue siendo densa/de texto pequeño por ser una imagen fuente compleja — eso es una limitación del gráfico original, no un desborde de página | — | — | — |
| Revisar lenguaje de autonomía | 🟡 MEDIO | Mapeadas 5 ubicaciones exactas (líneas 2173, 2550, 2600, 2601, 2606); ninguna corregida todavía | Fase 9 (comparten líneas con el flujo operativo) | Ninguna adicional | Autorización (Fase 10) |
| Unificar valores de PAUSAR/PENSAR/ACTUAR | 🟠 ALTO | Sin ejecutar; fuente de verdad ya decidida (`App.tsx`) | Fase 9 | Ninguna adicional | Autorización (Fase 11) |
| Resolver relación entre los dos guiones experimentales | 🔴 CRÍTICO | 🔴 Bloqueada — decisión metodológica pendiente del autor | Respuesta del autor | Definición explícita: ¿condiciones comparativas, protocolo integrado, o versiones sucesivas? | Esperar decisión del autor |
| Nota de alcance preexperimental | 🟡 MEDIO | Sin ejecutar (diseño ya definido: párrafo breve en apertura de Metodología y de Resultados) | Ninguna | Ninguna | Autorización (Fase 8) |
| Participantes | 🔴 CRÍTICO | Sin definir — no hay datos reales, no deben inventarse | Ejecución futura de la fase experimental | Datos reales de los participantes | Esperar definición de muestra |
| Ética / consentimiento informado | 🔴 CRÍTICO | Sin proceso documentado | Gestión institucional por parte del autor | Aprobación de comité de ética / consentimiento firmado | El autor gestiona el trámite |
| Limitaciones | 🟡 MEDIO | No existe la sección en el documento | Ninguna | Ninguna | Redactar cuando se autorice |
| Puente HRS-EDU (referente → adaptación → simplificación → implementación → futuro) | 🟡 MEDIO | Diseñado, no redactado | Ninguna | Ninguna | Autorización (Fase 14) |
| Bibliografía | 🟠 ALTO | Ver tabla dedicada abajo | — | — | — |
| Placeholders residuales | 🟢 BAJO | Parcial: mAh del cubo (3.7V/180mAh) y la denominación del microcontrolador ya se corrigieron en "Descripción técnica de los cubos inteligentes" y "Funcionamiento electrónico de la base de los cubos". **Sigue sin resolver**: "Centro ACACIA de la Universidad..... xxx." | Confirmación del autor | Nombre completo de la universidad/centro | Preguntar al autor |

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
