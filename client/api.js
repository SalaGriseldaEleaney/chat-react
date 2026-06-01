const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3000"

export async function crearGrupo(nombre, creado_por = 1) {
	const res = await fetch(`${API_URL}/api/groups`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ nombre, creado_por })
	})

	if (!res.ok) throw new Error("Error al crear grupo")
	return res.json()
}

export async function obtenerGrupos() {
	const res = await fetch(`${API_URL}/api/groups`)

	if (!res.ok) throw new Error("Error al obtener grupos")
	return res.json()
}

export async function enviarMensaje(group_id, user_id, mensaje, emisor = "Usuario") {
	const res = await fetch(`${API_URL}/api/messages`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ group_id, user_id, mensaje, emisor })
	})

	if (!res.ok) throw new Error("Error al enviar mensaje")
	return res.json()
}

export async function obtenerMensajes(groupId) {
	const res = await fetch(`${API_URL}/api/messages/${groupId}`)

	if (!res.ok) throw new Error("Error al obtener mensajes")
	return res.json()
}

export async function marcarLeido(messageId) {
	const res = await fetch(`${API_URL}/api/messages/${messageId}/read`, {
		method: "PUT"
	})

	if (!res.ok) throw new Error("Error al marcar mensaje leído")
	return res.json()
}