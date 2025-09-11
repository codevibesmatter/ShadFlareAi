import { createMiddleware } from 'hono/factory'
import { createAuth } from '../../../server/auth/config'
import type { Env } from '../../../worker'

type Variables = {
  user: {
    id: string
    email: string
    name: string | null
    image: string | null
  }
  session: any
}

export const requireAuth = createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  try {
    const auth = createAuth(c.env)
    
    // Use Better Auth's native session validation
    const sessionData = await auth.api.getSession({
      headers: c.req.raw.headers
    })

    if (!sessionData?.session || !sessionData?.user) {
      return c.json({ error: 'Unauthorized' }, 401)
    }

    // Set user and session data in context
    c.set('user', {
      id: sessionData.user.id,
      email: sessionData.user.email,
      name: sessionData.user.name,
      image: sessionData.user.image,
    })
    
    c.set('session', sessionData.session)

    await next()
  } catch (error) {
    console.error('Auth middleware error:', error)
    return c.json({ error: 'Authentication failed' }, 401)
  }
})
