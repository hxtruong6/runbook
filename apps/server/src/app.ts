import Fastify, { FastifyServerOptions } from 'fastify'
import cors from '@fastify/cors'
import jwt from '@fastify/jwt'
import { authRoutes } from './routes/auth.js'
import { passwordResetRoutes } from './routes/passwordReset.js'
import { teamsRoutes } from './routes/teams.js'
import { projectsRoutes } from './routes/projects.js'
import { scenariosRoutes } from './routes/scenarios.js'
import { registryRoutes } from './routes/registry.js'
import { shareRoutes } from './routes/share.js'

export function buildApp(opts: FastifyServerOptions = {}) {
  const app = Fastify(opts)

  const jwtSecret = process.env['JWT_SECRET']
  if (!jwtSecret && process.env['NODE_ENV'] === 'production') {
    throw new Error('JWT_SECRET environment variable is required in production')
  }

  app.register(cors, { origin: true })
  app.register(jwt, { secret: jwtSecret ?? 'dev-secret' })

  app.register(authRoutes, { prefix: '/auth' })
  app.register(passwordResetRoutes, { prefix: '/auth' })
  app.register(teamsRoutes, { prefix: '/teams' })
  app.register(projectsRoutes, { prefix: '/teams' })
  app.register(scenariosRoutes, { prefix: '/teams' })

  app.register(registryRoutes, { prefix: '/registry' })
  app.register(shareRoutes, { prefix: '/api/share' })

  app.get('/health', async () => ({ status: 'ok' }))

  return app
}
