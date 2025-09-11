import { createMiddleware } from 'hono/factory'
import { getCookie } from 'hono/cookie'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { session, user } from '../../../database/schema'

type Bindings = {
  DB: D1Database
}

type Variables = {
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
  }
}

export const requireAuth = createMiddleware<{ Bindings: Bindings; Variables: Variables }>(async (c, next) => {
  try {
    const sessionToken = c.req.header('Authorization')?.replace('Bearer ', '') ||
                         getCookie(c, 'better-auth.session_token') ||
                         c.req.query('session_token')

    if (!sessionToken) {
      return c.json({ error: 'No session token provided' }, 401)
    }

    const db = drizzle(c.env.DB)
    
    // Find session and join with user data using manual SQL for compatibility
    const sessionData = await db.execute(
      'SELECT s.id as sessionId, s.token as sessionToken, s.expires_at as expiresAt, s.user_id as userId, u.email as userEmail, u.name as userName, u.image as userImage FROM sessions s INNER JOIN users u ON s.user_id = u.id WHERE s.token = ? LIMIT 1',
      [sessionToken]
    )

    if (!sessionData.results?.length) {
      return c.json({ error: 'Invalid session token' }, 401)
    }

    const sessionRecord = sessionData.results[0] as any

    // Check if session is expired
    if (sessionRecord.expiresAt && new Date(sessionRecord.expiresAt * 1000) < new Date()) {
      return c.json({ error: 'Session expired' }, 401)
    }

    // Set user data in context
    c.set('user', {
      id: sessionRecord.userId,
      email: sessionRecord.userEmail,
      name: sessionRecord.userName,
      image: sessionRecord.userImage,
    })

    await next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return c.json({ error: 'Authentication failed' }, 401)
  }
})