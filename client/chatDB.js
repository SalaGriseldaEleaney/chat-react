import {
	crearGrupo,
	obtenerGrupos,
	enviarMensaje,
	obtenerMensajes,
	marcarLeido,
	obtenerIntegrantes
} from './api.js'

export class chatBD {
	constructor() {
		this.db = null
	}

	async init() {
		console.log('Base de datos conectada por API MySQL')
		return true
	}

	async add(grupo, usuarioId = 1) {
		try {
			const integrantesIds = grupo.integrantesIds || [usuarioId]

			const creado = await crearGrupo(
				grupo.nombre,
				usuarioId,
				integrantesIds
			)

			return creado.id
		} catch (err) {
			console.error('Error en add:', err)
			return null
		}
	}

	async getAll(usuarioId) {
		try {
			if (!usuarioId) return []

			const grupos = await obtenerGrupos(usuarioId)

			const gruposConIntegrantes = await Promise.all(
				grupos.map(async (grupo) => {
					const integrantes = await obtenerIntegrantes(grupo.id)

					return {
						id: grupo.id,
						nombre: grupo.nombre,
						integrantes: integrantes.map((u) => u.nombre),
						integrantesIds: integrantes.map((u) => u.id),
						creadoEn: grupo.created_at
					}
				})
			)

			return gruposConIntegrantes
		} catch (err) {
			console.error('Error en getAll:', err)
			return []
		}
	}

	async update(id, grupoActualizado) {
		console.log('Actualizar grupo pendiente:', id, grupoActualizado)
		return true
	}

	async delete(id) {
		console.log('Eliminar grupo pendiente:', id)
		return true
	}

	async clearAll() {
		console.log('Limpiar grupos pendiente')
		return true
	}

	async getMensajes(usuarioId) {
		try {
			if (!usuarioId) return []

			const grupos = await obtenerGrupos(usuarioId)
			let mensajesFinales = []

			for (const grupo of grupos) {
				const mensajes = await obtenerMensajes(grupo.id)

				const convertidos = mensajes.map(m => ({
					id: m.id,
					tipo: Number(m.user_id) === Number(usuarioId) ? 'saliente' : 'entrante',
					chatId: `grupo-${m.group_id}`,
					chatNombre: grupo.nombre,
					chatTipo: 'grupo',
					contenido: m.mensaje,
					emisor: m.emisor || `Usuario ${m.user_id}`,
					receptores: [],
					hora: new Date(m.created_at).toLocaleTimeString([], {
						hour: '2-digit',
						minute: '2-digit'
					}),
					fecha: m.created_at,
					estado: m.leido ? 'leido' : 'enviado'
				}))

				mensajesFinales = [...mensajesFinales, ...convertidos]
			}

			return mensajesFinales
		} catch (err) {
			console.error('Error en getMensajes:', err)
			return []
		}
	}

	async getMensajesPorGrupo(groupId, usuarioId) {
		try {
			const mensajes = await obtenerMensajes(groupId)

			return mensajes.map(m => ({
				id: m.id,
				tipo: Number(m.user_id) === Number(usuarioId) ? 'saliente' : 'entrante',
				chatId: `grupo-${m.group_id}`,
				chatNombre: '',
				chatTipo: 'grupo',
				contenido: m.mensaje,
				emisor: m.emisor || `Usuario ${m.user_id}`,
				receptores: [],
				hora: new Date(m.created_at).toLocaleTimeString([], {
					hour: '2-digit',
					minute: '2-digit'
				}),
				fecha: m.created_at,
				estado: m.leido ? 'leido' : 'enviado'
			}))
		} catch (err) {
			console.error('Error en getMensajesPorGrupo:', err)
			return []
		}
	}

	async addMensaje(mensaje) {
		try {
			if (mensaje.tipo === 'sistema') return true
			if (!mensaje.chatId?.startsWith('grupo-')) return true

			const groupId = mensaje.chatId.replace('grupo-', '')
			const userId = mensaje.user_id || mensaje.userId || 1
			const texto = mensaje.contenido
			const emisor = mensaje.emisor || 'Usuario'

			const guardado = await enviarMensaje(
				groupId,
				userId,
				texto,
				emisor
			)

			mensaje.id = guardado.id
			mensaje.estado = guardado.leido ? 'leido' : 'enviado'

			return true
		} catch (err) {
			console.error('Error en addMensaje:', err)
			return false
		}
	}

	async updateMensaje(mensajeActualizado) {
		try {
			if (
				mensajeActualizado.estado === 'leido' &&
				mensajeActualizado.id
			) {
				await marcarLeido(mensajeActualizado.id)
			}

			return true
		} catch (err) {
			console.error('Error en updateMensaje:', err)
			return false
		}
	}

	async clearMensajes() {
		console.log('Limpiar mensajes pendiente')
		return true
	}
}