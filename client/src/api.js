const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

export async function obtenerMensajes(groupId) {
	const response = await fetch(`${API_URL}/api/messages/${groupId}`)

	if (!response.ok) {
		throw new Error("Error al obtener mensajes")
	}

	return response.json()
}

export async function enviarMensaje(groupId, userId, mensaje, emisor) {
	const response = await fetch(`${API_URL}/api/messages`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			group_id: groupId,
			user_id: userId,
			mensaje,
			emisor
		})
	})

	if (!response.ok) {
		throw new Error("Error al guardar mensaje")
	}

	return response.json()
}

export async function loginUsuario(nombre) {
	const response = await fetch(`${API_URL}/api/users/login`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({ nombre })
	})

	if (!response.ok) {
		throw new Error("Error al iniciar sesión")
	}

	return response.json()
}

export async function obtenerUsuarios() {
	const response = await fetch(`${API_URL}/api/users`)

	if (!response.ok) {
		throw new Error("Error al obtener usuarios")
	}

	return response.json()
}

export async function crearGrupo(nombre, creadoPor, integrantes) {
	const response = await fetch(`${API_URL}/api/groups`, {
		method: "POST",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			nombre,
			creado_por: creadoPor,
			integrantes
		})
	})

	if (!response.ok) {
		throw new Error("Error al crear grupo")
	}

	return response.json()
}

export async function obtenerGrupos(userId) {
	const response = await fetch(
		`${API_URL}/api/groups?user_id=${userId}`
	)

	if (!response.ok) {
		throw new Error("Error al obtener grupos")
	}

	return response.json()
}

export async function obtenerIntegrantes(groupId) {
	const response = await fetch(
		`${API_URL}/api/groups/${groupId}/members`
	)

	if (!response.ok) {
		throw new Error("Error al obtener integrantes")
	}

	return response.json()
}

export async function marcarLeido(messageId) {
	const response = await fetch(`${API_URL}/api/messages/${messageId}/read`, {
		method: "PUT"
	})

	if (!response.ok) {
		throw new Error("Error al marcar mensaje leído")
	}

	return response.json()
}

export async function actualizarGrupo(id, nombre, creadoPor, integrantes) {
	const response = await fetch(`${API_URL}/api/groups/${id}`, {
		method: "PUT",
		headers: {
			"Content-Type": "application/json"
		},
		body: JSON.stringify({
			nombre,
			creado_por: creadoPor,
			integrantes
		})
	})

	if (!response.ok) {
		throw new Error("Error al actualizar grupo")
	}

	return response.json()
}

export async function eliminarGrupo(id) {
	const response = await fetch(`${API_URL}/api/groups/${id}`, {
		method: "DELETE"
	})

	if (!response.ok) {
		throw new Error("Error al eliminar grupo")
	}

	return response.json()
}

export async function limpiarGruposAPI() {
	const response = await fetch(`${API_URL}/api/groups`, {
		method: "DELETE"
	})

	if (!response.ok) {
		throw new Error("Error al limpiar grupos")
	}

	return response.json()
}