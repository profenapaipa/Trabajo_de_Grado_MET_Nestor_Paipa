 // Maestro - ESP32 como Access Point y TCP Server

#include <WiFi.h>
#include "esp_wifi.h"
#include <HTTPClient.h>
#include <ArduinoJson.h> // Instálala desde el Library Manager
#include <map>
#include <set>

//listas que contienen la información de los cubos
std::map<std::string, const char*> Cubos;
std::set<std::string> cubosModificados;

//Punto de acceso (AP) para los cubos (wifi esclavos)
const char* ssid_ap = "ESP32_Master_AP";
const char* password_ap = "12345678";

// Conexion del maestro con wifi y API de los cubos inteligentes - por el momento local
//Es necesario que se conecten a una misma red wifi y además las ip de serURL y comandoURL tiene que rectificarse con el ipconfig en el cmd
const char* ssid = "jeclopezp";
const char* password = "Sol9510*";
const char* serverURL = "http://192.168.113.230:3000/api/posiciones";
const char* comandoURL = "http://192.168.113.230:3000/api/obtenerComando";

//Configuración del puerto para el envio de comandos
WiFiServer server(3333); 
WiFiClient client;

//Entradas digitales

const int NUM_POSICIONES = 11;

//B1->39,B2->34,B3->35,B4->27,B5->14,B6->17,B7->18,B8->19,B9->21,B10->22,B11->23

const int pinesBase[NUM_POSICIONES] = {39,34,35,27,14,17,18,19,21,22,23};

//definicion e inicializacion de vectores y variables
int estado[NUM_POSICIONES] = {1,2,3,4,5,0,6,7,8,9,10};
int baseAnterior[NUM_POSICIONES]={1,1,1,1,1,0,1,1,1,1,1};
int baseActual[NUM_POSICIONES];
int estadoaux[NUM_POSICIONES] = {1,2,3,4,5,0,6,7,8,9,10};
bool iniciaresclavos = false;
bool iniciarpines = false;
bool eventoPendiente = false;
int posicionLevantada = -1;
int valorLevantado = 0;
bool estadoaux_enviado = false;
bool estado_enviado = false;


void setup() {

  Serial.begin(115200);
  //creación y guardado de las ip de cada cubo (wifi esclavo)
  Cubos["1"] = "192.168.4.2";
  Cubos["2"] = "192.168.4.3";
  Cubos["3"] = "192.168.4.4";
  Cubos["4"] = "192.168.4.5";
  Cubos["5"] = "192.168.4.6";
  Cubos["6"] = "192.168.4.7";
  Cubos["7"] = "192.168.4.8";
  Cubos["8"] = "192.168.4.9";
  Cubos["9"] = "192.168.4.10";
  Cubos["10"] = "192.168.4.11";

  // Configurar AP (punto de acceso)
  WiFi.softAP(ssid_ap, password_ap,1,0,10);
  IPAddress IP = WiFi.softAPIP();
  Serial.print("AP IP address: ");
  Serial.println(IP);
  
  // Configuración y conexión con wifi
  WiFi.begin(ssid, password);
  Serial.print("Conectando a WiFi");

  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }

  Serial.println("Conectado al wifi!");
  
  // Inicializamos los pines como entrada
  for (int i = 0; i < NUM_POSICIONES; i++) {
    pinMode(pinesBase[i], INPUT);
  }

}

void loop() {

  //control de que se tenga comunicación con todos los cubos y que se encuentren todos los cubos en la base para iniciar con el juego. 
 if (iniciaresclavos==false||iniciarpines==false){
  iniciaresclavos=verificar_esclavos();
  iniciarpines = verificar_pinesfisicos();
  delay(800);}
 else{
  //Revisión de lectura de los cubos que siguen en la base
  for (int i = 0; i < NUM_POSICIONES; i++) {
  baseActual[i] = digitalRead(pinesBase[i]);
 }
  //Detección del levantamiento de un cubo
  if (!eventoPendiente) {
    for (int i = 0; i < NUM_POSICIONES; i++) {
      if (baseAnterior[i] == 1 && baseActual[i] == 0 && estado[i] != 0) {
        posicionLevantada = i;
        valorLevantado = estado[i];
        estado[i] = 0;
        estadoaux[i] = 0;

        imprimirVector("Estadoaux", estadoaux);
        eventoPendiente = true;
        break;
      }
    }
  }
  //Detección de la colocación del cubo nuevamente en la base
  else {
    for (int i = 0; i < NUM_POSICIONES; i++) {
      if (baseAnterior[i] == 0 && baseActual[i] == 1) {
        estado[i] = valorLevantado;
        estadoaux[i] = valorLevantado;

        imprimirVector("Estado", estado);

        // Reset de control
        eventoPendiente = false;
        posicionLevantada = -1;
        valorLevantado = 0;
        break;
      }
    }
  }

  // Actualizar baseAnterior para su posterior comparación con la baseActual
  for (int i = 0; i < NUM_POSICIONES; i++) {
    baseAnterior[i] = baseActual[i];
  }

  delay(50);  // antirrebote simple por software
 
  //Revisión si ha sido enviado un comando desde la API del juego
  verificarComandoDesdeServidor();
 }
}

