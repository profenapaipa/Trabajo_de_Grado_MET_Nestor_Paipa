// ============================================================
//  Maestro_v3.ino
//  Firmware del ESP32 DevKit V1 (maestro) — versión 3
// ============================================================
//  Parte de Maestro_v2.ino (Desarrollo_cubos_juego_escalera/Maestro_v2/),
//  que se deja CONGELADO como backup fiel de la versión anterior (a su
//  vez copia del firmware físicamente instalado el 2026-08-13). No se
//  modifica Maestro_v2.ino ni el original ACACIA de línea base
//  (Versión1ACACIA-Cubos-inteligentes-main/.../Maestro - Wifi.ino).
//
//  ================================================================
//  MOTIVO DEL CAMBIO (Fase 1 de optimización, 2026-09-17)
//  ================================================================
//  Diagnóstico a partir de la bitácora real de la "Prueba voluntario"
//  del 2026-09-11/12: los ciclos de "base_desconectada"/"base_conectada"
//  cada ~11-12 s en el backend NO eran caídas reales de WiFi. Eran el
//  loop() de Maestro_v2.ino bloqueándose varios segundos porque
//  reportarEsclavosActivos() abría una conexión TCP nueva a cada uno
//  de los 10 esclavos, EN SERIE, sin timeout acotado. Mientras eso
//  bloqueaba, el maestro no podía hacer el GET a /api/obtenerComando,
//  que es lo único que le avisa al backend "sigo vivo"
//  (BASE_TIMEOUT_MS = 5000 en server/index.js). El mismo patrón de
//  connect() sin timeout ocurría en mensaje_esclavo() al enviar
//  comandos, explicando el flapping de esclavos individuales.
//
//  Cambios de esta versión respecto a Maestro_v2.ino:
//   1. Separación en dos tareas FreeRTOS:
//      - loop() (Arduino, core 1): SOLO lectura de pines físicos con
//        antirrebote. Nunca hace I/O de red, así que nunca se retrasa
//        por el backend ni por los esclavos.
//      - taskRed() (nueva, core 0): TODA la comunicación de red
//        (backend + esclavos). Se comunican mediante una cola
//        (colaPosiciones), no hay estado compartido sin protección.
//   2. Conexiones TCP persistentes a los esclavos (una por cubo, se
//      mantienen abiertas) en vez de abrir/cerrar una conexión por
//      cada mensaje. Verificar si un esclavo sigue activo es ahora
//      instantáneo (leer una bandera), no una operación de red.
//   3. Reconexión "round robin": cada vuelta de taskRed intenta
//      reconectar como máximo UN esclavo caído, con connect(ip, puerto,
//      timeout) acotado a 150 ms. El costo máximo por vuelta es de
//      150 ms, nunca la suma de los 10 intentos.
//   4. Comandos hacia esclavos desconectados momentáneamente ya no se
//      pierden en silencio: se guardan como "pendiente" y se reenvían
//      apenas el socket vuelve a conectar (con una edad máxima para no
//      reproducir comandos obsoletos).
//   5. Timeouts acotados también en las llamadas HTTP al backend
//      (setConnectTimeout/setTimeout), para que un backend lento no
//      bloquee taskRed más de lo necesario.
//   6. Antirrebote (debounce) de 25 ms en la lectura de los pines de
//      la base, para filtrar ruido mecánico antes de considerar un
//      cambio de estado válido.
//  El algoritmo de dos pasos para distinguir "cubo levantado" de
//  "cubo desconectado" (estado[]/baseAnterior[]/baseActual[]/
//  estadoaux[]) NO se modifica: sigue siendo el mismo, solo que ahora
//  vive en loop() y publica sus cambios a taskRed por cola en vez de
//  llamar directamente a HTTP.
//
//  Esta es la versión candidata a flashear en el maestro físico. Una
//  vez validada en banco, Maestro_v2.ino sigue como referencia
//  histórica de "cómo estaba antes" para la tesis.
//
//  ================================================================
//  CORRECCIÓN (2026-09-18, prueba con hardware real)
//  ================================================================
//  Se había agregado el envío automático de "EF=1" (señal de conexión
//  cyberpunk azul) apenas el socket a un esclavo quedaba conectado. En
//  la primera prueba con los 10 cubos físicos, tras agregar esa señal
//  (y su equivalente EF=2 del lado del frontend), los cubos dejaron de
//  mostrar su color de equipo (azul/rojo) y dejaron de responder a
//  Pausar/Pensar/Actuar. Se retiró el envío de EF=1 de esta función; el
//  color de equipo vuelve a asignarse de forma directa (sin etapa
//  intermedia) desde App.tsx, igual que en la versión que sí funcionaba.
//  El resto del motor de comandos (cola, difusión "all", efectos
//  EF=3..7 para inválido/bloqueo/victoria/cuenta regresiva) no estaba
//  implicado en esta falla y se mantiene sin cambios.
//
//  ================================================================
//  ANÁLISIS ADICIONAL (2026-09-18, mismo reporte de hardware real)
//  ================================================================
//  Retirar EF=1/EF=2 no alcanzaba a explicar todo el reporte ("los
//  cubos quedan pegados en un color casi indistinguible" + "Pausar/
//  Pensar/Actuar no producen cambios"). Revisando el ciclo completo de
//  una orden se encontraron dos causas reales, independientes de las
//  señales de conexión:
//   1. El comando "restaurar" (Cubo_Esclavo_v3.ino) volvía el cubo a
//      NEGRO (0,0,0), no a su color de equipo. El frontend emite
//      restaurarCubos/"restaurar" en CADA evento de posición del
//      tablero (handleStateChange, línea final, incondicional) — y
//      cualquier cubo que alguna vez recibió un color (incluida la
//      asignación rutinaria de color de equipo al conectar) queda en
//      cubosModificados, así que el siguiente evento de posición en
//      CUALQUIER cubo del tablero lo apagaba a negro. Esto explica
//      "quedan pegados en un color que casi no se distingue" (negro) y
//      que Pausar/Pensar/Actuar se vieran revertidos casi al instante.
//      Corregido en el cubo: "restaurar" ahora vuelve al color de
//      equipo del propio cubo (ya calculado en setup() desde local_IP).
//   2. verificarComandoDesdeServidor() corría en cada vuelta del loop
//      de taskRed (~cada 20 ms => ~50 conexiones TCP/HTTP nuevas por
//      segundo contra el backend, indefinidamente). A esa frecuencia
//      se arriesga agotamiento de sockets/puertos efímeros del ESP32
//      tras unos minutos de prueba real. Acotado a como máximo 1 vez
//      cada 120 ms (~8/s), igual de instantáneo para un operador humano.
//   3. enviarComandoAEsclavo() no comprobaba si print() realmente
//      escribió bytes: un socket "zombi" (connected()==true pero el
//      peer ya no responde) descartaba comandos en silencio sin nunca
//      marcarse como caído. Ahora, si print() escribe 0 bytes, el
//      socket se cierra y el comando se reintenta en cuanto reconecte.
// ============================================================

