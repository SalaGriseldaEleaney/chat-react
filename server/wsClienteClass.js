import WebSocket from 'ws'

class wsCliente {
	constructor(cliente) {
		this.ws = new WebSocket('ws://localhost:8080')

		this.ws.data = cliente
		this.ws.on('open', () => { console.log("Conectado al servidor") })

		this.ws.on('message', (data) => {
			const datos = this.jsonAJS(data.toString())

			if(datos) {
				const {mensaje, data} = datos

				// Ejecución dinámica del método correspondiente al mensaje
				if(this[mensaje] && typeof this[mensaje] == "function")
					this[mensaje](data)
			}
		})
	}

	//
	// Gestores de mensajes
	//

	IDENTIFICATE() {
		this.ws.send(this.MSG("IDENTIFICACION", this.ws.data))
		this.ws.send(this.MSG("CONECTADOS")) 
	}

	CONECTADOS(data) {
		if(data) {
			console.log("*** CLIENTES CONECTADOS ***")
			for (const cliente of data)
				console.log(cliente)
		}	
	}

	//
	// Métodos auxiliares
	//

	MSG(mensaje, data = {}) {
		// Solo voy a enviar data, si hay data
		const msg = data != {} && data != undefined && data != null ?
			this.JSAJson({mensaje, data}) : this.JSAJson({mensaje})

		if(msg) this.ws.send(msg)
	}

	// Conversión a Javascript segura
	jsonAJS(json) {
		try { return JSON.parse(json) }
		catch { return false }
	}

	// Conversión a JSON segura
	JSAJson(js) {
		try { return JSON.stringify(js) }
		catch { return false }
	}
}

const argumentos = process.argv
const cliente = argumentos[2] // El índice 0 es la ruta de Node, el 1 es el archivo
new wsCliente(cliente)