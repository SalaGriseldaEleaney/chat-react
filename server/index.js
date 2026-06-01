import express from "express"
import cors from "cors"
import { db } from "./db.js"

const app = express()

app.use(cors())
app.use(express.json())

app.get("/", (req, res) => {
	res.send("Servidor funcionando correctamente")
})

app.get("/api/users", async (req, res) => {
	try {
		const [rows] = await db.query(
			"SELECT * FROM users ORDER BY nombre ASC"
		)

		res.json(rows)
	} catch (error) {
		res.status(500).json({ error: "Error al obtener usuarios" })
	}
})

app.post("/api/users/login", async (req, res) => {
	try {
		const { nombre } = req.body

		if (!nombre || !nombre.trim()) {
			return res.status(400).json({ error: "El nombre es obligatorio" })
		}

		const nombreLimpio = nombre.trim().toLowerCase()
		const emailGenerado = `${nombreLimpio}@chat.local`

		const [existente] = await db.query(
			"SELECT * FROM users WHERE nombre = ? LIMIT 1",
			[nombreLimpio]
		)

		if (existente.length > 0) {
			return res.json(existente[0])
		}

		const [result] = await db.query(
			"INSERT INTO users (nombre, email) VALUES (?, ?)",
			[nombreLimpio, emailGenerado]
		)

		res.json({
			id: result.insertId,
			nombre: nombreLimpio,
			email: emailGenerado
		})
	} catch (error) {
		console.error(error)
		res.status(500).json({ error: "Error al iniciar usuario" })
	}
})

app.get("/api/groups", async (req, res) => {
	try {
		const { user_id } = req.query

		if (user_id) {
			const [rows] = await db.query(
				`SELECT g.*
				 FROM groups_chat g
				 INNER JOIN group_members gm ON g.id = gm.group_id
				 WHERE gm.user_id = ?
				 ORDER BY g.id ASC`,
				[user_id]
			)

			return res.json(rows)
		}

		const [rows] = await db.query(
			"SELECT * FROM groups_chat ORDER BY id ASC"
		)

		res.json(rows)
	} catch (error) {
		res.status(500).json({ error: "Error al obtener grupos" })
	}
})

app.post("/api/groups", async (req, res) => {
	try {
		const { nombre, creado_por, integrantes } = req.body

		const [result] = await db.query(
			"INSERT INTO groups_chat (nombre, creado_por) VALUES (?, ?)",
			[nombre, creado_por || 1]
		)

		const groupId = result.insertId
		const miembros = Array.isArray(integrantes) ? integrantes : []

		if (!miembros.includes(creado_por || 1)) {
			miembros.push(creado_por || 1)
		}

		for (const userId of miembros) {
			await db.query(
				"INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
				[groupId, userId]
			)
		}

		res.json({
			id: groupId,
			nombre,
			creado_por: creado_por || 1,
			integrantes: miembros
		})
	} catch (error) {
		console.error(error)
		res.status(500).json({ error: "Error al crear grupo" })
	}
})

app.get("/api/groups/:groupId/members", async (req, res) => {
	try {
		const { groupId } = req.params

		const [rows] = await db.query(
			`SELECT u.id, u.nombre, u.email
			 FROM group_members gm
			 INNER JOIN users u ON gm.user_id = u.id
			 WHERE gm.group_id = ?
			 ORDER BY u.nombre ASC`,
			[groupId]
		)

		res.json(rows)
	} catch (error) {
		res.status(500).json({ error: "Error al obtener integrantes" })
	}
})

app.get("/api/messages/:groupId", async (req, res) => {
	try {
		const { groupId } = req.params

		const [rows] = await db.query(
			`SELECT m.*, u.nombre AS emisor
			 FROM messages m
			 LEFT JOIN users u ON m.user_id = u.id
			 WHERE m.group_id = ?
			 ORDER BY m.created_at ASC`,
			[groupId]
		)

		res.json(rows)
	} catch (error) {
		res.status(500).json({ error: "Error al obtener mensajes" })
	}
})

app.post("/api/messages", async (req, res) => {
	try {
		const { group_id, user_id, mensaje } = req.body

		const [result] = await db.query(
			"INSERT INTO messages (group_id, user_id, mensaje) VALUES (?, ?, ?)",
			[group_id, user_id || 1, mensaje]
		)

		res.json({
			id: result.insertId,
			group_id,
			user_id: user_id || 1,
			mensaje,
			leido: 0
		})
	} catch (error) {
		res.status(500).json({ error: "Error al guardar mensaje" })
	}
})

app.put("/api/messages/:id/read", async (req, res) => {
	try {
		const { id } = req.params

		await db.query(
			"UPDATE messages SET leido = 1 WHERE id = ?",
			[id]
		)

		res.json({ ok: true })
	} catch (error) {
		res.status(500).json({ error: "Error al marcar como leído" })
	}
})

app.put("/api/groups/:id", async (req, res) => {
	const { id } = req.params
	const { nombre, creado_por, integrantes } = req.body

	await db.query(
		"UPDATE groups_chat SET nombre = ? WHERE id = ?",
		[nombre, id]
	)

	await db.query(
		"DELETE FROM group_members WHERE group_id = ?",
		[id]
	)

	const miembros = new Set()

	if (creado_por) miembros.add(Number(creado_por))

	for (const integrante of integrantes || []) {
		const nombreLimpio = String(integrante).trim().toLowerCase()

		const [usuarios] = await db.query(
			"SELECT id FROM users WHERE nombre = ? LIMIT 1",
			[nombreLimpio]
		)

		if (usuarios.length > 0) {
			miembros.add(usuarios[0].id)
		}
	}

	for (const userId of miembros) {
		await db.query(
			"INSERT INTO group_members (group_id, user_id) VALUES (?, ?)",
			[id, userId]
		)
	}

	res.json({
		ok: true,
		id,
		nombre,
		integrantes: [...miembros]
	})
})

app.delete("/api/groups/:id", async (req, res) => {
	try {
		const { id } = req.params

		await db.query("DELETE FROM messages WHERE group_id = ?", [id])
		await db.query("DELETE FROM group_members WHERE group_id = ?", [id])
		await db.query("DELETE FROM groups_chat WHERE id = ?", [id])

		res.json({ ok: true })
	} catch (error) {
		console.error(error)
		res.status(500).json({ error: "Error al eliminar grupo" })
	}
})

app.delete("/api/groups", async (req, res) => {
	try {
		await db.query("DELETE FROM messages")
		await db.query("DELETE FROM group_members")
		await db.query("DELETE FROM groups_chat")

		res.json({ ok: true })
	} catch (error) {
		console.error(error)
		res.status(500).json({ error: "Error al limpiar grupos" })
	}
})

const PORT = process.env.PORT || 3000

app.listen(PORT, () => {
	console.log(`Servidor corriendo en puerto ${PORT}`)
})