# Pendientes para la reunión con el director

Este archivo cierra el Bloque A (documento primero, sin hardware conectado). Resume lo que quedó marcado en el texto, lo que hay que decidir con el director, y las inconsistencias detectadas entre la metodología nueva y el resto del documento. Todas las referencias son a `Trabajo_de_Grado_MET_Nestor_Paipa/main.tex`.

## 1. Sujeto a verificación técnica

Cinco marcas `% [SUJETO A VERIFICACIÓN TÉCNICA]` quedaron en el capítulo de Metodología. Ninguna afirma que el prototipo ya hace algo que no se pudo verificar; todas están redactadas en condicional ("debería", "está pendiente de implementación").

1. **Línea 2608** — sección *Funcionamiento lógico de la base de los cubos*. El texto dice que la base "debería mantener un registro de los eventos de activación" (marca de tiempo, cubo activado, fase, estado emocional). **Confirmar:** que el backend/firmware efectivamente implemente y persista este registro; hoy no existe ningún mecanismo de persistencia (verificado en el código).
2. **Línea 2647** — sección *Manual de usuario*. El texto dice que el sistema "debería permitir exportar el registro de activaciones en formato CSV". **Confirmar:** que exista una función de exportación real desde la interfaz; hoy tampoco existe.
3. **Línea 2794** — guion experimental, párrafo *Registro del ejercicio*. Describe qué debe registrarse por ejercicio (cambios de posición, sugerencias con motivo, confirmación/descarte, activación de fase). **Confirmar:** que el esquema de bitácora de la Fase 6 (Bloque B) cubra exactamente estos campos.
4. **Línea 2814** — *Métricas y Análisis § Sincronización de las fuentes de datos*. Describe el mecanismo de marca de inicio manual (gesto visible en cámara). **Confirmar:** que el gesto quede efectivamente capturado por las tres fuentes (video, EEG, bitácora) en una sesión real, y que sea suficientemente preciso para la ventana de análisis.
5. **Línea 2819** — *Métricas y Análisis § Distinción entre cubo levantado y cubo no detectado*. Contiene la regla provisional basada en validez de movimiento (máximo un cubo levantado, perteneciente al conjunto de movimientos legales). **Confirmar:** que esta regla sea implementable con la señal real de los sensores de la base, y que no haya casos ambiguos no contemplados (por ejemplo, dos fallas de sensor simultáneas que sí parezcan un movimiento legal).

También hay un criterio de activación marcado como pendiente, no como sujeto a verificación técnica (ver sección 2).

## 2. Decisiones para consultar con el director

- **Criterio de activación de Actuar** (línea 2787, marcado `% [PENDIENTE: CRITERIO DE ACTIVACIÓN DE ACTUAR — CONSULTAR CON EL DIRECTOR]`). Pausar y Pensar ya tienen criterio operacional en firme (dos fallas consecutivas o señal de confusión). Actuar no se inventó; queda en blanco a propósito hasta que se defina con el director.
- **Categorías de la entrevista semiestructurada.** Ya se decidieron y están escritas en el documento (percepción del ciclo 123, percepción/utilidad de cada momento del PPA, frustración y cantidad de cubos, agentividad percibida, memoria del momento señalado). No están pendientes de invención, pero conviene presentárselas al director para su validación, ya que reemplazan por completo las categorías del guion anterior (que estaban pensadas para retroacciones, no para PPA).
- **Propuesta de ajuste del objetivo específico 2** (ver punto 4 más abajo): queda redactada en el documento, dentro de la sección Objetivos, pendiente de aprobación explícita del tutor.

## 3. Inconsistencia del título

El título (aparece en tres lugares: portada, contraportada y título corto) sigue en plural: *"...en niños con Trastorno del espectro Autista - TEA nivel 1"*. No lo cambié, tal como se acordó. Redacción alternativa para llevar a la reunión:

> Uso de EEG para explorar la influencia de herramientas con agentividad en el control inhibitorio durante la resolución del juego La Escalera en un niño con Trastorno del Espectro Autista - TEA nivel 1

(y su versión corta, cambiando igualmente solo "niños" por "un niño"):

> Herramientas con agentividad y su influencia en el control inhibitorio durante la resolución del juego La Escalera en un niño con Trastorno del Espectro Autista - TEA nivel 1

## 4. Otras inconsistencias encontradas

- **El Capítulo 3 (Interpretación de trayectorias del juego) asume un diseño de dos condiciones** ("sesión sin mediación" vs. "sesión con activación/mediación"), con métricas ya formalizadas (índices de buclicidad $B_e$, $B_i$) construidas sobre esa comparación binaria. El diseño acordado para el Capítulo 4 es una progresión de complejidad (1 a 5 cubos por lado, con PPA siempre disponible), sin una sesión base "sin mediación" explícita. Dejé esta tensión documentada en la nueva subsección "Propuesta de ajuste de objetivos" (dentro de §1.4 Objetivos), con una redacción alternativa para el objetivo específico 2, pendiente de aprobar con el tutor. **No toqué el Capítulo 3.**
- **`Metodología.pdf`, la plantilla visual que se replicó para la nueva Figura 4.1, no es de un estudio con TDAH** (como se creía al empezar). Es un estudio con estudiantes de sexto grado resolviendo geometría en DGPad, comparando retroacciones estándar vs. retroacciones con IA. El patrón visual (fases encadenadas con cajas Procedimiento/Producto) sí se replicó fielmente; solo el contexto de la comparación era distinto. Vale la pena no describirlo como "el estudio con TDAH" si sale el tema en la reunión.
- **Figura 4.8** (p. 68 del PDF compilado): la imagen es una captura de pantalla del logo de EEGLAB, pero su `\caption` dice "Diseño metodológico" — es un copy-paste de la caption de la Figura 4.1 vieja. No lo corregí porque está fuera del alcance de esta pasada (no se tocó Procedimiento salvo el guion experimental).
- **Diez usos restantes del label `fig:placeholder`** siguen generando warnings de "multiply defined" en la compilación (uno de los once originales se corrigió al reemplazar la Figura 4.1 con el label único `fig:diseno-metodologico`). No afecta el PDF visualmente, pero conviene limpiarlo en algún momento.
- Dos placeholders preexistentes, anteriores a esta sesión, siguen sin resolver: `[INFORMACIÓN FALTANTE]` en la tabla de componentes del sistema (fila "Firmware del cubo") y `[X] ms` de latencia estimada en *Funcionamiento electrónico de la base*. No se tocaron porque no forman parte de la metodología escrita hoy.
- Una nota de pendiente preexistente (línea 632) pide verificar en el repositorio de la Universidad Distrital los datos completos de tres referencias bibliográficas de `PaezGonzalez2022`. Sigue abierta, no relacionada con el trabajo de hoy.

## Estado del documento

`main.tex` compila sin errores (verificado con `latexmk` local, MiKTeX). El Bloque A queda cerrado aquí. Lo que sigue (Bloque B, Fases 6 en adelante) es cuando se conecten los cubos.
