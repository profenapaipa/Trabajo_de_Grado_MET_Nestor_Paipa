// ============================================================
//  Cubo_Esclavo_v3.ino
//  Firmware del ESP32-C3 SuperMini (cubo esclavo) — versión 3
// ============================================================
//  Parte de Cubo_Esclavo_v2.ino (Desarrollo_cubos_juego_escalera/
//  Cubo_Esclavo_v2/), que se deja CONGELADO como backup fiel de la
//  versión anterior (a su vez copia idéntica del original ACACIA:
//  Versión1ACACIA-Cubos-inteligentes-main/.../Cubo-Esclavo.ino, que
//  sigue sin tocarse bajo ninguna circunstancia).
//
//  ================================================================
//  MOTIVO DEL CAMBIO (Fase 1 de optimización, 2026-09-17)
//  ================================================================
//  El maestro (Maestro_v3.ino) pasó de abrir una conexión TCP nueva
//  por cada comando a mantener UNA conexión persistente por cubo.
//  Este firmware se adapta para aceptar esa conexión persistente y
//  atenderla sin bloquear, en vez de leer con readStringUntil()
//  (bloqueante) y cerrar la conexión en cada vuelta como hacía
//  Cubo_Esclavo_v2.ino.
//
//  Cambios respecto a Cubo_Esclavo_v2.ino:
//   1. Conexión persistente: se acepta un cliente y se conserva
//      mientras siga conectado, en vez de aceptar y soltar en cada
//      mensaje. Se lee byte a byte con available()/read() (no
//      bloqueante) y se arma la línea manualmente.
//   2. Parpadeo del LED no bloqueante: confi_luces() usaba delay()
//      dentro del propio parpadeo, lo que congelaba el socket (no se
//      podían recibir comandos nuevos ni detectar una caída de WiFi
//      mientras "parpadeaba"). Ahora es una máquina de estados basada
//      en millis() que se actualiza en cada vuelta de loop().
//  Los pendientes ya registrados en PENDIENTES_TESIS.md, sección
//  "Configuración sensorial PPA de los cubos (Tabla 4.1)" siguen
//  abiertos y no se tocan en este cambio:
//   - Recalibrar la intensidad de vibración de Pausar.
//   - Diferenciar el patrón de vibración por fase.
//   - Definir un color inicial por defecto (azul/rojo según equipo).
//   - Corregir el balance de canales del LED RGB (amarillo).
//  El canal de sonido (buzzer) sigue resuelto por software desde el
//  navegador del docente (ver App.tsx: playTone/playBipBip/
//  playAscending).
//
//  Esta es la versión candidata a flashear en los cubos físicos. Antes
//  de subirla a cada cubo, editar local_IP más abajo con el último
//  octeto correspondiente a ese cubo (192.168.4.2 al .11 para los
//  cubos 1 al 10, ver tabla en Maestro_v3.ino / ipEsclavos[]).
//
//  ================================================================
//  CONTROL DE PARTIDA Y CÓDIGO DE COLORES (Fase 2, 2026-09-17)
//  ================================================================
//  Se agregó un motor de "efectos" no bloqueante (EF=<n>, ver
//  iniciarEfecto/actualizarEfecto): secuencias de color+vibración de
//  varios pasos (conexión, movimiento inválido, bloqueo, victoria,
//  cuenta regresiva) que corren enteras dentro del cubo con un solo
//  mensaje, sin depender de que el frontend mande varios comandos
//  seguidos. El cubo deriva su propio color de equipo (azul/rojo) del
//  último octeto de su local_IP, sin configuración adicional.
//
//  ================================================================
//  CORRECCIÓN (2026-09-18, prueba con hardware real)
//  ================================================================
//  Tras la prueba, los cubos no mostraban azul/rojo y Pausar/Pensar/
//  Actuar no se reflejaban. Encontradas dos causas reales (no las
//  señales de conexión EF=1/EF=2, que se habían agregado justo antes y
//  se sospechaban al inicio — ver Maestro_v3.ino para el detalle):
//   1. "restaurar" volvía el cubo a NEGRO (0,0,0). El frontend lo
//      dispara en CADA evento de posición del tablero, así que
//      cualquier cubo ya "modificado" (incluido el color de equipo de
//      rutina) se apagaba solo con que OTRO cubo cambiara de posición.
//      Corregido: "restaurar" ahora vuelve al color de equipo propio.
//   2. El color de equipo al conectar dependía de que el maestro o el
//      frontend se lo reafirmaran después. Corregido: conectarWifi()
//      se asienta directo en el color de equipo (ya calculado antes,
//      en setup(), desde local_IP), sin depender de nadie más.
//  Se reactivó también Serial.begin(115200) (antes comentado) con
//  trazas en cada punto de recepción/aplicación de comandos, para
//  depurar por Monitor Serial si algo vuelve a fallar. Si el cubo usa
//  USB nativo (no un chip USB-serie aparte), activar "USB CDC On Boot:
//  Enabled" en Herramientas del IDE para poder ver estos mensajes.
//
//  ================================================================
//  REFERENCIA ÚNICA DE PRIORIDAD VISUAL (2026-09-18)
//  ================================================================
//  La tabla completa de qué gana sobre qué (bloqueo > victoria > cuenta
//  regresiva > sesión pausada > movimiento inválido > señal PPA manual >
//  color de equipo en reposo) vive en ESTADO_VISUAL_CUBOS.md, en la raíz
//  de Desarrollo_cubos_juego_escalera/ — la implementa
//  core/ppa/cubeVisualState.ts en el frontend. Este firmware no decide
//  esa prioridad por su cuenta: su único contrato es ejecutar cualquier
//  EF=<n>/M=.../restaurar recibido como reemplazo atómico y completo del
//  estado anterior (ya lo hace: iniciarEfecto/actualizarColorObjetivo/
//  setColorSolid siempre apagan cualquier efecto en curso antes de
//  aplicar el nuevo). Si se agrega un EF= nuevo o cambia el criterio de
//  prioridad, actualizar ese documento primero.
// ============================================================

