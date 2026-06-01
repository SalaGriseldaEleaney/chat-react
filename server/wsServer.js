// Importa el constructor de la clase que emite eventos de servidor
import { WebSocketServer } from 'ws'

// Instancia el servidor: wss es un "EventEmitter" (Emisor de Eventos)
const wss = new WebSocketServer({ port: 8080 })

console.log("Servidor WebSocket iniciado en ws://localhost:8080")

/**
 * GESTIÓN DE EVENTOS: El método .on() registra un "oyente" (listener).
 * El servidor se queda en espera activa sin bloquear el resto del programa.
*/

// EVENTO 'connection': Se dispara cuando un cliente completa el handshake inicial.
// El parámetro 'ws' representa la conexión única con ese cliente específico.
wss.on('connection', (ws) => {
	console.log("Nuevo cliente conectado")

	// EVENTO 'message': Se activa a nivel de socket individual cuando llegan datos.
	// Node.js detecta el flujo de entrada y ejecuta este callback automáticamente.
	ws.on('message', (data) => {
		const mensaje = data.toString()
		
		// Lógica de filtrado: reaccionamos distinto según el contenido del evento
		if (mensaje !== "repórtate") {
			console.log(`Recibido: ${mensaje}`)
			// Respuesta asíncrona: enviamos datos de vuelta por el mismo canal
			ws.send(`Eco: ${mensaje}`)
		}
	})

	// EVENTO 'close': Se emite cuando el túnel de comunicación se rompe o se cierra.
	// Es vital para la limpieza de memoria y estados en el servidor.
	ws.on('close', () => console.log("Cliente desconectado"))
})

/**
 * TAREA PROGRAMADA (Event Loop):
 * Mientras el servidor escucha eventos de red, el Event Loop de Node.js 
 * gestiona este temporizador de forma paralela y no bloqueante.
 */
setInterval(() => {
	console.log("Enviando comando: repórtate")
	
	// Iteramos sobre el conjunto de clientes (wss.clients) que es dinámico
	wss.clients.forEach((client) => {
		// Verificamos el estado del evento (1 = OPEN) antes de emitir datos
		if (client.readyState === 1) { 
			client.send("repórtate")
		}
	})
}, 30000) // Se ejecuta cada 30 segundos