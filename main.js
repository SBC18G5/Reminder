#!/usr/bin/env node

'use strict'
//BT
var KalmanFilter = require('kalmanjs').default;
var kf = new KalmanFilter();
const BeaconScanner = require('node-beacon-scanner');
const scanner = new BeaconScanner();

//WebSockets
const webSocketServer = require('websocket').server
const http = require('http')


const mraa = require('mraa'); //require mraa
console.log('MRAA Version: ' + mraa.getVersion()) //write the mraa version to the console


let solenoide = new mraa.Gpio(15)
let infrarrojos = new mraa.Gpio(37)

solenoide.dir(mraa.DIR_OUT)
infrarrojos.dir(mraa.DIR_IN)

let server = http.createServer()
server.listen(1337, () => { console.log((new Date()) + ' Servidor en escucha') })
let wsServer = new webSocketServer({ httpServer: server })

let candadoVoz = false;



var beacons = [
  {
    "Nombre": "NOP",
    "MAC": "111-111",
    "RSSI": 99999,
    "Cerca": true,
    "Obligatorio": false
  },
  {
    "Nombre": "Cartera",
    "MAC": "222-222",
    "RSSI": 99999,
    "Cerca": false,
	"Obligatorio": false
  },
  {
    "Nombre": "Llaves",
    "MAC": "333-333",
    "RSSI": 99999,
    "Cerca": false,
    "Obligatorio": true
  },
  {
    "Nombre": "Movil",
    "MAC": "111-111",
    "RSSI": 99999,
    "Cerca": false,
    "Obligatorio": false
  }
]
let numBeacons = 0;

function analizarBeacon(beacon){
	let resul = -1;
	let existe = false;
		
	for(let i = 0 ; i < beacons.length ; i++){
		if(beacon['address'] == beacons[i].MAC){
			existe = true;
	  		let rssiFiltrado = Math.round((-kf.filter(beacon["rssi"]) - 60) * 1.75);
			if (Math.abs(beacons[i].RSSI - rssiFiltrado) <= 5) return
			if (rssiFiltrado < 25) beacons[i].Cerca = true //CHCK the value
			else beacons[i].Cerca = false;
			beacons[i].RSSI = rssiFiltrado;
			resul = i;
  		}
	}
	
	if (!existe && numBeacons < beacons.length) {
		beacons[numBeacons].MAC = beacon['address'];
		numBeacons++;
	}
	
	return resul;
}

function actualizarActuadores(){

	var avisoObligatorio = '';
	var avisoOpcional = ' '
	var salir = true;

	if(leerInfrarrojos()){ //Si hay alguien cerca de la puerta
		
		for(let i = 0 ; i < beacons.length ; i++){
			if(beacons[i].Obligatorio && !beacons[i].Cerca){
					salir = false;
					avisoObligatorio = avisoObligatorio + ' ' + beacons[i].Nombre
			}
			if (!beacons[i].Cerca) avisoOpcional = avisoOpcional + ' ' + beacons[i].Nombre

		}

		if(!salir && avisoObligatorio !== '')  voz('No puedes salir sin : ' + avisoObligatorio); // VOZ
		else if (avisoOpcional !== '') {
		
			voz('Seguro que quieres salir sin : ' + avisoOpcional)
			desactivarSolenoide()
		}
		

	}
	else{
		activarSolenoide()
	}
}

wsServer.on('request', request => {
	let connection = request.accept(null, request.origin)



	// Set an Event handler for becons
	scanner.onadvertisement = (ad) => {
		let i
		if((i = analizarBeacon(ad)) > 0){
			actualizarActuadores()

			// Enviar al servidor
			console.log(beacons[i].MAC + ' ' + beacons[i].RSSI + ' ' + beacons[i].Nombre);
			connection.send(JSON.stringify(beacons[i]))
			}

	};


	scanner.startScan().then(() => {
	  console.log('Started to scan.')  ;
	  voz('Bienvenido');
	}).catch((error) => {
	  console.error(error);
	});
});

function activarSolenoide(){
	solenoide.write(1);
}

function desactivarSolenoide(){
	solenoide.write(0);
}

function leerInfrarrojos(){
	let value = infrarrojos.read();
	console.log('Infrarrojos: ' + value); 
	//Obstaculo delante = true;
	return !value;
}




function execute(command) {
  const exec = require('child_process').exec

  exec(command, (err, stdout, stderr) => {
    process.stdout.write(stdout)
  })
}

function voz (str) {
    if (candadoVoz) return
    candadoVoz = true
    execute(`espeak -ves "${str}"`)
    setTimeout(() => { candadoVoz = false }, 3000)
}