#include <WiFi.h>


//configuración de pines - LED, Motor y pinfisico

const int motorpin = 5;
const int Rpin = 4;  // Analog input pin that the potentiometer is attached to
const int Gpin = 3;  // Analog output pin that the LED is attached to
const int Bpin = 2;
const int Pfcaja = 6;

bool conex = false;


// IP estática (debes evitar conflicto entre dispositivos)
const char* ssid = "ESP32_Master_AP";
const char* password = "12345678";

IPAddress local_IP(192,168,4,10);     // Cambia el ultimo digito para que sean unicos e identificables
IPAddress gateway(192,168,4,1);
IPAddress subnet(255,255,255,0);

WiFiServer server(3333);
WiFiClient cliente;          // conexión persistente con el maestro
String bufferEntrada = "";

//definicion de constantes y variables
const int Freq_max = 900;
String id_caja;

// --- estado del parpadeo no bloqueante ---
String colorR = "0", colorG = "0", colorB = "0";
unsigned long medioPeriodoMs = 0;   // 0 = color fijo, sin parpadeo
unsigned long ultimoToggleLed = 0;
bool ledEncendidoAhora = false;

// --- color de equipo por defecto (derivado de local_IP, sin config extra) ---
// El último octeto de local_IP ya es único por cubo (192.168.4.2..11 =
// cubos 1..10, obligatorio configurarlo al flashear cada uno). id<=5 =
// equipo A (azul), igual que teamAColor/teamBColor en App.tsx del frontend.
int colorEquipoR = 0, colorEquipoG = 0, colorEquipoB = 255;

// --- color de "sin WiFi / reconectando": magenta ---
// Antes era rojo fijo (255,0,0), idéntico al color del equipo B: un cubo
// rojo desconectado no se distinguía de uno rojo conectado y bien. Magenta
// no lo usa ningún otro estado (equipos azul/rojo, PPA celeste/amarillo/
// verde, inválido naranja, bloqueo/victoria que terminan en blanco).
// Decisión del autor, 2026-09-18.
const int COLOR_DESC_R = 255, COLOR_DESC_G = 0, COLOR_DESC_B = 255;

// --- color de "conectado al maestro, esperando confirmación": naranja ---
// Mismo naranja que EFECTO_3_INVALIDO (255,140,0) — sin conflicto real: este
// solo se ve una vez, al arrancar, antes de que llegue la primera
// confirmación; el de movimiento inválido solo aparece después, ya en
// juego. Decisión del autor, 2026-09-18: por defecto el cubo debe verse
// naranja hasta que el sistema completo (maestro+backend+frontend) lo
// confirme y le mande su color de equipo — no autoasignárselo solo.
const int COLOR_ESPERA_R = 255, COLOR_ESPERA_G = 140, COLOR_ESPERA_B = 0;

