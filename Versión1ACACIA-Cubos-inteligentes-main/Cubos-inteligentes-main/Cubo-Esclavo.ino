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

IPAddress local_IP(192,168,4,11);     // Cambia el ultimo digito para que sean unicos e identificables
IPAddress gateway(192,168,4,1);     
IPAddress subnet(255,255,255,0);

WiFiClient client; 
WiFiServer server(3333);

//definicion de constantes y variables
const int Freq_max = 900; 
int inte_motor=0;
String id_caja, s;
String valor_motor , freq = "0.0";
String lr, lg, lb = "0"; 

// definición de funciones


//Función para configurar la luz led y su parpadeo
void confi_luces(String Led_r, String Led_g, String Led_b, String freq ){

  float v_parpadeo=Freq_max*freq.toFloat();
  analogWrite(Rpin,Led_r.toInt());
  analogWrite(Gpin,Led_g.toInt());
  analogWrite(Bpin,Led_b.toInt());
  delay(v_parpadeo);
  analogWrite(Rpin,0);
  analogWrite(Gpin,0);
  analogWrite(Bpin,0);
  delay(v_parpadeo);

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


void setup() {

  //Serial.begin(115200);
  
  // Configurar IP estática antes de conectarse
  WiFi.config(local_IP, gateway, subnet);
  
  conectarWifi(); 
  server.begin();
  pinMode(Pfcaja, OUTPUT);
  digitalWrite(Pfcaja, HIGH); 

}


void loop() {

if (WiFi.status() != WL_CONNECTED) {
    conex = false;
    confi_luces("255", "0", "0", "1");  // Rojo = desconectado
    conectarWifi();  // Reintenta solo si se perdió la conexión
    return;
  }

if (conex){
 WiFiClient client = server.available();
 if (client) {
 String cadena = client.readStringUntil('\n');   // Lee un carácter
   
  if (cadena == "restaurar"){
      valor_motor=freq="0.0";
      lr=lg=lb="0";
      //s = extraerValor(cadena, "S=");
      confi_vibromotor(valor_motor);
  } 
  else {
      valor_motor = extraerValor(cadena, "M=");
      lr = extraerValor(cadena, "LR=");
      lg = extraerValor(cadena, "LG=");
      lb = extraerValor(cadena, "LB=");
      freq = extraerValor(cadena, "F=");
      //s = extraerValor(cadena, "S=");
      confi_vibromotor(valor_motor);
  }
  }
  confi_luces(lr,lg,lb,freq);
  delay(500); // Esperar 0.5 segundos entre mensajes
  }
  }

  void conectarWifi() {

  WiFi.begin(ssid, password);

  while (WiFi.status() != WL_CONNECTED) {
    confi_luces("255","0","0","1");
    confi_vibromotor("0.0");
    //analogWrite(Rpin, 255);
    //analogWrite(Gpin, 0);
    //analogWrite(Bpin, 0):
    conex = false;
    delay(500);
  }
  if(WiFi.status() == WL_CONNECTED) {
 //   confi_luces(lr,lg,lb,freq);
    confi_luces("0","0","255","0.50");
    conex = true;
  }
}
  