// Maestro - ESP32 como Access Point y TCP Server

#include <WiFi.h>
#include "esp_wifi.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiUdp.h>
#include <set>
#include <string>
#include <cstdlib>

// ============================================================
//  CONFIGURACIÓN - editar solo esta sección
// ============================================================
const char* ssid_ap      = "ESP32_Master_AP";
const char* password_ap  = "12345678";

const char* ssid         = "DIE-ACACIA";
const char* password     = "DIE-ACACIA#";

const int   BACKEND_PORT       = 3000;
const int   DISCOVERY_PORT     = 4210;       // puerto UDP de descubrimiento
const char* DISCOVERY_MSG      = "CUBOS_DISCOVER";

const int NUM_ESCLAVOS              = 10;    // cubos 1..10, IP 192.168.4.2..11
const unsigned long RECONNECT_INTERVAL_MS = 2000;  // espera mínima entre reintentos por cubo
const int32_t       CONNECT_TIMEOUT_MS    = 150;   // tope duro por intento de conexión
const unsigned long PENDIENTE_MAX_EDAD_MS = 3000;  // descartar comandos pendientes muy viejos
const unsigned long REPORTE_ESCLAVOS_MS   = 1000;  // reporte de esclavos activos al backend
const unsigned long HTTP_TIMEOUT_MS       = 400;   // tope duro por llamada HTTP al backend