// --- motor de efectos no bloqueante (EF=<n>): secuencias de color y
// vibración de varios pasos que corren enteramente en el cubo, sin
// depender de que el frontend mande varios comandos seguidos. r=-1 en un
// paso significa "usar el color de equipo actual" (colorEquipoR/G/B).
// durMs=0 en un paso significa "mantener para siempre" (paso final).
struct PasoEfecto { int r, g, b; float vib; unsigned long durMs; };

const PasoEfecto EFECTO_1_CONEXION_BACK[]  = { {0, 240, 255, 0.0, 3000}, {-1, 0, 0, 0.0, 0} };
const PasoEfecto EFECTO_2_CONEXION_FRONT[] = { {176, 38, 255, 0.0, 3000}, {-1, 0, 0, 0.0, 0} };
const PasoEfecto EFECTO_3_INVALIDO[]       = { {255, 140, 0, 0.7, 1000}, {-1, 0, 0, 0.0, 0} };
const PasoEfecto EFECTO_4_BLOQUEO[]        = {
  {255, 0, 0, 0.90, 500}, {255, 0, 0, 0.65, 500}, {255, 0, 0, 0.40, 500}, {255, 0, 0, 0.15, 500},
  {255, 255, 255, 0.0, 0},
};
const PasoEfecto EFECTO_5_VICTORIA[]       = {
  {0, 255, 0, 0.6, 400}, {255, 215, 0, 0.6, 400}, {0, 255, 0, 0.6, 400}, {255, 215, 0, 0.6, 400},
  {255, 255, 255, 0.0, 0},
};
const PasoEfecto EFECTO_6_CUENTA_TICK[]    = { {0, 255, 255, 0.0, 300}, {-1, 0, 0, 0.0, 0} };
const PasoEfecto EFECTO_7_CUENTA_INICIA[]  = { {0, 255, 0, 0.0, 300}, {-1, 0, 0, 0.0, 0} };

const PasoEfecto* efectoPasos    = nullptr;
int   efectoNumPasos             = 0;
int   efectoPasoActual           = 0;
unsigned long efectoInicioPaso   = 0;
bool  efectoActivo               = false;

// definición de funciones

// Aplica un color sólido de inmediato (sin parpadeo), útil para el
// estado de "desconectado" o justo al reconectar.
void setColorSolid(int r, int g, int b) {
  efectoActivo = false; // un comando normal cancela cualquier efecto EF= en curso
  analogWrite(Rpin, r);
  analogWrite(Gpin, g);
  analogWrite(Bpin, b);
  medioPeriodoMs = 0;
}

// Aplica la vibración de un paso de efecto directamente desde un float
// (0.0 = motor apagado), sin pasar por confi_vibromotor(String) para
// evitar el redondeo de String(float) al comparar contra "0.0".
void aplicarVibracion(float v) {
  analogWrite(motorpin, v > 0.0f ? (int)(v * 205 + 50) : 0);
}

void aplicarPasoEfecto(int i) {
  const PasoEfecto &p = efectoPasos[i];
  int r = p.r, g = p.g, b = p.b;
  if (r == -1) { r = colorEquipoR; g = colorEquipoG; b = colorEquipoB; }
  analogWrite(Rpin, r);
  analogWrite(Gpin, g);
  analogWrite(Bpin, b);
  aplicarVibracion(p.vib);
  efectoInicioPaso = millis();
  Serial.printf("  paso %d/%d -> RGB(%d,%d,%d) vib=%.2f dur=%lums\n", i + 1, efectoNumPasos, r, g, b, p.vib, p.durMs);
}

// Arranca una de las secuencias enlatadas (EF=1..7). Cancela cualquier
// parpadeo en curso; un comando normal posterior (M=... o restaurar)
// cancela el efecto a su vez (ver setColorSolid/actualizarColorObjetivo).
void iniciarEfecto(int numero) {
  Serial.printf("EF=%d recibido\n", numero);
  const PasoEfecto* tabla = nullptr;
  int n = 0;
  switch (numero) {
    case 1: tabla = EFECTO_1_CONEXION_BACK;  n = 2; break;
    case 2: tabla = EFECTO_2_CONEXION_FRONT; n = 2; break;
    case 3: tabla = EFECTO_3_INVALIDO;       n = 2; break;
    case 4: tabla = EFECTO_4_BLOQUEO;        n = 5; break;
    case 5: tabla = EFECTO_5_VICTORIA;       n = 5; break;
    case 6: tabla = EFECTO_6_CUENTA_TICK;    n = 2; break;
    case 7: tabla = EFECTO_7_CUENTA_INICIA;  n = 2; break;
    default:
      Serial.println("  numero de efecto desconocido, se ignora");
      return;
  }
  efectoPasos      = tabla;
  efectoNumPasos   = n;
  efectoPasoActual = 0;
  efectoActivo     = true;
  medioPeriodoMs   = 0; // cancela cualquier parpadeo en curso
  aplicarPasoEfecto(0);
}

