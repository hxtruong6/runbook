import { Socket, Server } from 'socket.io'
import { ObjectId } from 'mongodb'
import { applyPatch, Operation } from 'fast-json-patch'
import { getDb } from '../db.js'

export async function handleScenarioPatch(
  io: Server,
  socket: Socket,
  payload: { scenarioId: string; patch: Operation[] },
): Promise<void> {
  const user = socket.data.user as { sub: string; email: string }
  const db = getDb()

  const scenario = await db.collection('scenarios').findOne({ _id: new ObjectId(payload.scenarioId) })
  if (!scenario) return

  const patched = applyPatch(scenario, payload.patch, false, false).newDocument
  patched['_id'] = new ObjectId(payload.scenarioId)
  patched['updatedAt'] = new Date()
  patched['updatedBy'] = user.sub

  await db.collection('scenarios').replaceOne({ _id: new ObjectId(payload.scenarioId) }, patched)

  io.to(`project:${scenario['projectId'] as string}`).emit('scenario_patch', {
    scenarioId: payload.scenarioId,
    patch: payload.patch,
    updatedBy: user.sub,
  })
  socket.emit('scenario_saved', { scenarioId: payload.scenarioId, updatedAt: patched['updatedAt'] })
}