const int NUM_POSICIONES = 11;
const int pinesBase[NUM_POSICIONES] = {39,34,35,27,14,17,18,19,21,22,23};
const unsigned long DEBOUNCE_MS = 25;
// ============================================================

String backendIP = "";   // se descubre automáticamente via UDP broadcast

// --- Estado de los esclavos (solo tocado desde taskRed) ---
IPAddress ipEsclavos[NUM_ESCLAVOS];
WiFiClient esclavoConexion[NUM_ESCLAVOS];
unsigned long ultimoIntentoConexion[NUM_ESCLAVOS] = {0};
bool esclavoActivo[NUM_ESCLAVOS] = {false};
int siguienteAIntentar = 0;

String comandoPendiente[NUM_ESCLAVOS];
unsigned long comandoPendienteTs[NUM_ESCLAVOS] = {0};

std::set<std::string> cubosModificados;

// UDP para descubrimiento del backend
WiFiUDP udp;

// --- Estado de los pines físicos (solo tocado desde loop(), core de Arduino) ---
int estado[NUM_POSICIONES]     = {1,2,3,4,5,0,6,7,8,9,10};
int baseAnterior[NUM_POSICIONES]= {1,1,1,1,1,0,1,1,1,1,1};
int baseActual[NUM_POSICIONES];
int estadoaux[NUM_POSICIONES]  = {1,2,3,4,5,0,6,7,8,9,10};
int lecturaCruda[NUM_POSICIONES];
unsigned long ultimoCambioPin[NUM_POSICIONES] = {0};

bool iniciarpines     = false;
bool eventoPendiente  = false;
int  posicionLevantada = -1;
int  valorLevantado   = 0;

// --- Comunicación entre tareas ---
struct VectorPosiciones {
  int v[NUM_POSICIONES];
};
QueueHandle_t colaPosiciones;

void taskRed(void* parametro);

// ============================================================
void setup() {
  Serial.begin(115200);

  for (int i = 0; i < NUM_ESCLAVOS; i++) {
    ipEsclavos[i] = IPAddress(192, 168, 4, 2 + i);
  }

  // Crear AP para los esclavos
  WiFi.softAP(ssid_ap, password_ap, 1, 0, 10);
  Serial.print("AP IP: ");
  Serial.println(WiFi.softAPIP());

  // Conectar a DIE-ACACIA
  WiFi.begin(ssid, password);
  Serial.print("Conectando a ");
  Serial.print(ssid);
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\nConectado! IP: " + WiFi.localIP().toString());

  // Descubrir IP del backend via UDP broadcast
  descubrirBackend();

  // Inicializar pines como entrada
  for (int i = 0; i < NUM_POSICIONES; i++) {
    pinMode(pinesBase[i], INPUT);
    lecturaCruda[i] = digitalRead(pinesBase[i]);
  }

  colaPosiciones = xQueueCreate(16, sizeof(VectorPosiciones));

  // Toda la red (backend + esclavos) corre en su propio núcleo (core 0),
  // separada de la lectura de pines (loop(), core 1). Así un backend o
  // un cubo lento nunca retrasan la detección física de eventos.
  xTaskCreatePinnedToCore(taskRed, "TaskRed", 8192, NULL, 1, NULL, 0);
}

