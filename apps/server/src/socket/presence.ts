interface UserPresence {
  userId: string
  name: string
  scenarioId: string | null
}

// projectId → Map<socketId, UserPresence>
const rooms = new Map<string, Map<string, UserPresence>>()

export function joinRoom(projectId: string, socketId: string, user: UserPresence): void {
  if (!rooms.has(projectId)) rooms.set(projectId, new Map())
  rooms.get(projectId)!.set(socketId, user)
}

export function leaveRoom(projectId: string, socketId: string): void {
  rooms.get(projectId)?.delete(socketId)
  if (rooms.get(projectId)?.size === 0) rooms.delete(projectId)
}

export function leaveAllRooms(socketId: string): void {
  for (const [projectId] of rooms) {
    leaveRoom(projectId, socketId)
  }
}

export function getPresence(projectId: string): UserPresence[] {
  return Array.from(rooms.get(projectId)?.values() ?? [])
}

export function updateScenarioFocus(projectId: string, socketId: string, scenarioId: string | null): void {
  const user = rooms.get(projectId)?.get(socketId)
  if (user) user.scenarioId = scenarioId
}
