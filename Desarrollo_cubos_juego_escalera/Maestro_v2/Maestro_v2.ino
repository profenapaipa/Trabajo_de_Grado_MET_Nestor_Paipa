// ============================================================
//  Maestro_v2.ino
//  Firmware del ESP32 DevKit V1 (maestro) — versión 2
// ============================================================
//  Copia explícita, con este nombre, del firmware actualmente
//  instalado en el maestro físico: Maestro___Wifi_copy_20260813194508.ino
//  (Desarrollo_cubos_juego_escalera/Maestro___Wifi_copy_20260813194508/).
//  Ese archivo original NO se modifica ni se renombra, para no romper
//  las referencias que ya existen en PENDIENTES_TESIS.md, ESTADO_PROYECTO.md
//  y DECISIONES_PROYECTO.md. Este archivo es la copia sobre la que se harán
//  los próximos cambios de desarrollo, hasta que se vuelva a flashear el
//  maestro y esta copia pase a ser, a su vez, la nueva "versión instalada".
//
//  Línea base: firmware original del proyecto ACACIA, en
//  Versión1ACACIA-Cubos-inteligentes-main/Cubos-inteligentes-main/Maestro - Wifi.ino
//  (esa carpeta no se modifica bajo ninguna circunstancia).
//
//  Diferencias verificadas de este archivo respecto a esa línea base:
//  descubrimiento automático del backend por UDP (descubrirBackend),
//  reconexión de WiFi ante caídas, y reporte del estado de los esclavos
//  conectados (verificar_esclavos / reportarEsclavosActivos).
// ============================================================

// Maestro - ESP32 como Access Point y TCP Server
// VERSION CORREGIDA: auto-descubrimiento de IP, campos JSON corregidos

#include <WiFi.h>
#include "esp_wifi.h"
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <WiFiUdp.h>
#include <map>
#include <set>

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
// ============================================================

String backendIP = "";   // se descubre automáticamente via UDP broadcast

// Listas de cubos
std::map<std::string, const char*> Cubos;
std::set<std::string> cubosModificados;

// Servidor TCP para recibir respuestas de esclavos
WiFiServer server(3333);

// UDP para descubrimiento del backend
WiFiUDP udp;

// Pines físicos de la base (11 posiciones)
const int NUM_POSICIONES = 11;
const int pinesBase[NUM_POSICIONES] = {39,34,35,27,14,17,18,19,21,22,23};

// Estado de los cubos en la base
int estado[NUM_POSICIONES]     = {1,2,3,4,5,0,6,7,8,9,10};
int baseAnterior[NUM_POSICIONES]= {1,1,1,1,1,0,1,1,1,1,1};
int baseActual[NUM_POSICIONES];
int estadoaux[NUM_POSICIONES]  = {1,2,3,4,5,0,6,7,8,9,10};

bool iniciarpines     = false;
bool eventoPendiente  = false;
int  posicionLevantada = -1;
int  valorLevantado   = 0;

// ============================================================
void setup() {
  Serial.begin(115200);

  // Mapa de IPs estáticas de los esclavos en la red AP
  Cubos["1"]  = "192.168.4.2";
  Cubos["2"]  = "192.168.4.3";
  Cubos["3"]  = "192.168.4.4";
  Cubos["4"]  = "192.168.4.5";
  Cubos["5"]  = "192.168.4.6";
  Cubos["6"]  = "192.168.4.7";
  Cubos["7"]  = "192.168.4.8";
  Cubos["8"]  = "192.168.4.9";
  Cubos["9"]  = "192.168.4.10";
  Cubos["10"] = "192.168.4.11";

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
  }

  server.begin();
}