// Avanza la secuencia según el tiempo transcurrido. No bloquea nunca;
// se llama en cada vuelta de loop(), igual que actualizarParpadeo().
void actualizarEfecto() {
  if (!efectoActivo) return;
  const PasoEfecto &actual = efectoPasos[efectoPasoActual];
  if (actual.durMs == 0) return; // paso final: se mantiene para siempre
  if (millis() - efectoInicioPaso >= actual.durMs) {
    efectoPasoActual++;
    if (efectoPasoActual >= efectoNumPasos) { efectoActivo = false; return; }
    aplicarPasoEfecto(efectoPasoActual);
  }
}

// Define el color/frecuencia objetivo del parpadeo. No bloquea: solo
// arma la máquina de estados que actualizarParpadeo() avanza en cada
// vuelta de loop().
void actualizarColorObjetivo(String Led_r, String Led_g, String Led_b, String freq) {
  efectoActivo = false; // un comando normal cancela cualquier efecto EF= en curso
  colorR = Led_r;
  colorG = Led_g;
  colorB = Led_b;
  Serial.println("actualizarColorObjetivo: LR=" + Led_r + " LG=" + Led_g + " LB=" + Led_b + " F=" + freq);

  float f = freq.toFloat();
  medioPeriodoMs = (unsigned long)(Freq_max * f);

  if (medioPeriodoMs == 0) {
    // frecuencia 0 = color fijo, sin parpadeo
    analogWrite(Rpin, colorR.toInt());
    analogWrite(Gpin, colorG.toInt());
    analogWrite(Bpin, colorB.toInt());
    return;
  }

  ultimoToggleLed = millis();
  ledEncendidoAhora = true;
  analogWrite(Rpin, colorR.toInt());
  analogWrite(Gpin, colorG.toInt());
  analogWrite(Bpin, colorB.toInt());
}

// Avanza el parpadeo según el tiempo transcurrido. Se debe llamar en
// cada vuelta de loop(); nunca usa delay().
void actualizarParpadeo() {
  if (medioPeriodoMs == 0) return; // color fijo, nada que alternar
  if (millis() - ultimoToggleLed >= medioPeriodoMs) {
    ultimoToggleLed = millis();
    ledEncendidoAhora = !ledEncendidoAhora;
    if (ledEncendidoAhora) {
      analogWrite(Rpin, colorR.toInt());
      analogWrite(Gpin, colorG.toInt());
      analogWrite(Bpin, colorB.toInt());
    } else {
      analogWrite(Rpin, 0);
      analogWrite(Gpin, 0);
      analogWrite(Bpin, 0);
    }
  }
}

//Función para configurar la intensidad de vibración del motor
void confi_vibromotor(String I_motor){

if (I_motor!="0.0"){
  int inte_motor=I_motor.toFloat()*205+50;
  analogWrite(motorpin,inte_motor);
}
else{
  analogWrite(motorpin,0);
}

}

// Función genérica para extraer valores
String extraerValor(const String &data, const String &clave) {
  int start = data.indexOf(clave) + clave.length();
  int end = data.indexOf(',', start);
  if (end == -1) end = data.length(); // Último campo
  return data.substring(start, end);
}

void procesarLinea(const String &cadena) {
  Serial.println("Linea recibida: [" + cadena + "]");
  if (cadena.startsWith("EF=")) {
    iniciarEfecto(cadena.substring(3).toInt());
    return;
  }

  if (cadena == "restaurar") {
    // "restaurar" lo dispara el frontend en CADA evento de posición del
    // tablero (handleStateChange -> restaurarCubos), no solo cuando de
    // verdad hay que apagar una señal PPA. Antes volvía a (0,0,0) (negro),
    // así que cualquier cubo ya "modificado" (incluida la asignación
    // rutinaria de color de equipo al conectar) se apagaba solo con que
    // CUALQUIER cubo del tablero cambiara de posición. Corregido
    // (2026-09-18, prueba con hardware real) para que "restaurar" vuelva
    // al color de equipo del propio cubo, no a negro.
    confi_vibromotor("0.0");
    actualizarColorObjetivo(String(colorEquipoR), String(colorEquipoG), String(colorEquipoB), "0.0");
    return;
  }

  String valor_motor = extraerValor(cadena, "M=");
  String lr           = extraerValor(cadena, "LR=");
  String lg           = extraerValor(cadena, "LG=");
  String lb           = extraerValor(cadena, "LB=");
  String freq         = extraerValor(cadena, "F=");

  // Se compara como número, no como texto: el maestro formatea con "%.2f"
  // ("0.00"), y confi_vibromotor() compara contra el texto "0.0" — nunca
  // coincidían, así que el motor quedaba encendido a PWM 50 (~20%) cada vez
  // que un cubo volvía a su color de equipo con vibración 0. Misma fórmula
  // que antes para cualquier valor mayor que 0 (Pausar/Pensar/Actuar sin
  // cambios).
  aplicarVibracion(valor_motor.toFloat());
  actualizarColorObjetivo(lr, lg, lb, freq);
}