// ============================================================
//  loop() = lectura de pines físicos con antirrebote. Nada de red aquí.
// ============================================================
void loop() {
  // Capturar estado inicial de pines una sola vez al arranque
  if (!iniciarpines) {
    iniciarpines = verificar_pinesfisicos();
    delay(5);
    return;
  }

  actualizarLecturaDebounced();

  // Detectar cubo levantado
  if (!eventoPendiente) {
    for (int i = 0; i < NUM_POSICIONES; i++) {
      if (baseAnterior[i] == 1 && baseActual[i] == 0 && estado[i] != 0) {
        posicionLevantada = i;
        valorLevantado    = estado[i];
        estado[i]         = 0;
        estadoaux[i]      = 0;
        publicarEstado(estadoaux);
        eventoPendiente   = true;
        break;
      }
    }
  }
  // Detectar cubo devuelto a la base
  else {
    for (int i = 0; i < NUM_POSICIONES; i++) {
      if (baseAnterior[i] == 0 && baseActual[i] == 1) {
        estado[i]      = valorLevantado;
        estadoaux[i]   = valorLevantado;
        publicarEstado(estado);
        eventoPendiente   = false;
        posicionLevantada = -1;
        valorLevantado    = 0;
        break;
      }
    }
  }

  // Actualizar estado anterior
  for (int i = 0; i < NUM_POSICIONES; i++) {
    baseAnterior[i] = baseActual[i];
  }

  delay(5);
}

// ============================================================
//  ANTIRREBOTE
// ============================================================
void actualizarLecturaDebounced() {
  unsigned long ahora = millis();
  for (int i = 0; i < NUM_POSICIONES; i++) {
    int r = digitalRead(pinesBase[i]);
    if (r != lecturaCruda[i]) {
      lecturaCruda[i] = r;
      ultimoCambioPin[i] = ahora;
    } else if (ahora - ultimoCambioPin[i] >= DEBOUNCE_MS) {
      baseActual[i] = lecturaCruda[i];
    }
  }
}

bool verificar_pinesfisicos() {
  for (int i = 0; i < NUM_POSICIONES; i++) {
    baseActual[i]   = digitalRead(pinesBase[i]);
    lecturaCruda[i] = baseActual[i];
    baseAnterior[i] = baseActual[i];
    estado[i]       = estadoaux[i];
  }
  Serial.print("Estado inicial pines: ");
  for (int i = 0; i < NUM_POSICIONES; i++) {
    Serial.print(baseActual[i]); Serial.print(" ");
  }
  Serial.println();
  Serial.println("Pines capturados - sistema listo");
  return true;
}

void imprimirVector(const char* nombre, int vec[]) {
  Serial.print(nombre);
  Serial.print(": ");
  String msg = "";
  for (int i = 0; i < NUM_POSICIONES; i++) {
    msg += String(vec[i]);
    if (i < NUM_POSICIONES - 1) msg += ",";
  }
  Serial.println(msg);
}

// Publica el vector de posiciones a taskRed sin bloquear jamás loop().
void publicarEstado(int vec[]) {
  imprimirVector("Estado", vec);
  VectorPosiciones msg;
  for (int i = 0; i < NUM_POSICIONES; i++) msg.v[i] = vec[i];
  xQueueSend(colaPosiciones, &msg, 0); // no bloquear; si la cola está llena se descarta
}

// ============================================================
//  AUTO-DESCUBRIMIENTO DEL BACKEND VIA UDP BROADCAST
// ============================================================
void descubrirBackend() {
  Serial.println("Buscando backend en la red...");
  udp.begin(DISCOVERY_PORT);

  for (int intento = 0; intento < 10; intento++) {
    udp.beginPacket("255.255.255.255", DISCOVERY_PORT);
    udp.print(DISCOVERY_MSG);
    udp.endPacket();
    Serial.print("Broadcast enviado, esperando respuesta...");

    unsigned long t = millis();
    while (millis() - t < 2000) {
      int len = udp.parsePacket();
      if (len > 0) {
        char buf[64] = {0};
        udp.read(buf, sizeof(buf) - 1);
        String resp = String(buf);
        if (resp.startsWith("CUBOS_BACKEND:")) {
          backendIP = resp.substring(14);
          backendIP.trim();
          Serial.println("\nBackend encontrado en: " + backendIP);
          udp.stop();
          return;
        }
      }
      delay(10);
    }
    Serial.println("sin respuesta, reintentando...");
  }

  backendIP = "192.168.0.101";
  Serial.println("Backend no encontrado. Usando IP por defecto: " + backendIP);
  udp.stop();
}