// ============================================================
void loop() {
  // Reconectar WiFi si se cae
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

  // Capturar estado inicial de pines una sola vez al arranque
  if (!iniciarpines) {
    iniciarpines = verificar_pinesfisicos();
    delay(200);
    return;
  }

  // Leer pines físicos
  for (int i = 0; i < NUM_POSICIONES; i++) {
    baseActual[i] = digitalRead(pinesBase[i]);
  }

  // Detectar cubo levantado
  if (!eventoPendiente) {
    for (int i = 0; i < NUM_POSICIONES; i++) {
      if (baseAnterior[i] == 1 && baseActual[i] == 0 && estado[i] != 0) {
        posicionLevantada = i;
        valorLevantado    = estado[i];
        estado[i]         = 0;
        estadoaux[i]      = 0;
        imprimirVector("Estadoaux", estadoaux);
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
        imprimirVector("Estado", estado);
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

  delay(50);
  verificarComandoDesdeServidor();

  // Reportar esclavos conectados cada 5 segundos (sin bloquear)
  static unsigned long ultimoReporteEsclavos = 0;
  if (millis() - ultimoReporteEsclavos > 5000) {
    verificar_esclavos();
    reportarEsclavosActivos();
    ultimoReporteEsclavos = millis();
  }

  // Reintentar descubrimiento del backend cada 30s si aún usa el fallback
  static unsigned long ultimoDescubrimiento = 0;
  static bool usandoFallback = false;
  if (usandoFallback && millis() - ultimoDescubrimiento > 30000) {
    Serial.println("Reintentando descubrimiento del backend...");
    backendIP = "";
    descubrirBackend();
    ultimoDescubrimiento = millis();
    usandoFallback = (backendIP == "192.168.0.101");
  }
}

// ============================================================
//  AUTO-DESCUBRIMIENTO DEL BACKEND VIA UDP BROADCAST
// ============================================================
void descubrirBackend() {
  Serial.println("Buscando backend en la red...");
  udp.begin(DISCOVERY_PORT);

  for (int intento = 0; intento < 10; intento++) {
    // Broadcast a toda la red
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
        // Respuesta esperada: "CUBOS_BACKEND:192.168.x.x"
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

  // Si no se descubre, usar IP por defecto como fallback
  backendIP = "192.168.0.101";
  Serial.println("Backend no encontrado. Usando IP por defecto: " + backendIP);
  udp.stop();
}

String getServerURL()  { return "http://" + backendIP + ":" + BACKEND_PORT + "/api/posiciones"; }
String getComandoURL() { return "http://" + backendIP + ":" + BACKEND_PORT + "/api/obtenerComando"; }

// ============================================================
//  VERIFICACIONES DE INICIO
// ============================================================
void verificar_esclavos() {
  wifi_sta_list_t stationList;
  esp_wifi_ap_get_sta_list(&stationList);
  Serial.print("Esclavos conectados: ");
  Serial.print(stationList.num);
  Serial.println("/10");
}

bool verificar_pinesfisicos() {
  // Leer estado actual y tomarlo como referencia inicial
  for (int i = 0; i < NUM_POSICIONES; i++) {
    baseActual[i]   = digitalRead(pinesBase[i]);
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

// ============================================================
//  COMUNICACIÓN CON ESCLAVOS (TCP port 3333)
// ============================================================
void mensaje_esclavo(const char* slaveIP, String msg) {
  WiFiClient client;
  if (client.connect(slaveIP, 3333)) {
    client.println(msg);
    client.stop();
  }
  delay(50);
}

void restaurarcubo() {
  for (const auto& clave : cubosModificados) {
    if (Cubos.count(clave)) {
      const char* ip = Cubos[clave];
      if (ip) mensaje_esclavo(ip, "restaurar");
    }
  }
  cubosModificados.clear();
}

// ============================================================
//  COMUNICACIÓN CON BACKEND
// ============================================================
void verificarComandoDesdeServidor() {
  if (WiFi.status() != WL_CONNECTED || backendIP == "") return;

  HTTPClient http;
  http.begin(getComandoURL());
  int httpCode = http.GET();

  if (httpCode != HTTP_CODE_OK) {
    Serial.println("Error GET comando: " + String(httpCode));
    http.end();
    return;
  }

  String payload = http.getString();
  http.end();

  DynamicJsonDocument doc(1024);
  if (deserializeJson(doc, payload)) return;

  // Sin comando pendiente
  if (doc.is<JsonObject>() && doc.containsKey("mensaje") &&
      String((const char*)doc["mensaje"]) == "sin_comando") return;

  // Comando de restaurar (string o objeto con mensaje "restaurar")
  if (doc.is<JsonObject>() && doc.containsKey("mensaje") &&
      String((const char*)doc["mensaje"]) == "restaurar") {
    restaurarcubo();
    return;
  }

  // Comando estándar - CAMPOS CORREGIDOS para coincidir con el backend
  if (doc.is<JsonObject>()) {
    JsonObject obj = doc.as<JsonObject>();

    // El backend envía "id" (no "cuboID")
    if (obj.containsKey("id")) {
      String id               = String((int)doc["id"]);
      float  vibration        = doc["vibrationIntensity"]  | 0.0f;   // corregido
      float  freqIluminacion  = doc["iluminationFrequency"] | 1.0f;  // corregido
      int    r = doc["color"][0] | 0;
      int    g = doc["color"][1] | 0;
      int    b = doc["color"][2] | 0;

      char comando[64];
      snprintf(comando, sizeof(comando),
        "M=%.2f,LR=%d,LG=%d,LB=%d,F=%.2f\n",
        vibration, r, g, b, freqIluminacion);

      Serial.print("Comando a cubo ");
      Serial.print(id);
      Serial.print(": ");
      Serial.println(comando);

      std::string id_caja = id.c_str();
      cubosModificados.insert(id_caja);
      if (Cubos.count(id_caja)) {
        mensaje_esclavo(Cubos[id_caja], String(comando));
      }
    }
  }
}

void enviarEstadoServidor(String estadojson) {
  if (WiFi.status() != WL_CONNECTED || backendIP == "") return;

  HTTPClient http;
  http.begin(getServerURL());
  http.addHeader("Content-Type", "application/json");
  int httpCode = http.POST(estadojson);
  if (httpCode == HTTP_CODE_OK) {
    Serial.println("Posiciones enviadas: " + estadojson);
  } else {
    Serial.println("Error POST posiciones: " + String(httpCode));
  }
  http.end();
  delay(50);
}

void reportarEsclavosActivos() {
  if (WiFi.status() != WL_CONNECTED || backendIP == "") return;
  DynamicJsonDocument doc(256);
  JsonArray arr = doc.createNestedArray("esclavos");
  for (int id = 1; id <= 10; id++) {
    std::string key = std::to_string(id);
    if (Cubos.count(key)) {
      WiFiClient c;
      c.setTimeout(200);
      if (c.connect(Cubos[key], 3333)) {
        arr.add(id);
        c.stop();
      }
    }
  }
  String json;
  serializeJson(doc, json);
  HTTPClient http;
  http.begin("http://" + backendIP + ":" + BACKEND_PORT + "/api/esclavosConectados");
  http.addHeader("Content-Type", "application/json");
  http.POST(json);
  http.end();
  Serial.println("Esclavos activos reportados: " + json);
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

  // Construir JSON y enviar al backend
  DynamicJsonDocument doc(256);
  JsonArray posiciones = doc.createNestedArray("posiciones");
  for (int i = 0; i < NUM_POSICIONES; i++) posiciones.add(vec[i]);
  String jsonData;
  serializeJson(doc, jsonData);
  enviarEstadoServidor(jsonData);
}
