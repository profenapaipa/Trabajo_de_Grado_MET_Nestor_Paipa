# ESTADO DEL PROYECTO

*Última actualización: 2026-08-14*

Panel de control del proyecto de tesis "Uso de EEG para explorar la influencia de herramientas con agentividad en el control inhibitorio durante la resolución del juego La Escalera en niños con Trastorno del espectro Autista - TEA nivel 1" y su prototipo tecnológico asociado (cubos inteligentes).

Leyenda: ✅ COMPLETADA · 🟡 EN CURSO · 🔴 BLOQUEADA · ⏳ PENDIENTE · 🔵 RESERVADA (post-experimental)

---

## Tabla general de fases

| Fase | Nombre | Estado | Dependencias | Próximo paso |
|---|---|---|---|---|
| 0 | Preparación | ✅ | Ninguna | — |
| 1 | Diagnóstico integral | ✅ | Fase 0 | — |
| 2 | Reanálisis metodológico (etapa preexperimental, Mago de Oz, fuente de verdad = código) | ✅ | Fase 1 | — |
| 3 | Auditoría HRS-EDU (lectura completa del artículo primario) | ✅ | PDF disponible (commit `143e398`) | — |
| 4 | Normalización de código Elegir → Actuar (carpeta `actions/elegir/` → `actions/actuar/`) | ✅ | Ninguna | — |
| 5 | Incorporación del PDF de referencia HRS-EDU al proyecto | ✅ | Ninguna | — |
| 6 | Actualización inicial de Materiales (protocolo real, hub, brecha de sonido) | ✅ | Fases 4-5 | — |
| 7 | Arquitectura tecnológica (3 figuras + 2 tablas + arquitectura híbrida: canal de posición cableado + canal de actuación WiFi/TCP 3333) | ✅ | Fase 6 | Autorizar commit |
| 8 | Nota de alcance preexperimental (Metodología/Resultados) | ⏳ | Ninguna | Autorizar redacción |
| 9 | Elegir → Actuar en el resto de `main.tex` (19 ubicaciones mapeadas: 12 texto + 5 identificadores TikZ) | ⏳ | Ninguna | Autorizar ejecución |
| 10 | Corrección del lenguaje de autonomía (Mago de Oz) — 5 ubicaciones mapeadas | ⏳ | Fase 9 (parcial); la parte dentro del Guión técnico depende de la Fase 12 | Autorizar sub-zona B1 (Propuesta estructural) |
| 11 | Unificación de valores PAUSAR/PENSAR/ACTUAR (fuente de verdad = `App.tsx`) | ⏳ | Fase 9; la parte dentro del Guión técnico depende de la Fase 12 | Autorizar sub-zona E1 (Propuesta estructural) |
| 12 | Relación entre los dos guiones experimentales (verbal/gestual vs. técnico de cubos) | 🔴 BLOQUEADA | Decisión metodológica del autor | El autor define si son condiciones comparativas, protocolo integrado, o versiones sucesivas |
| 13 | Metodología (Participantes/Procedimiento en modo prospectivo) | ⏳ | Fases 8-12 | — |
| 14 | Puente conceptual HRS-EDU (referente → adaptación → simplificación → implementación → futuro) | ⏳ | Ninguna | Autorizar redacción del párrafo |
| 15 | Bibliografía (3 referencias pendientes + duplicado Frith + BibTeX) | ⏳ | Ninguna | Autorizar verificación |
| 16 | Resultados | 🔵 RESERVADA | Ejecución de la fase experimental (EEG) | Esperar datos reales |
| 17 | Conclusiones / Trabajos futuros | 🔵 RESERVADA | Fase 16 | Esperar Fase 16 |
| 18 | Auditoría final de LaTeX | 🔵 RESERVADA | Todas las anteriores | — |

---

## Progreso visual

```
PREPARACIÓN        ████████████████████ 100%
DIAGNÓSTICO        ████████████████████ 100%
HRS-EDU            ████████████████████ 100%
CÓDIGO             ████████████████████ 100%
MATERIALES         ████████████████████ 100%
ARQUITECTURA       ████████████████████ 100% (cerrada, sin commit)
METODOLOGÍA        ░░░░░░░░░░░░░░░░░░░░  Pendiente
EXPERIMENTO        ░░░░░░░░░░░░░░░░░░░░  Reservado
```

---

## FASE ACTUAL

**FASE 7 — ARQUITECTURA TECNOLÓGICA**