String getServerURL()  { return "http://" + backendIP + ":" + BACKEND_PORT + "/api/posiciones"; }
String getComandoURL() { return "http://" + backendIP + ":" + BACKEND_PORT + "/api/obtenerComando"; }

// ============================================================
//  TASKRED — toda la red vive aquí (core 0)
// ============================================================
void taskRed(void* parametro) {
  unsigned long ultimoReporteEsclavos = 0;
  unsigned long ultimoDescubrimiento = 0;
  unsigned long ultimoPollComando = 0;
  bool usandoFallback = false;

  for (;;) {
    // Reconectar WiFi si se cae (bloqueante a propósito: si el WiFi
    // realmente está caído, es correcto que se reporte como tal)
    if (WiFi.status() != WL_CONNECTED) {
      Serial.println("WiFi perdido, reconectando...");
      WiFi.begin(ssid, password);
      int intentos = 0;
      while (WiFi.status() != WL_CONNECTED && intentos < 20) {
        delay(500); intentos++;
      }
      if (WiFi.status() == WL_CONNECTED && backendIP == "") {
        descubrirBackend();
      }
    }

    // 1) Publicar cambios de posición pendientes (no bloqueante)
    VectorPosiciones msg;
    while (xQueueReceive(colaPosiciones, &msg, 0) == pdTRUE) {
      enviarEstadoServidor(msg.v);
    }

    // 2) Heartbeat + comando del backend (timeout acotado). Acotado a
    // como máximo ~8 veces por segundo (antes corría en cada vuelta del
    // loop, ~50 veces por segundo): cada llamada abre y cierra una
    // conexión TCP/HTTP nueva contra el backend, y a esa frecuencia se
    // arriesga a agotar los sockets/puertos efímeros del ESP32 en pocos
    // minutos de prueba. Sigue siendo instantáneo para un operador humano.
    if (millis() - ultimoPollComando >= 120) {
      verificarComandoDesdeServidor();
      ultimoPollComando = millis();
    }

    // 3) Mantener vivas las conexiones a los esclavos: como máximo un
    //    intento de reconexión por vuelta, acotado a CONNECT_TIMEOUT_MS.
    intentarReconexion(siguienteAIntentar);
    siguienteAIntentar = (siguienteAIntentar + 1) % NUM_ESCLAVOS;

    // 4) Reportar esclavos activos (solo lee banderas .connected(), no
    //    abre conexiones nuevas -> costo ~0 ms)
    if (millis() - ultimoReporteEsclavos > REPORTE_ESCLAVOS_MS) {
      verificar_esclavos();
      reportarEsclavosActivos();
      ultimoReporteEsclavos = millis();
    }

    // 5) Reintentar descubrimiento del backend cada 30s si usa fallback
    if (usandoFallback && millis() - ultimoDescubrimiento > 30000) {
      Serial.println("Reintentando descubrimiento del backend...");
      backendIP = "";
      descubrirBackend();
      ultimoDescubrimiento = millis();
    }
    usandoFallback = (backendIP == "192.168.0.101");

    delay(20);
  }
}

// ============================================================
//  VERIFICACIONES DE ENLACE (informativo, no cambia esclavoActivo[])
// ============================================================
void verificar_esclavos() {
  wifi_sta_list_t stationList;
  esp_wifi_ap_get_sta_list(&stationList);
  Serial.print("Estaciones WiFi asociadas al AP: ");
  Serial.print(stationList.num);
  Serial.println("/10");
}

// ============================================================
//  COMUNICACIÓN CON ESCLAVOS (TCP port 3333, conexiones persistentes)
// ============================================================

