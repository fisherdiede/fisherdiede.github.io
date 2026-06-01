int sensorPin = 0;
int buttonPin = 2;
int threshold = 550;
int ticked;
int dbTimer;
enum button{ON, DEBOUNCE, OFF};
button state;


void setup() {
  Serial.begin(9600);
  pinMode(buttonPin, INPUT_PULLUP);
  ticked = 0;
  state = OFF;
}

void loop() {
  int reading = analogRead(sensorPin);
  if ((reading > threshold) && (ticked == 0)) {
    ticked = 1;
    Serial.write(0);
  }
  if ((reading < threshold) && (ticked == 1)) {
    ticked = 0;
  }
  reading = digitalRead(buttonPin);
  switch (state) {
    case OFF:
     if (reading == LOW) {
       Serial.write(1);
       state = DEBOUNCE;
       dbTimer = 5;
     } break;
     case DEBOUNCE:
       if (reading == LOW) {
         if (dbTimer <= 0) {
           state = ON;
         } else --dbTimer;
       }
       case ON:
         if (reading == HIGH) {
           state = OFF;
         }
  }
}