// Acepta/mantiene la conexión persistente del maestro y arma las
// líneas recibidas byte a byte, sin ninguna llamada bloqueante.
void procesarRed() {
  if (!cliente.connected()) {
    WiFiClient nuevo = server.available();
    if (!nuevo) return;
    cliente = nuevo;
    bufferEntrada = "";
    Serial.println("Maestro conectado (nueva conexion aceptada en :3333)");
  }

  while (cliente.available()) {
    char c = cliente.read();
    if (c == '\n') {
      procesarLinea(bufferEntrada);
      bufferEntrada = "";
    } else if (c != '\r') {
      bufferEntrada += c;
      if (bufferEntrada.length() > 128) bufferEntrada = ""; // basura, reiniciar
    }
  }
}


void setup() {

  // Activado temporalmente para depurar por qué los comandos no se ven
  // reflejados en el cubo (2026-09-18) — antes estaba comentado. No usa
  // los mismos pines que el LED/motor (UART0 = GPIO20/21 en el
  // ESP32-C3 SuperMini), así que no interfiere con nada.
  Serial.begin(115200);
  delay(200);
  Serial.println("\n--- Cubo esclavo arrancando ---");

  // Color de equipo derivado del último octeto de local_IP (192.168.4.2
  // al .11 = cubos 1 al 10; equipo A/azul si id<=5, igual que
  // teamAColor/teamBColor en App.tsx del frontend).
  int miIdFisico = local_IP[3] - 1;
  if (miIdFisico <= 5) { colorEquipoR = 0;   colorEquipoG = 0; colorEquipoB = 255; }
  else                 { colorEquipoR = 255; colorEquipoG = 0; colorEquipoB = 0;   }
  Serial.printf("miIdFisico=%d  colorEquipo=(%d,%d,%d)\n", miIdFisico, colorEquipoR, colorEquipoG, colorEquipoB);

  // Configurar IP estática antes de conectarse
  WiFi.config(local_IP, gateway, subnet);

  conectarWifi();
  server.begin();
  pinMode(Pfcaja, OUTPUT);
  digitalWrite(Pfcaja, HIGH);
  Serial.println("Listo, esperando conexión del maestro en el puerto 3333...");
}


void loop() {

  if (WiFi.status() != WL_CONNECTED) {
    conex = false;
    setColorSolid(COLOR_DESC_R, COLOR_DESC_G, COLOR_DESC_B);  // magenta = sin WiFi
    confi_vibromotor("0.0");
    conectarWifi();  // Reintenta solo si se perdió la conexión
    return;
  }

  procesarRed();
  actualizarEfecto();
  actualizarParpadeo();
}

void conectarWifi() {

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    setColorSolid(COLOR_DESC_R, COLOR_DESC_G, COLOR_DESC_B);
    confi_vibromotor("0.0");
    conex = false;
    delay(500);
  }

  // NO se asienta en su color de equipo todavía: se queda en naranja (color
  // de "esperando confirmación") hasta que el frontend lo vea conectado de
  // verdad (backend + frontend, no solo el WiFi al maestro) y le mande el
  // color de equipo explícito — decisión del autor, 2026-09-18. Antes se
  // autoasignaba aquí mismo para no depender de que nadie se lo confirmara;
  // ahora se pide justo lo contrario: que el naranja sea la señal visible
  // de "conectado al maestro pero todavía no confirmado por el sistema
  // completo". El primer comando M=.../EF=... que llegue (cualquiera)
  // reemplaza este naranja igual que reemplazaría cualquier otro estado.
  setColorSolid(COLOR_ESPERA_R, COLOR_ESPERA_G, COLOR_ESPERA_B);
  conex = true;
}