// Intenta reconectar UN esclavo si está caído y ya pasó el intervalo
// mínimo. Cuesta como máximo CONNECT_TIMEOUT_MS; si el esclavo sigue
// conectado o todavía no toca reintentar, cuesta ~0 ms.
void intentarReconexion(int idx) {
  if (esclavoConexion[idx].connected()) {
    esclavoActivo[idx] = true;
    return;
  }
  unsigned long ahora = millis();
  if (ahora - ultimoIntentoConexion[idx] < RECONNECT_INTERVAL_MS) return;
  ultimoIntentoConexion[idx] = ahora;

  esclavoConexion[idx].stop();
  bool ok = esclavoConexion[idx].connect(ipEsclavos[idx], 3333, CONNECT_TIMEOUT_MS);
  esclavoActivo[idx] = ok;

  if (ok) {
    Serial.printf("Esclavo %d reconectado\n", idx + 1);
    // NOTA (2026-09-18): aquí se enviaba EF=1 (señal de conexión cyberpunk
    // azul) apenas conectaba el socket. Se retiró tras una prueba con
    // hardware real donde, después de agregar las señales de conexión
    // (EF=1/EF=2), los cubos se quedaron pegados en un color intermedio y
    // dejaron de responder a Pausar/Pensar/Actuar — ver DECISIONES_PROYECTO.md.
    // El color de equipo vuelve a asignarse directo, sin etapa intermedia,
    // desde App.tsx (estadoInicialPayload) igual que en la versión que sí
    // funcionaba. El motor de efectos (EF=3..7) sigue activo en el cubo
    // para el resto de señales (inválido, bloqueo, victoria, cuenta
    // regresiva), que no estaban implicadas en esta falla.
    if (comandoPendiente[idx].length() > 0) {
      if (millis() - comandoPendienteTs[idx] < PENDIENTE_MAX_EDAD_MS) {
        esclavoConexion[idx].print(comandoPendiente[idx]);
      }
      comandoPendiente[idx] = "";
    }
  }
}

// Envía un comando al esclavo idx (0-based). Si el socket no está
// conectado en este instante, el comando se guarda como pendiente y se
// reenvía automáticamente en cuanto intentarReconexion() lo reconecte
// (mientras no exceda PENDIENTE_MAX_EDAD_MS).
//
// connected() en un socket TCP embebido puede seguir devolviendo true
// aunque el otro extremo ya no responda (conexión "zombi": el estado
// local del socket no se entera de que el peer se cayó hasta el próximo
// intento real de I/O). Por eso se revisa cuántos bytes escribió print():
// si escribió 0 con un comando no vacío, se da el socket por muerto,
// se cierra y el comando se reintenta en cuanto reconecte.
void enviarComandoAEsclavo(int idx, const String& comando) {
  if (idx < 0 || idx >= NUM_ESCLAVOS) return;
  if (esclavoConexion[idx].connected()) {
    size_t escritos = esclavoConexion[idx].print(comando);
    if (escritos == 0 && comando.length() > 0) {
      Serial.printf("Escritura a esclavo %d fallo (socket zombi) - reconectando\n", idx + 1);
      esclavoConexion[idx].stop();
      esclavoActivo[idx] = false;
      comandoPendiente[idx] = comando;
      comandoPendienteTs[idx] = millis();
    }
  } else {
    comandoPendiente[idx] = comando;
    comandoPendienteTs[idx] = millis();
  }
}

void restaurarcubo() {
  for (const auto& clave : cubosModificados) {
    int idx = atoi(clave.c_str()) - 1;
    enviarComandoAEsclavo(idx, "restaurar\n");
  }
  cubosModificados.clear();
}

// ============================================================
//  COMUNICACIÓN CON BACKEND
// ============================================================

// Construye la línea de comando para un cubo a partir del objeto JSON
// recibido del backend. Si trae "efecto" (entero), es una de las
// secuencias enlatadas del cubo (EF=<n>: conexión, inválido, bloqueo,
// victoria, cuenta regresiva...). Si no, es el formato normal de color
// fijo/parpadeo (M=/LR=/LG=/LB=/F=), igual que siempre.
String construirComando(JsonObject obj) {
  if (obj.containsKey("efecto")) {
    char comando[16];
    snprintf(comando, sizeof(comando), "EF=%d\n", (int)obj["efecto"]);
    return String(comando);
  }

  float vibration       = obj["vibrationIntensity"]  | 0.0f;
  float freqIluminacion = obj["iluminationFrequency"] | 1.0f;
  int   r = obj["color"][0] | 0;
  int   g = obj["color"][1] | 0;
  int   b = obj["color"][2] | 0;

  char comando[64];
  snprintf(comando, sizeof(comando),
    "M=%.2f,LR=%d,LG=%d,LB=%d,F=%.2f\n",
    vibration, r, g, b, freqIluminacion);
  return String(comando);
}

