import React, {
	useState,
	useEffect,
	useMemo,
	useRef,
	useCallback
} from 'react'

import { chatBD } from './chatDB'
import { enviarMensaje, obtenerMensajes, loginUsuario } from './api.js'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

function aJSONSeguro(valor) {
  try { return JSON.parse(valor) }
  catch { return null }
}

function crearMensaje(mensaje, data) {
  if (data === undefined || data === null) return JSON.stringify({ mensaje })
  return JSON.stringify({ mensaje, data })
}

function horaActual() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function normalizar(texto) {
  return texto.trim().toLowerCase()
}

function nombreChatPrivado(a, b) {
  return [a, b].sort().join('__')
}

export default function App() {
  const [nombre, setNombre] = useState('')
  const [usuarioId, setUsuarioId] = useState(null)
  const [servidor] = useState('ws://localhost:8080')
  const [conectado, setConectado] = useState(false)
  const [usuariosOnline, setUsuariosOnline] = useState([])
  const [chatActivo, setChatActivo] = useState({ tipo: 'todos', id: 'todos', nombre: 'Todos' })
  const [texto, setTexto] = useState('')
  const [mensajes, setMensajes] = useState([])
  const [notificaciones, setNotificaciones] = useState({})
  const [busqueda, setBusqueda] = useState('')

  const [grupos, setGrupos] = useState([])
  const [nombreGrupo, setNombreGrupo] = useState('')
  const [integrantesSeleccionados, setIntegrantesSeleccionados] = useState([])
  const [grupoEditando, setGrupoEditando] = useState(null)
  const [mostrarModalGrupo, setMostrarModalGrupo] = useState(false)

  const wsRef = useRef(null)
  const dbRef = useRef(null)
  const chatActivoRef = useRef(chatActivo)
  const nombreRef = useRef(nombre)
  const usuarioIdRef = useRef(usuarioId)
  const mensajesRef = useRef(null)

  useEffect(() => { 
    chatActivoRef.current = chatActivo 
  }, [chatActivo])

  useEffect(() => { 
    nombreRef.current = nombre 
  }, [nombre])

  useEffect(() => {
    usuarioIdRef.current = usuarioId
  }, [usuarioId])

  const contactosDisponibles = useMemo(() => {
    return usuariosOnline.filter((u) => u && u !== nombre)
  }, [usuariosOnline, nombre])

  const chats = useMemo(() => {
    const base = [
      { 
        tipo: 'todos', 
        id: 'todos', 
        nombre: 'Todos', 
        detalle: 'Enviar a todos los conectados' 
      }
    ]

    const usuarios = contactosDisponibles.map((u) => ({
      tipo: 'usuario',
      id: nombre ? nombreChatPrivado(nombre, u) : `privado-${u}`,
      nombre: u,
      detalle: 'En línea',
    }))

    const chatsGrupos = grupos.map((g) => ({
      tipo: 'grupo',
      id: `grupo-${g.id}`,
      nombre: g.nombre,
      detalle: `${g.integrantes.length} integrantes`,
      integrantes: g.integrantes,
    }))

    return [...base, ...usuarios, ...chatsGrupos]
  }, [contactosDisponibles, grupos, nombre])

  const chatsFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase()

    if (!q) return chats

    return chats.filter((c) => 
      c.nombre.toLowerCase().includes(q) || 
      c.detalle.toLowerCase().includes(q)
    )
  }, [chats, busqueda])

  const mensajesChatActivo = useMemo(() => {
    return mensajes.filter((m) => m.chatId === chatActivo.id || m.tipo === 'sistema')
  }, [mensajes, chatActivo])

  useEffect(() => {
    if (mensajesRef.current) {
      mensajesRef.current.scrollTop = mensajesRef.current.scrollHeight
    }
  }, [mensajesChatActivo.length])

  useEffect(() => {
  const iniciarBD = async () => {
    const bd = new chatBD()
    await bd.init()

    dbRef.current = bd
    window.BD = bd

    setGrupos([])
    setMensajes([])
  }

  iniciarBD()
  }, [])

  const guardarMensajeLocal = async (mensajeNuevo, guardarBD = true) => {
    setMensajes((prev) => {
      const existe = prev.some((m) => m.id === mensajeNuevo.id)
      return existe 
        ? prev.map((m) => (m.id === mensajeNuevo.id ? mensajeNuevo : m)) 
        : [...prev, mensajeNuevo]
    })

    if (guardarBD && dbRef.current) await dbRef.current.addMensaje(mensajeNuevo)
  }

  const actualizarMensajeLocal = async (id, cambios) => {
    let actualizado = null

    setMensajes((prev) => {
      const nuevos = prev.map((m) => {
        if (m.id !== id) return m
        actualizado = { ...m, ...cambios }
        return actualizado
      })

      return nuevos
    })

    setTimeout(async () => {
      if (actualizado && dbRef.current) {
        await dbRef.current.updateMensaje(actualizado)
      }
    }, 0)
  }

  const mensajeSistema = (contenido) => {
    guardarMensajeLocal({
      id: `sistema-${Date.now()}-${Math.random()}`,
      tipo: 'sistema',
      chatId: chatActivoRef.current.id,
      chatNombre: chatActivoRef.current.nombre,
      contenido,
      hora: horaActual(),
    })
  }

  const enviar = (mensaje, data) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(crearMensaje(mensaje, data))
    }
  }

  const conectar = async () => {
    const usuario = normalizar(nombre)

    if (!usuario) {
      mensajeSistema('Primero escribe tu nombre.')
      return
    }

    let usuarioBD

    try {
      usuarioBD = await loginUsuario(usuario)

      setUsuarioId(usuarioBD.id)
      usuarioIdRef.current = usuarioBD.id
      setNombre(usuarioBD.nombre)
      nombreRef.current = usuarioBD.nombre

      if (dbRef.current) {
        const gruposUsuario = await dbRef.current.getAll(usuarioBD.id)
        const mensajesUsuario = await dbRef.current.getMensajes(usuarioBD.id)

        setGrupos(gruposUsuario || [])
        setMensajes(mensajesUsuario || [])
      }
    } catch (error) {
      console.error('Error al iniciar usuario:', error)
      mensajeSistema('No se pudo iniciar el usuario en MySQL.')
      return
    }

    const ws = new WebSocket(servidor)
    wsRef.current = ws

    ws.onopen = () => {
      setConectado(true)
      mensajeSistema(`Conectado como ${usuarioBD.nombre}`)
    }

    ws.onmessage = (event) => {
      const datos = aJSONSeguro(event.data)

      if (!datos) return

      const { mensaje, data } = datos

      if (mensaje === 'IDENTIFICATE') {
        enviar('IDENTIFICACION', usuarioBD.nombre)
        enviar('CONECTADOS')
      }

      if (mensaje === 'CONECTADOS') {
        const lista = Array.isArray(data) ? data.filter(Boolean) : []
        setUsuariosOnline(lista)
      }

      if (mensaje === 'CHAT' && data) {
        const chatId = data.chatId || nombreChatPrivado(data.emisor, usuarioBD.nombre)
        const chatNombre = data.chatNombre || data.emisor
        const activo = chatActivoRef.current.id === chatId

        const nuevoMensaje = {
          id: data.id || `msg-${Date.now()}-${Math.random()}`,
          tipo: 'entrante',
          chatId,
          chatNombre,
          chatTipo: data.chatTipo || 'usuario',
          contenido: data.mensaje,
          emisor: data.emisor,
          receptores: data.receptores || [],
          hora: horaActual(),
          estado: activo ? 'leido' : 'recibido',
        }

        guardarMensajeLocal(nuevoMensaje)

        if (activo) {
          enviar('LEIDO', { 
            id: nuevoMensaje.id, 
            receptor: data.emisor, 
            lector: usuarioBD.nombre, 
            chatId 
          })
        } else {
          enviar('RECIBIDO', { 
            id: nuevoMensaje.id, 
            receptor: data.emisor, 
            lector: usuarioBD.nombre, 
            chatId 
          })

          setNotificaciones((prev) => ({ 
            ...prev, 
            [chatId]: (prev[chatId] || 0) + 1 
          }))
        }
      }

      if (mensaje === 'RECIBIDO' && data) {
        actualizarMensajeLocal(data.id, { estado: 'recibido' })
      }

      if (mensaje === 'LEIDO' && data) {
        actualizarMensajeLocal(data.id, { estado: 'leido' })
      }

      if (mensaje === 'SISTEMA' && data) {
        mensajeSistema(data.mensaje)
      }
    }

    ws.onclose = () => {
      setConectado(false)
      setUsuariosOnline([])
      mensajeSistema('Te desconectaste del servidor.')
    }

    ws.onerror = () => {
      mensajeSistema('Error al conectar con el servidor.')
    }
  }

  const desconectar = () => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    setConectado(false)
    setUsuariosOnline([])
  }

  const seleccionarChat = async (chat) => {
    setChatActivo(chat)

    setNotificaciones((prev) => ({
      ...prev,
      [chat.id]: 0
    }))

    if (chat.tipo === 'grupo') {
      try {
        const groupId = chat.id.replace('grupo-', '')
        const mensajesBD = await obtenerMensajes(groupId)

        const mensajesConvertidos = mensajesBD.map((m) => ({
          id: m.id,
          tipo: Number(m.user_id) === Number(usuarioIdRef.current || usuarioId || 1) ? 'saliente' : 'entrante',
          chatId: `grupo-${m.group_id}`,
          chatNombre: chat.nombre,
          chatTipo: 'grupo',
          contenido: m.mensaje,
          emisor: Number(m.user_id) === Number(usuarioIdRef.current || usuarioId || 1) ? nombre || 'Tú' : (m.emisor || `Usuario ${m.user_id}`),
          receptores: [],
          hora: m.created_at
            ? new Date(m.created_at).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit'
            })
            : horaActual(),
          estado: m.leido ? 'leido' : 'enviado'
        }))

        setMensajes((prev) => {
          const sinGrupoActual = prev.filter(
            (m) => m.chatId !== chat.id || m.tipo === 'sistema'
          )

          return [...sinGrupoActual, ...mensajesConvertidos]
        })
      } catch (error) {
        console.error('Error al cargar historial:', error)
        mensajeSistema('No se pudo cargar el historial del grupo.')
      }
    }

    const pendientes = mensajes.filter(
      (m) => m.chatId === chat.id && m.tipo === 'entrante' && m.estado !== 'leido'
    )

    pendientes.forEach((m) => {
      enviar('LEIDO', {
        id: m.id,
        receptor: m.emisor,
        lector: nombre,
        chatId: chat.id
      })

      actualizarMensajeLocal(m.id, { estado: 'leido' })
    })
  }

  const obtenerDestinatarios = () => {
    if (chatActivo.tipo === 'grupo') {
      const grupo = grupos.find((g) => `grupo-${g.id}` === chatActivo.id)

      return (grupo?.integrantes || []).filter(
        (u) => u && u !== nombre && usuariosOnline.includes(u)
      )
    }

    if (chatActivo.tipo === 'todos') {
      return usuariosOnline.filter((u) => u && u !== nombre)
    }

    return [chatActivo.nombre]
  }


  const enviarChat = async () => {
    if (!conectado) {
      mensajeSistema('Primero debes conectarte.')
      return
    }

    if (!texto.trim()) return

    const destinatarios = obtenerDestinatarios()

    if (!destinatarios.length && chatActivo.tipo !== 'grupo') {
      mensajeSistema('No hay destinatarios en línea para enviar el mensaje.')
      return
    }

    const contenido = texto.trim()
    let idMensaje = `msg-${Date.now()}-${Math.random()}`

    if (chatActivo.tipo === 'grupo') {
      const groupId = chatActivo.id.replace('grupo-', '')

      try {
        const guardado = await enviarMensaje(
          groupId,
          usuarioIdRef.current || usuarioId || 1,
          contenido,
          nombre || 'Usuario'
        )

        idMensaje = guardado.id
      } catch (error) {
        console.error('Error al guardar mensaje:', error)
        mensajeSistema('No se pudo guardar el mensaje en MySQL.')
        return
      }
    }

    enviar('CHAT', {
      id: idMensaje,
      receptor: destinatarios,
      receptores: destinatarios,
      mensaje: contenido,
      chatId: chatActivo.id,
      chatNombre: chatActivo.nombre,
      chatTipo: chatActivo.tipo
    })

    const mensajeNuevo = {
      id: idMensaje,
      tipo: 'saliente',
      chatId: chatActivo.id,
      chatNombre: chatActivo.nombre,
      chatTipo: chatActivo.tipo,
      contenido,
      emisor: nombre,
      receptores: destinatarios,
      hora: horaActual(),
      estado: 'enviado'
    }

    setMensajes((prev) => [...prev, mensajeNuevo])
    setTexto('')
  }

  const toggleIntegrante = (usuario) => {
    setIntegrantesSeleccionados((prev) =>
      prev.includes(usuario) 
        ? prev.filter((u) => u !== usuario) 
        : [...prev, usuario]
    )
  }

  const abrirCrearGrupo = () => {
    setGrupoEditando(null)
    setNombreGrupo('')
    setIntegrantesSeleccionados([])
    setMostrarModalGrupo(true)
  }

  const guardarGrupo = async () => {
    if (!nombreGrupo.trim()) {
      mensajeSistema('Escribe el nombre del grupo.')
      return
    }

    if (!integrantesSeleccionados.length) {
      mensajeSistema('Selecciona al menos un contacto para el grupo.')
      return
    }

    const idActual = usuarioIdRef.current || usuarioId

    if (!idActual) {
      mensajeSistema('Primero debes conectarte para crear un grupo.')
      return
    }

    try {
      const integrantesBD = await Promise.all(
        integrantesSeleccionados.map((usuario) => loginUsuario(usuario))
      )

      const integrantesIds = [
        ...new Set([
          idActual,
          ...integrantesBD.map((u) => u.id)
        ])
      ]

      const grupo = {
        nombre: normalizar(nombreGrupo),
        integrantes: [...new Set([...integrantesSeleccionados, nombre].filter(Boolean))],
        integrantesIds
      }

      if (grupoEditando) {
        await dbRef.current.update(grupoEditando.id, grupo, usuarioId)
        mensajeSistema(`Grupo actualizado: ${grupo.nombre}`)
      } else {
        await dbRef.current.add(grupo, idActual)
        mensajeSistema(`Grupo creado: ${grupo.nombre}`)
      }

      setNombreGrupo('')
      setIntegrantesSeleccionados([])
      setGrupoEditando(null)
      setMostrarModalGrupo(false)

      const gruposActualizados = await dbRef.current.getAll(idActual)
      setGrupos(gruposActualizados || [])
    } catch (error) {
      console.error('Error al guardar grupo:', error)
      mensajeSistema('No se pudo guardar el grupo.')
    }
  }

  const editarGrupo = (grupo) => {
    if (!grupo) return

    setGrupoEditando(grupo)
    setNombreGrupo(grupo.nombre)
    setIntegrantesSeleccionados(grupo.integrantes.filter((u) => u !== nombre))
    setMostrarModalGrupo(true)
  }

  const eliminarGrupo = async (id) => {
    await dbRef.current.delete(id)

    if (chatActivo.id === `grupo-${id}`) {
      setChatActivo({ tipo: 'todos', id: 'todos', nombre: 'Todos' })
    }

    setGrupos(await dbRef.current.getAll(usuarioIdRef.current || usuarioId))
    mensajeSistema('Grupo eliminado.')
  }

  const limpiarGrupos = async () => {
    await dbRef.current.clearAll()
    setGrupos([])
    setChatActivo({ tipo: 'todos', id: 'todos', nombre: 'Todos' })
    mensajeSistema('Se limpiaron todos los grupos.')
  }

  const limpiarMensajes = async () => {
    await dbRef.current.clearMensajes()
    setMensajes([])
    setNotificaciones({})
  }

  const presionarEnter = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      enviarChat()
    }
  }

  const estadoPalomita = (estado) => {
    if (estado === 'leido') return <span style={styles.readBlue}>✓✓</span>
    if (estado === 'recibido') return <span>✓✓</span>
    if (estado === 'enviado') return <span>✓</span>
    return <span>✓</span>
  }
  
  return (
    <div style={styles.page}>
      <div style={styles.app}>
        <aside style={styles.sidebar}>
          <div style={styles.sidebarTop}>
            <div style={styles.profileBoxCompact}>
              <div style={styles.avatar}>
                {nombre ? nombre.charAt(0).toUpperCase() : '?'}
              </div>

              <div style={{ flex: 1 }}>
                <h2 style={styles.profileName}>{nombre || 'Sin nombre'}</h2>
                <p style={styles.profileStatus}>
                  {conectado ? 'En línea' : 'Desconectado'}
                </p>
              </div>

              <button style={styles.roundButton} onClick={abrirCrearGrupo}>
                ＋
              </button>
            </div>

            <div style={styles.loginBoxCompact}>
              <input 
                style={styles.nameInput} 
                placeholder="Tu nombre" 
                value={nombre} 
                onChange={(e) => setNombre(e.target.value)} 
                disabled={conectado} 
              />

              {!conectado ? (
                <button style={styles.connectButton} onClick={conectar}>
                  Conectar
                </button>
              ) : (
                <button style={styles.disconnectButton} onClick={desconectar}>
                  Desconectar
                </button>
              )}
            </div>

            <div style={styles.searchWrapper}>
              <span style={styles.searchIcon}>🔎</span>
              <input 
                style={styles.searchInput} 
                placeholder="Buscar o iniciar un chat" 
                value={busqueda} 
                onChange={(e) => setBusqueda(e.target.value)} 
              />
            </div>
          </div>

          <div style={styles.usersList}>
            {chatsFiltrados.map((chat) => (
              <button 
                key={`${chat.tipo}-${chat.id}`} 
                style={{ 
                  ...styles.userItem, 
                  ...(chatActivo.id === chat.id ? styles.userItemActive : {}) 
                }} 
                onClick={() => seleccionarChat(chat)}
              >
                <div style={chat.tipo === 'grupo' ? styles.groupAvatar : styles.userAvatar}>
                  {chat.tipo === 'grupo' ? '👥' : chat.nombre.charAt(0).toUpperCase()}
                </div>

                <div style={styles.userInfo}>
                  <div style={styles.userTopLine}>
                    <strong>{chat.nombre}</strong>

                    {notificaciones[chat.id] > 0 ? (
                      <span style={styles.badge}>{notificaciones[chat.id]}</span>
                    ) : (
                      <span style={styles.chatTime}>ahora</span>
                    )}
                  </div>

                  <span style={styles.userPreview}>{chat.detalle}</span>
                </div>
              </button>
            ))}
          </div>

          <div style={styles.bottomActions}>
            {grupos.length > 0 && (
              <button style={styles.clearGroups} onClick={limpiarGrupos}>
                Limpiar grupos
              </button>
            )}

            {mensajes.length > 0 && (
              <button style={styles.clearGroups} onClick={limpiarMensajes}>
                Limpiar mensajes
              </button>
            )}
          </div>
        </aside>

        <main style={styles.chatArea}>
          <header style={styles.chatHeader}>
            <div style={styles.headerAvatar}>
              {chatActivo.tipo === 'grupo' ? '👥' : chatActivo.nombre.charAt(0).toUpperCase()}
            </div>

            <div style={{ flex: 1 }}>
              <h2 style={styles.chatTitle}>{chatActivo.nombre}</h2>
              <p style={styles.chatSubtitle}>
                {conectado 
                  ? 'Chat activo · notificaciones y visto habilitado' 
                  : 'Conéctate para chatear'}
              </p>
            </div>

            {chatActivo.tipo === 'grupo' && (
              <>
                <button 
                  style={styles.editHeaderButton} 
                  onClick={() => editarGrupo(grupos.find((g) => `grupo-${g.id}` === chatActivo.id))}
                >
                  Editar
                </button>

                <button 
                  style={styles.deleteHeaderButton} 
                  onClick={() => eliminarGrupo(chatActivo.id.replace('grupo-', ''))}
                >
                  Eliminar
                </button>
              </>
            )}
          </header>

          <section style={styles.messagesArea} ref={mensajesRef}>
            {mensajesChatActivo.length === 0 ? (
              <div style={styles.emptyChatBox}>
                <div style={styles.emptyIcon}>💬</div>
                <h3></h3>
                <p>Conéctate y selecciona un chat para enviar mensajes.</p>
              </div>
            ) : (
              mensajesChatActivo.map((msg) => {
                const esSaliente = msg.tipo === 'saliente'
                const esSistema = msg.tipo === 'sistema'

                if (esSistema) {
                  return (
                    <div key={msg.id} style={styles.systemMessage}>
                      {msg.contenido}
                    </div>
                  )
                }

                return (
                  <div 
                    key={msg.id} 
                    style={{ 
                      ...styles.messageRow, 
                      justifyContent: esSaliente ? 'flex-end' : 'flex-start' 
                    }}
                  >
                    <div 
                      style={{ 
                        ...styles.bubble, 
                        ...(esSaliente ? styles.bubbleOut : styles.bubbleIn) 
                      }}
                    >
                      {!esSaliente && (
                        <div style={styles.senderName}>{msg.emisor}</div>
                      )}

                      <div>{msg.contenido}</div>

                      <div style={styles.messageFooter}>
                        <span>{msg.hora}</span>

                        {esSaliente && (
                          <span style={styles.readStatus}>
                            {estadoPalomita(msg.estado)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })
            )}
          </section>

          <footer style={styles.inputBar}>
            <button style={styles.iconButton} disabled>
              😊
            </button>

            <textarea 
              style={styles.messageInput} 
              placeholder="Escribe un mensaje" 
              value={texto} 
              onChange={(e) => setTexto(e.target.value)} 
              onKeyDown={presionarEnter} 
              disabled={!conectado} 
            />

            <button 
              style={styles.sendButton} 
              onClick={enviarChat} 
              disabled={!conectado}
            >
              ➤
            </button>
          </footer>
        </main>
      </div>

      {mostrarModalGrupo && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalCard}>
            <div style={styles.modalHeader}>
              <h2>{grupoEditando ? 'Editar grupo' : 'Nuevo grupo'}</h2>

              <button 
                style={styles.closeButton} 
                onClick={() => { 
                  setMostrarModalGrupo(false)
                  setGrupoEditando(null)
                  setNombreGrupo('')
                  setIntegrantesSeleccionados([])
                }}
              >
                ×
              </button>
            </div>

            <input 
              style={styles.modalInput} 
              placeholder="Nombre del grupo" 
              value={nombreGrupo} 
              onChange={(e) => setNombreGrupo(e.target.value)} 
            />

            <h3 style={styles.modalSubTitle}>Selecciona contactos</h3>

            <div style={styles.modalContacts}>
              {contactosDisponibles.length === 0 ? (
                <p style={styles.noGroups}>
                  Conecta otros usuarios para crear grupos.
                </p>
              ) : (
                contactosDisponibles.map((u) => (
                  <label key={u} style={styles.modalContactRow}>
                    <div style={styles.userAvatarSmall}>
                      {u.charAt(0).toUpperCase()}
                    </div>

                    <span style={{ flex: 1 }}>{u}</span>

                    <input 
                      type="checkbox" 
                      checked={integrantesSeleccionados.includes(u)} 
                      onChange={() => toggleIntegrante(u)} 
                    />
                  </label>
                ))
              )}
            </div>

            <button style={styles.modalSaveButton} onClick={guardarGrupo}>
              {grupoEditando ? 'Actualizar grupo' : 'Crear grupo'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

const styles = {
  page: { 
    minHeight: '100vh', 
    background: '#0b141a', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    padding: '18px', 
    fontFamily: 'Arial, sans-serif' 
  },
  app: { 
    width: '100%', 
    maxWidth: '1320px', 
    height: '92vh', 
    backgroundColor: '#111b21', 
    borderRadius: '10px', 
    overflow: 'hidden', 
    display: 'grid', 
    gridTemplateColumns: '410px 1fr', 
    boxShadow: '0 25px 80px rgba(0,0,0,0.50)', 
    border: '1px solid rgba(255,255,255,0.08)' 
  },
  sidebar: { 
    backgroundColor: '#111b21', 
    borderRight: '1px solid #2a3942', 
    color: 'white', 
    display: 'flex', 
    flexDirection: 'column', 
    minHeight: 0 
  },
  sidebarTop: { 
    flexShrink: 0, 
    borderBottom: '1px solid #2a3942' 
  },
  profileBoxCompact: { 
    height: '72px', 
    backgroundColor: '#202c33', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    padding: '0 16px' 
  },
  avatar: { 
    width: '45px', 
    height: '45px', 
    borderRadius: '50%', 
    backgroundColor: '#00a884', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    fontWeight: 'bold', 
    fontSize: '20px' 
  },
  profileName: { 
    margin: 0, 
    fontSize: '18px' 
  },
  profileStatus: { 
    margin: '4px 0 0', 
    color: '#8696a0', 
    fontSize: '13px' 
  },
  roundButton: { 
    width: '38px', 
    height: '38px', 
    borderRadius: '50%', 
    border: 'none', 
    backgroundColor: '#2a3942', 
    color: 'white', 
    fontSize: '24px', 
    cursor: 'pointer' 
  },
  loginBoxCompact: { 
    padding: '12px', 
    display: 'grid', 
    gridTemplateColumns: '1fr 128px', 
    gap: '10px', 
    backgroundColor: '#111b21' 
  },
  nameInput: { 
    padding: '12px 14px', 
    borderRadius: '9px', 
    border: 'none', 
    outline: 'none', 
    backgroundColor: '#2a3942', 
    color: 'white', 
    fontSize: '15px' 
  },
  connectButton: { 
    padding: '11px', 
    borderRadius: '9px', 
    border: 'none', 
    backgroundColor: '#00a884', 
    color: 'white', 
    fontWeight: 'bold', 
    cursor: 'pointer' 
  },
  disconnectButton: { 
    padding: '11px', 
    borderRadius: '9px', 
    border: 'none', 
    backgroundColor: '#ef4444', 
    color: 'white', 
    fontWeight: 'bold', 
    cursor: 'pointer' 
  },
  searchWrapper: { 
    margin: '0 12px 12px', 
    height: '42px', 
    borderRadius: '10px', 
    backgroundColor: '#202c33', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '8px', 
    padding: '0 12px' 
  },
  searchIcon: { 
    opacity: 0.8 
  },
  searchInput: { 
    flex: 1, 
    backgroundColor: 'transparent', 
    border: 'none', 
    outline: 'none', 
    color: '#e9edef', 
    fontSize: '14px' 
  },
  usersList: { 
    overflowY: 'auto', 
    flex: 1 
  },
  userItem: { 
    width: '100%', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    backgroundColor: 'transparent', 
    border: 'none', 
    color: 'white', 
    padding: '13px 16px', 
    cursor: 'pointer', 
    textAlign: 'left', 
    borderBottom: '1px solid rgba(42,57,66,0.75)' 
  },
  userItemActive: { 
    backgroundColor: '#2a3942' 
  },
  userAvatar: { 
    width: '48px', 
    height: '48px', 
    borderRadius: '50%', 
    backgroundColor: '#3b4a54', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    color: 'white', 
    fontWeight: 'bold', 
    flexShrink: 0 
  },
  groupAvatar: { 
    width: '48px', 
    height: '48px', 
    borderRadius: '50%', 
    backgroundColor: '#7c3aed', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    color: 'white', 
    fontWeight: 'bold', 
    flexShrink: 0 
  },
  userAvatarSmall: { 
    width: '38px', 
    height: '38px', 
    borderRadius: '50%', 
    backgroundColor: '#3b4a54', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    color: 'white', 
    fontWeight: 'bold' 
  },
  userInfo: { 
    flex: 1, 
    minWidth: 0 
  },
  userTopLine: { 
    display: 'flex', 
    justifyContent: 'space-between', 
    gap: '8px', 
    alignItems: 'center' 
  },
  chatTime: { 
    color: '#8696a0', 
    fontSize: '12px' 
  },
  badge: { 
    minWidth: '22px', 
    height: '22px', 
    borderRadius: '999px', 
    backgroundColor: '#00a884', 
    color: 'white', 
    display: 'inline-flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    fontSize: '12px', 
    fontWeight: 'bold' 
  },
  userPreview: { 
    display: 'block', 
    marginTop: '4px', 
    color: '#8696a0', 
    fontSize: '13px', 
    whiteSpace: 'nowrap', 
    overflow: 'hidden', 
    textOverflow: 'ellipsis' 
  },
  bottomActions: { 
    padding: '10px 14px', 
    display: 'grid', 
    gap: '8px', 
    borderTop: '1px solid #2a3942' 
  },
  clearGroups: { 
    width: '100%', 
    padding: '9px', 
    borderRadius: '10px', 
    border: 'none', 
    backgroundColor: '#475569', 
    color: 'white', 
    cursor: 'pointer' 
  },
  chatArea: { 
    display: 'flex', 
    flexDirection: 'column', 
    minWidth: 0 
  },
  chatHeader: { 
    height: '72px', 
    backgroundColor: '#202c33', 
    color: 'white', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '12px', 
    padding: '0 20px', 
    borderBottom: '1px solid #2a3942', 
    flexShrink: 0 
  },
  headerAvatar: { 
    width: '46px', 
    height: '46px', 
    borderRadius: '50%', 
    backgroundColor: '#00a884', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    fontWeight: 'bold' 
  },
  chatTitle: { 
    margin: 0, 
    fontSize: '18px' 
  },
  chatSubtitle: { 
    margin: '4px 0 0', 
    color: '#8696a0', 
    fontSize: '13px' 
  },
  editHeaderButton: { 
    padding: '8px 12px', 
    borderRadius: '8px', 
    border: 'none', 
    backgroundColor: '#3b82f6', 
    color: 'white', 
    cursor: 'pointer' 
  },
  deleteHeaderButton: { 
    padding: '8px 12px', 
    borderRadius: '8px', 
    border: 'none', 
    backgroundColor: '#ef4444', 
    color: 'white', 
    cursor: 'pointer' 
  },
  messagesArea: { 
    flex: 1, 
    overflowY: 'auto', 
    padding: '28px', 
    backgroundColor: '#0b141a', 
    backgroundImage: 'radial-gradient(rgba(255,255,255,0.04) 1px, transparent 1px)', 
    backgroundSize: '22px 22px' 
  },
  emptyChatBox: { 
    color: '#8696a0', 
    textAlign: 'center', 
    margin: '120px auto 0', 
    maxWidth: '420px', 
    borderBottom: '1px solid #2a3942', 
    paddingBottom: '26px' 
  },
  emptyIcon: { 
    fontSize: '54px', 
    marginBottom: '10px' 
  },
  messageRow: { 
    display: 'flex', 
    marginBottom: '8px' 
  },
  bubble: { 
    maxWidth: '65%', 
    padding: '8px 11px', 
    borderRadius: '8px', 
    fontSize: '15px', 
    lineHeight: 1.35, 
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)', 
    wordBreak: 'break-word' 
  },
  bubbleIn: { 
    backgroundColor: '#202c33', 
    color: '#e9edef', 
    borderTopLeftRadius: '2px' 
  },
  bubbleOut: { 
    backgroundColor: '#005c4b', 
    color: '#e9edef', 
    borderTopRightRadius: '2px' 
  },
  senderName: { 
    color: '#53bdeb', 
    fontWeight: 'bold', 
    fontSize: '13px', 
    marginBottom: '4px' 
  },
  messageFooter: { 
    display: 'flex', 
    justifyContent: 'flex-end', 
    gap: '8px', 
    color: '#aebac1', 
    fontSize: '11px', 
    marginTop: '4px' 
  },
  readStatus: { 
    color: '#aebac1', 
    fontWeight: 'bold' 
  },
  readBlue: { 
    color: '#53bdeb' 
  },
  systemMessage: { 
    width: 'fit-content', 
    maxWidth: '80%', 
    margin: '10px auto', 
    padding: '7px 12px', 
    borderRadius: '10px', 
    backgroundColor: '#182229', 
    color: '#8696a0', 
    fontSize: '13px', 
    textAlign: 'center' 
  },
  inputBar: { 
    minHeight: '68px', 
    backgroundColor: '#202c33', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px', 
    padding: '10px 18px', 
    flexShrink: 0 
  },
  iconButton: { 
    width: '42px', 
    height: '42px', 
    borderRadius: '50%', 
    border: 'none', 
    backgroundColor: 'transparent', 
    color: '#8696a0', 
    fontSize: '22px' 
  },
  messageInput: { 
    flex: 1, 
    height: '43px', 
    resize: 'none', 
    border: 'none', 
    outline: 'none', 
    borderRadius: '22px', 
    padding: '12px 16px', 
    boxSizing: 'border-box', 
    backgroundColor: '#2a3942', 
    color: 'white', 
    fontSize: '15px' 
  },
  sendButton: { 
    width: '44px', 
    height: '44px', 
    borderRadius: '50%', 
    border: 'none', 
    backgroundColor: '#00a884', 
    color: 'white', 
    fontSize: '20px', 
    cursor: 'pointer' 
  },
  modalOverlay: { 
    position: 'fixed', 
    inset: 0, 
    backgroundColor: 'rgba(0,0,0,0.65)', 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'center', 
    zIndex: 20 
  },
  modalCard: { 
    width: '420px', 
    maxWidth: '92vw', 
    backgroundColor: '#111b21', 
    border: '1px solid #2a3942', 
    borderRadius: '14px', 
    padding: '18px', 
    color: 'white', 
    boxShadow: '0 30px 80px rgba(0,0,0,0.55)' 
  },
  modalHeader: { 
    display: 'flex', 
    alignItems: 'center', 
    justifyContent: 'space-between', 
    marginBottom: '12px' 
  },
  closeButton: { 
    width: '34px', 
    height: '34px', 
    borderRadius: '50%', 
    border: 'none', 
    backgroundColor: '#2a3942', 
    color: 'white', 
    fontSize: '22px', 
    cursor: 'pointer' 
  },
  modalInput: { 
    width: '100%', 
    boxSizing: 'border-box', 
    padding: '12px', 
    borderRadius: '10px', 
    border: 'none', 
    outline: 'none', 
    backgroundColor: '#2a3942', 
    color: 'white', 
    marginBottom: '12px' 
  },
  modalSubTitle: { 
    margin: '6px 0 10px', 
    color: '#e9edef', 
    fontSize: '16px' 
  },
  modalContacts: { 
    maxHeight: '240px', 
    overflowY: 'auto', 
    border: '1px solid #2a3942', 
    borderRadius: '12px', 
    marginBottom: '14px' 
  },
  modalContactRow: { 
    display: 'flex', 
    alignItems: 'center', 
    gap: '10px', 
    padding: '12px', 
    borderBottom: '1px solid #2a3942', 
    cursor: 'pointer' 
  },
  modalSaveButton: { 
    width: '100%', 
    padding: '12px', 
    borderRadius: '10px', 
    border: 'none', 
    backgroundColor: '#00a884', 
    color: 'white', 
    fontWeight: 'bold', 
    cursor: 'pointer' 
  },
  noGroups: { 
    color: '#8696a0', 
    fontSize: '13px', 
    margin: '10px' 
  },
}