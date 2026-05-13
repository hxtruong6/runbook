import { Server as HttpServer } from 'http'
import { Server } from 'socket.io'
import { FastifyInstance } from 'fastify'
import { joinRoom, leaveRoom, leaveAllRooms, getPresence, updateScenarioFocus } from './presence.js'
import { handleScenarioPatch } from './scenarios.js'
import { Operation } from 'fast-json-patch'

export function attachSocket(app: FastifyInstance, httpServer: HttpServer): Server {
  const io = new Server(httpServer, {
    cors: { origin: '*' },
  })

  io.use((socket, next) => {
    const token = (socket.handshake.auth['token'] ?? socket.handshake.query['token']) as string
    try {
      socket.data.user = app.jwt.verify(token)
      next()
    } catch {
      next(new Error('Unauthorized'))
    }
  })

  io.on('connection', (socket) => {
    const user = socket.data.user as { sub: string; name?: string; email: string }

    socket.on('join_project', (payload: { projectId: string }) => {
      const room = `project:${payload.projectId}`
      socket.join(room)
      joinRoom(payload.projectId, socket.id, { userId: user.sub, name: user.email, scenarioId: null })
      io.to(room).emit('presence', getPresence(payload.projectId))
    })

    socket.on('leave_project', (payload: { projectId: string }) => {
      const room = `project:${payload.projectId}`
      socket.leave(room)
      leaveRoom(payload.projectId, socket.id)
      io.to(room).emit('presence', getPresence(payload.projectId))
    })

    socket.on('focus_scenario', (payload: { projectId: string; scenarioId: string | null }) => {
      updateScenarioFocus(payload.projectId, socket.id, payload.scenarioId)
      io.to(`project:${payload.projectId}`).emit('presence', getPresence(payload.projectId))
    })

    socket.on('patch_scenario', (payload: { scenarioId: string; patch: Operation[] }) => {
      handleScenarioPatch(io, socket, payload)
    })

    socket.on('disconnect', () => {
      leaveAllRooms(socket.id)
    })
  })

  return io
}