// Aplica un comando ya recibido del backend: a un cubo puntual (id
// numérico) o a los NUM_ESCLAVOS a la vez (id=="all"). Con sockets
// persistentes, difundir a los 10 cuesta unos pocos ms en total.
void aplicarComandoRecibido(JsonObject obj) {
  if (!obj.containsKey("id")) return;

  if (obj["id"].is<const char*>() && String((const char*)obj["id"]) == "all") {
    String comando = construirComando(obj);
    Serial.print("Comando a TODOS los cubos: ");
    Serial.println(comando);
    for (int idx = 0; idx < NUM_ESCLAVOS; idx++) {
      cubosModificados.insert(std::to_string(idx + 1));
      enviarComandoAEsclavo(idx, comando);
    }
    return;
  }

  int idInt = (int)obj["id"];
  String comando = construirComando(obj);
  Serial.print("Comando a cubo ");
  Serial.print(idInt);
  Serial.print(": ");
  Serial.println(comando);

  cubosModificados.insert(std::to_string(idInt));
  enviarComandoAEsclavo(idInt - 1, comando);
}

void verificarComandoDesdeServidor() {
  if (WiFi.status() != WL_CONNECTED || backendIP == "") return;

  HTTPClient http;
  http.begin(getComandoURL());
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  int httpCode = http.GET();

  if (httpCode != HTTP_CODE_OK) {
    Serial.println("Error GET comando: " + String(httpCode));
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  DynamicJsonDocument doc(4096);
  DeserializationError err = deserializeJson(doc, payload);
  if (err) {
    Serial.println("Error al parsear respuesta de /api/obtenerComando: " + String(err.c_str()));
    Serial.println("Payload recibido: " + payload);
    return;
  }
  if (!doc.is<JsonObject>() || !doc.containsKey("comandos")) {
    Serial.println("Respuesta de /api/obtenerComando sin 'comandos' (¿backend desactualizado?): " + payload);
    return;
  }

  JsonArray comandos = doc["comandos"].as<JsonArray>();
  for (JsonVariant item : comandos) {
    if (!item.is<JsonObject>()) continue;
    JsonObject obj = item.as<JsonObject>();

    if (obj.containsKey("mensaje") && String((const char*)obj["mensaje"]) == "restaurar") {
      restaurarcubo();
      continue;
    }
    aplicarComandoRecibido(obj);
  }
}

void enviarEstadoServidor(int vec[]) {
  if (WiFi.status() != WL_CONNECTED || backendIP == "") return;

  DynamicJsonDocument doc(256);
  JsonArray posiciones = doc.createNestedArray("posiciones");
  for (int i = 0; i < NUM_POSICIONES; i++) posiciones.add(vec[i]);
  String jsonData;
  serializeJson(doc, jsonData);

  HTTPClient http;
  http.begin(getServerURL());
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(jsonData);
  if (httpCode == HTTP_CODE_OK) {
    Serial.println("Posiciones enviadas: " + jsonData);
  } else {
    Serial.println("Error POST posiciones: " + String(httpCode));
  }
  http.end();
}

void reportarEsclavosActivos() {
  if (WiFi.status() != WL_CONNECTED || backendIP == "") return;

  DynamicJsonDocument doc(256);
  JsonArray arr = doc.createNestedArray("esclavos");
  for (int i = 0; i < NUM_ESCLAVOS; i++) {
    if (esclavoActivo[i]) arr.add(i + 1);
  }
  String json;
  serializeJson(doc, json);

  HTTPClient http;
  http.begin("http://" + backendIP + ":" + BACKEND_PORT + "/api/esclavosConectados");
  http.setConnectTimeout(HTTP_TIMEOUT_MS);
  http.setTimeout(HTTP_TIMEOUT_MS);
  http.addHeader("Content-Type", "application/json");
  http.POST(json);
  http.end();
}
