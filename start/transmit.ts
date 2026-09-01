// Transmit authorization rules
// This file is only needed in web environment, not workers

try {
  const transmit = await import('@adonisjs/transmit/services/main')

  transmit.default.authorize<{ id: string }>('user/:id', (ctx: any, { id }) => {
    return ctx.auth.user?.id === Number(id)
  })
} catch {
  // Silently ignore if transmit is not available (e.g., in workers)
}