Estado: ✅ CERRADA (cumple los 11 criterios de cierre: arquitectura física y de red coherentes; maestro y cubos correctamente identificados; alimentación correctamente descrita; canal de posición y canal de actuación diferenciados; TCP 3333 documentado; Figura 4.2 normalizada; Figuras 4.3/4.4 con captions definitivos; todas las figuras dentro del ancho útil; compila sin errores nuevos; sin contradicciones introducidas; redacción de carácter consolidado) — **pendiente únicamente de commit**.

Resumen: se incorporó evidencia física confirmada por el autor sobre ESP32-C3 SuperMini (cubos), ESP32 DevKit V1 (maestro), alimentación (batería Li-Po 3.7V/180mAh en el cubo, Power Bank en el maestro), acoplamiento magnético y cableado de las bases. Se verificó contra el firmware disponible (`Maestro___Wifi_copy_20260813194508.ino`, confirmado por el autor como el firmware físicamente instalado) y se documentó la arquitectura híbrida de dos canales: posición (cableado, GPIO del maestro) y actuación (WiFi/TCP:3333). Se corrigieron además las inconsistencias heredadas de la Fase 6 en "Descripción técnica de los cubos inteligentes" y "Funcionamiento electrónico de la base de los cubos", y el desbordamiento de página de las Figuras 4.1, 4.3 y 4.4.

## PRÓXIMA ACCIÓN

Decidir si se hace commit de la Fase 7 antes de continuar. Después, las siguientes fases sin bloqueo son la Fase 8 (nota de alcance preexperimental), la Fase 9 (Elegir → Actuar en el resto de `main.tex`) y la Fase 14 (puente conceptual HRS-EDU) — cualquiera de las tres puede autorizarse de forma independiente. La Fase 12 (relación entre los dos guiones experimentales) sigue bloqueada a la espera de una decisión metodológica del autor.

---

## Historial de commits importantes

| Commit | Mensaje | Fecha |
|---|---|---|
| `dcae481` | Estado inicial antes de revisión integral de tesis | 2026-08-13 |
| `775c7b6` | Normaliza nomenclatura elegir a actuar | 2026-08-13 |
| `143e398` | Incorpora referencia HRS-EDU | 2026-08-13 |
| `1370ddc` | Actualiza materiales del prototipo tecnológico | 2026-08-13 |

Los cambios de la Fase 7, ya cerrada (arquitectura tecnológica: 3 figuras + 2 tablas + arquitectura híbrida de dos canales + correcciones heredadas de la Fase 6 + corrección de anchos de página), están hechos en el árbol de trabajo (`Trabajo_de_Grado_MET_Nestor_Paipa/main.tex` y `main.pdf`) pero **todavía no tienen commit** — a la espera de que el autor lo solicite explícitamente.

---

## Registro de cambios

| Fecha | Fase | Acción | Resultado | Commit |
|---|---|---|---|---|
| 2026-08-13 | 0-1 | Diagnóstico integral inicial del proyecto (tesis + prototipo) | Completado | `dcae481` (estado base) |
| 2026-08-13 | 4 | Rename `actions/elegir/` → `actions/actuar/` en el frontend | Completado, verificado sin romper la compilación | `775c7b6` |
| 2026-08-13 | 5 | Incorporación del PDF "Human-Robot Scaffolding" al proyecto | Completado | `143e398` |
| 2026-08-13 | 6 | Actualización de Materiales: protocolo real (WiFi), modelo de hub, brecha de sonido | Completado, compiló sin errores nuevos | `1370ddc` |
| 2026-08-14 | 7 | Arquitectura tecnológica: 3 figuras TikZ + 2 tablas en "Funcionamiento electrónico/lógico de los cubos"; corrección con evidencia física (ESP32-C3 SuperMini, ESP32 DevKit V1, Power Bank, canal de posición cableado); corrección de Figura 4.2 y captions de Figuras 4.3/4.4 | En corrección — compiló sin errores fatales, sin commit todavía | *(pendiente)* |
| 2026-08-14 | 7 | Cierre definitivo: confirmación del autor de que TCP 3333/el firmware disponible es el instalado; corrección heredada de "Descripción técnica de los cubos" y "Funcionamiento electrónico de la base" (ESP32-C3 SuperMini / ESP32 DevKit V1 / batería 3.7V-180mAh); corrección de ancho de Figuras 4.1, 4.3 y 4.4; consolidación de tono (buzzer como componente de la arquitectura, no como defecto) | ✅ Cerrada — compiló sin errores fatales tras corregir un error de sintaxis TikZ (salto de línea en modo LR); sin commit todavía | *(pendiente)* |

*Nota: no se registran fechas ni commits distintos de los verificados directamente con `git log`. Si una fase futura no tiene commit, esta tabla lo indica explícitamente como "(pendiente)" en vez de inventar uno.*
