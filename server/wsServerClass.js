import { WebSocketServer } from 'ws'

class wsServer {
	constructor() {
		this.wss = new WebSocketServer({ port: 8080 })
		console.log('Servidor WebSocket iniciado en ws://localhost:8080')

		this.wss.on('connection', (ws) => {
			this.MSG(ws, 'IDENTIFICATE')

			ws.on('message', (datos) => {
				datos = this.jsonAJS(datos)

				if (datos) {
					const { mensaje, data } = datos
					if (this[mensaje] && typeof this[mensaje] === 'function') this[mensaje](ws, data)
				}
			})

			ws.on('close', () => {
				console.log(`${ws.data || 'Cliente'} desconectado`)
				this.ENVIAR_CONECTADOS_A_TODOS()
			})
		})
	}

	IDENTIFICACION(ws, data) {
		ws.data = data
		console.log(`${ws.data} conectado...`)
		this.ENVIAR_CONECTADOS_A_TODOS()
	}

	CONECTADOS() {
		this.ENVIAR_CONECTADOS_A_TODOS()
	}

	CHAT(ws, data) {
		if (!data) return

		const emisor = ws.data
		const { id, receptor, mensaje, chatId, chatNombre, chatTipo, receptores } = data

		for (const destinatario of receptor) {
			const socket = this.socketId(destinatario)

			if (socket) {
				this.MSG(socket, 'CHAT', {
					id,
					emisor,
					mensaje,
					chatId,
					chatNombre,
					chatTipo,
					receptores,
				})
			}
		}
	}

	LEIDO(ws, data) {
		if (!data) return

		const { id, receptor, lector, chatId } = data
		const socket = this.socketId(receptor)

		if (socket) this.MSG(socket, 'LEIDO', { id, lector, chatId })
	}

	RECIBIDO(ws, data) {
		if (!data) return

		const { id, receptor, lector, chatId } = data
		const socket = this.socketId(receptor)

		if (socket) this.MSG(socket, 'RECIBIDO', { id, lector, chatId })
	}

	ENVIAR_CONECTADOS_A_TODOS() {
		const conectados = []

		for (const cliente of this.wss.clients) {
			if (cliente.data) conectados.push(cliente.data)
		}

		for (const cliente of this.wss.clients) {
			if (cliente.readyState === 1) {
				this.MSG(cliente, 'CONECTADOS', conectados.filter((nombre) => nombre !== cliente.data))
			}
		}
	}

	socketId(id) {
		for (const cliente of this.wss.clients) {
			if (cliente.data === id) return cliente
		}

		return false
	}

	MSG(ws, mensaje, data) {
		const msg = data !== undefined && data !== null ? this.JSAJson({ mensaje, data }) : this.JSAJson({ mensaje })
		if (msg) ws.send(msg)
	}

	jsonAJS(json) {
		try { return JSON.parse(json) }
		catch { return false }
	}

	JSAJson(js) {
		try { return JSON.stringify(js) }
		catch { return false }
	}
}

new wsServer()