//Funciones empledas
bool verificar_esclavos (){
  bool inicioe = false;
  wifi_sta_list_t stationList;
  esp_wifi_ap_get_sta_list(&stationList);
  if (stationList.num==10){inicioe = true; Serial.println("Todos dispositovos conectados");}
  else{
    Serial.print("Dispositivos conectados: ");
    Serial.println(stationList.num);
  }
  return inicioe;
}

bool verificar_pinesfisicos (){
  for (int i = 0; i < NUM_POSICIONES; i++) {
   baseActual[i] = digitalRead(pinesBase[i]);}

 for (int i = 0; i < NUM_POSICIONES; i++) {
   if (baseActual[i] != baseAnterior[i]) {return false;}
 }
 Serial.println("Todos dispositivos en la base");
 return true;
}


void mensaje_esclavo(const char* slaveIP, String msg) {
  WiFiClient client;
  if (client.connect(slaveIP, 3333)) {
    client.println(msg);
    client.stop();
   // Serial.print("Comando enviado a: ");
   // Serial.println(slaveIP);
  }
  delay(50);
}


void imprimirVector(const char* nombre, int vec[]) {
  Serial.print(nombre);
  Serial.print(" es: ");
  String mensaje = vectorAmensaje(vec);
  Serial.println(mensaje);
  String jsonData = vectorJson(vec);
  enviarEstadoServidor(jsonData);
}


String vectorAmensaje(int vec[]) {
  String resultado = "";
  for (int i = 0; i < NUM_POSICIONES; i++) {
    resultado += String(vec[i]);
    if (i < NUM_POSICIONES - 1) {
      resultado += ",";  // Separador entre elementos
    }
  }
  return resultado;
}

String vectorJson(int vec[]){
  DynamicJsonDocument doc (256);
  JsonArray posiciones = doc.createNestedArray("posiciones");
  for (int i = 0; i < NUM_POSICIONES; i++){posiciones.add(vec[i]);}
  String MensajeJson;
  serializeJson(doc,MensajeJson);
  return MensajeJson;
}

String extraerValor(const String &data, const String &clave) {
  int start = data.indexOf(clave) + clave.length();
  int end = data.indexOf(',', start);
  if (end == -1) end = data.length(); // Último campo
  return data.substring(start, end);
}

void restaurarcubo(){
  for (const auto& clave : cubosModificados) {
    if (Cubos.count(clave)) {
      const char* ips = Cubos[clave];
      if (ips != nullptr) {
        mensaje_esclavo(ips, "restaurar");
      }
    }
  }
  cubosModificados.clear();
}

void verificarComandoDesdeServidor() {

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(comandoURL);
    int httpCode = http.GET();

    if (httpCode == HTTP_CODE_OK) {
      String payload = http.getString();

      DynamicJsonDocument doc(1024);
      DeserializationError error = deserializeJson(doc, payload);

      if (error) {
      Serial.print("Error al parsear JSON: ");
      Serial.println(error.c_str());
      return;
      }

    // Caso 1: el mensaje es una cadena cruda, como "restaurar"
    if (doc.is<std::string>() || doc.is<const char*>()) {
      const char* comando = doc.as<const char*>();

      if (strcmp(comando, "restaurar") == 0) {
        restaurarcubo();
      } 
    }
 
      else if (doc.is<JsonObject>()) {
      JsonObject obj = doc.as<JsonObject>();

      // Subcaso: comando estándar con parámetros
     if (obj.containsKey("cuboID")) {
        String id = doc["cuboID"];
      float freqIluminacion = doc["frecuencia"];
      float vibration = doc["vibracion"];
      int r = doc["color"][0];
      int g = doc["color"][1];
      int b = doc["color"][2];

      //Aqui se trascribe la cadena de comandos en un mensaje estructurado para enviar al cubo correspondiente

      char comando[50];  
      snprintf(
      comando, sizeof(comando), 
      "M=%.2f,LR=%d,LG=%d,LB=%d,F=%.2f\n", 
      vibration, r, g, b, freqIluminacion
      );

      Serial.println(comando);

      std::string id_caja = id.c_str();
      cubosModificados.insert(id_caja);
      const char* ip = Cubos[id_caja];
      Serial.println(ip);
      mensaje_esclavo(ip,comando);
      }
      }
  } else {Serial.println("Error en la solicitud HTTP");}
  http.end();
  }
}


void enviarEstadoServidor(String estadojson){

  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(serverURL);
    http.addHeader("Content-Type", "application/json");
    int httpCode = http.POST(estadojson);
    if (httpCode == HTTP_CODE_OK) {
      Serial.println("JSON enviado: " + estadojson);
    } else {
      Serial.println("Error en HTTP POST: " + String(httpCode));
    }
    http.end();
  }
  delay(50); 
}

