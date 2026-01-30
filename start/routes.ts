/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import router from '@adonisjs/core/services/router'

// Home route
router.on('/').renderInertia('home')

// Authentication UI routes
router
  .group(() => {
    router.on('/login').renderInertia('auth/login')
    router.on('/register').renderInertia('auth/register')
    router.on('/forgot-password').renderInertia('auth/forgot-password')
    router.get('/reset-password', async ({ request, response }) => {
      const token = request.qs().token
      if (!token) {
        return response.redirect('/forgot-password')
      }
      return response.redirect(`/auth/reset-password?token=${token}`)
    })
  })
  .use(middleware.guest())

// Authentication API routes (no middleware - handled in controller)
router.group(() => {
  // Registration
  router.post('/register', '#controllers/auth_controller.register').as('register')

  // Login
  router.post('/login', '#controllers/auth_controller.login').as('login')

  // Social authentication
  router
    .get('/:provider/redirect', async ({ ally, params }) => {
      const driverInstance = ally.use(params.provider)

      /**
       * User has denied access by canceling
       * the login flow
       */
      if (driverInstance.accessDenied()) {
        return 'You have cancelled the login process'
      }

      /**
       * OAuth state verification failed. This happens when the
       * CSRF cookie gets expired.
       */
      if (driverInstance.stateMisMatch()) {
        return 'We are unable to verify the request. Please try again'
      }

      /**
       * GitHub responded with some error
       */
      if (driverInstance.hasError()) {
        return driverInstance.getError()
      }

      /**
       * Access user info
       */
      const user = await driverInstance.user()
      return user
    })
    .where('provider', /github|twitter/)
  // Password reset
  router.post('/forgot-password', '#controllers/auth_controller.forgotPassword')
  router.post('/reset-password', '#controllers/auth_controller.resetPassword')
})

// Public video routes
router
  .group(() => {
    // Get published videos with pagination
    router.get('/videos', '#controllers/video_upload_controller.publicIndex')

    // Get video details (for public viewing)
    router.get('/videos/:id', '#controllers/video_upload_controller.show')
  })
  .prefix('/api/v1')

// Protected routes
router
  .group(() => {
    // Logout
    router.post('/logout', '#controllers/auth_controller.logout')

    // Dashboard
    router.on('/dashboard').renderInertia('dashboard')

    // Video upload routes
    router.post('/videos/upload', '#controllers/video_upload_controller.upload')
    router.get('/videos', '#controllers/video_upload_controller.index')
    router.get('/videos/:id', '#controllers/video_upload_controller.show')
    router.post('/videos/:id/publish', '#controllers/video_upload_controller.publish')
    router.get('/videos/:id/url', '#controllers/video_upload_controller.getSignedUrl')
    router.delete('/videos/:id', '#controllers/video_upload_controller.destroy')
  })
  .use(middleware.auth())
