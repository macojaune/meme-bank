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

    // Dashboard - with user stats
    router.get('/dashboard', async ({ inertia, auth }) => {
      const { default: Video } = await import('#models/video')

      // Get user's videos count
      const videoCount = await Video.query().where('user_id', auth.user!.id).count('* as total')

      // Get total views and likes for user's videos using raw query for proper aggregation
      const { default: db } = await import('@adonisjs/lucid/services/db')
      const statsResult = await db
        .from('videos')
        .where('user_id', auth.user!.id)
        .sum('view_count as totalViews')
        .sum('like_count as totalLikes')
        .first()

      return inertia.render('dashboard', {
        stats: {
          videos: Number(videoCount[0].$extras.total) || 0,
          views: Number(statsResult?.totalViews) || 0,
          likes: Number(statsResult?.totalLikes) || 0,
        },
      })
    })

    // Gallery - with video data (published + user's pending videos)
    router.get('/gallery', async ({ inertia, auth }) => {
      const { default: Video } = await import('#models/video')

      // Get published videos OR user's own videos (even if pending)
      const videos = await Video.query()
        .where((query) => {
          query.where('is_published', true).orWhere('user_id', auth.user!.id)
        })
        .orderBy('created_at', 'desc')
        .paginate(1, 20)

      return inertia.render('gallery', {
        videos,
        userId: auth.user!.id,
      })
    })

    // Upload page
    router.on('/upload').renderInertia('upload')

    // Video streaming route (signed URL)
    router.get('/videos/stream/:id', async ({ params, response }) => {
      const { default: Video } = await import('#models/video')
      const { default: drive } = await import('@adonisjs/drive/services/main')

      const video = await Video.findOrFail(params.id)

      // Increment view count when serving video
      video.viewCount++
      await video.save()

      const signedUrl = await drive.use('spaces').getSignedUrl(video.filePath, {
        expiresIn: '1 hour',
      })

      return response.redirect(signedUrl)
    })

    // Video upload routes
    router.post('/videos/upload', '#controllers/video_upload_controller.upload')
    router.get('/videos', '#controllers/video_upload_controller.index')
    router.get('/videos/:id', '#controllers/video_upload_controller.show')
    router.post('/videos/:id/publish', '#controllers/video_upload_controller.publish')
    router.get('/videos/:id/url', '#controllers/video_upload_controller.getSignedUrl')
    router.delete('/videos/:id', '#controllers/video_upload_controller.delete')
  })
  .use(middleware.auth())
