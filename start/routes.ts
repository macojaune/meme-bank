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
import transmit from '@adonisjs/transmit/services/main'

// Register Transmit routes for SSE
transmit.registerRoutes()

router.get('/health', async ({ response }) => response.ok({ status: 'ok' }))

// Public launch landing with a read-only preview of published content.
router.get('/', async ({ inertia, auth }) => {
  let leaderboard: Array<{ rank: number; fullName: string; totalPoints: number }> = []
  let previewVideos: Array<{
    id: string
    title: string
    thumbnailPath: string | null
    filePath: string
    region: string | null
    durationSeconds: number | null
  }> = []

  try {
    const { default: User } = await import('#models/user')
    const { default: Video } = await import('#models/video')
    const { getVideoPublicUrl } = await import('#utils/url_helper')

    const [leaderboardData, videos] = await Promise.all([
      User.query().where('totalPoints', '>', 0).orderBy('totalPoints', 'desc').limit(5),
      Video.query().where('is_published', true).orderBy('created_at', 'desc').limit(6),
    ])

    leaderboard = leaderboardData.map((user, index) => ({
      rank: index + 1,
      fullName: user.fullName ?? 'Membre MemeBank',
      totalPoints: user.totalPoints,
    }))

    previewVideos = videos.map((video) => ({
      id: video.id,
      title: video.title,
      thumbnailPath: video.thumbnailPath ? getVideoPublicUrl(video.thumbnailPath) : null,
      filePath: getVideoPublicUrl(video.filePath),
      region: video.region,
      durationSeconds: video.durationSeconds,
    }))
  } catch (error) {
    console.error('Failed to load public landing data:', error)
  }

  return inertia.render('home', {
    leaderboard,
    previewVideos,
    auth: {
      isLoggedIn: auth.isAuthenticated,
      user: auth.user
        ? {
            id: auth.user.id,
            fullName: auth.user.fullName,
          }
        : null,
    },
  })
})

router.post('/waitlist', '#controllers/waitlist_controller.store')

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
    router.get('/videos', '#controllers/video_controller.publicIndex')

    // Get video details (for public viewing)
    router.get('/videos/:id', '#controllers/video_controller.show')

    // Transcription routes
    router.get('/videos/:videoId/transcription', '#controllers/transcriptions_controller.show')
    router.get(
      '/videos/:videoId/transcription/history',
      '#controllers/transcriptions_controller.history'
    )
    router
      .post(
        '/videos/:videoId/transcription/correct',
        '#controllers/transcriptions_controller.correct'
      )
      .use(middleware.apiAuth())

    // Person routes
    router.get('/persons/search', '#controllers/persons_controller.search')
    router.get('/videos/:videoId/persons', '#controllers/persons_controller.index')
    router
      .post('/videos/:videoId/persons', '#controllers/persons_controller.sync')
      .use(middleware.apiAuth())
    router
      .delete('/videos/:videoId/persons', '#controllers/persons_controller.detach')
      .use(middleware.apiAuth())

    // Search routes
    router.get('/search', '#controllers/search_controller.search')
    router.get('/persons/:personId/videos', '#controllers/search_controller.byPerson')

    // Leaderboard routes
    router.get('/leaderboard', '#controllers/leaderboard_controller.index')
    router.get('/leaderboard/me', '#controllers/leaderboard_controller.me').use(middleware.auth())

    // Video status routes (for polling processing state)
    router.post('/videos/status', '#controllers/video_status_controller.checkStatus')
    router.get('/videos/:id/status', '#controllers/video_status_controller.show')

    // Like routes (API version for AJAX calls - uses apiAuth to return 401 instead of redirect)
    router
      .post('/videos/:id/like', '#controllers/video_controller.toggleLike')
      .use(middleware.apiAuth())
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
      const { default: Like } = await import('#models/like')
      const { getPublicUrl } = await import('#utils/url_helper')

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

      // Get user's videos (both published and pending)
      const userVideos = await Video.query()
        .where('user_id', auth.user!.id)
        .orderBy('created_at', 'desc')
        .preload('transcriptions', (q) => {
          q.where('is_current', true)
        })
        .preload('persons')

      // Get user's liked videos
      const likedVideos = await Like.query()
        .where('user_id', auth.user!.id)
        .preload('video', (q) => {
          q.where('is_published', true)
        })

      const likedVideosData = likedVideos
        .filter((l) => l.video)
        .map((l) => {
          const v = l.video!
          return {
            id: v.id,
            title: v.title,
            description: v.description,
            filePath: getPublicUrl(v.filePath),
            thumbnailPath: v.thumbnailPath ? getPublicUrl(v.thumbnailPath) : null,
            durationSeconds: v.durationSeconds,
            isPublished: v.isPublished,
            region: v.region,
            viewCount: v.viewCount,
            likeCount: v.likeCount,
            createdAt: v.createdAt,
            userId: v.userId,
          }
        })

      return inertia.render('dashboard', {
        stats: {
          videos: Number(videoCount[0].$extras.total) || 0,
          views: Number(statsResult?.totalViews) || 0,
          likes: Number(statsResult?.totalLikes) || 0,
          points: auth.user!.totalPoints || 0,
        },
        videos: userVideos.map((v) => ({
          id: v.id,
          title: v.title,
          description: v.description,
          filePath: v.filePath,
          durationSeconds: v.durationSeconds,
          thumbnailPath: v.thumbnailPath,
          isPublished: v.isPublished,
          region: v.region,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          createdAt: v.createdAt,
          userId: v.userId,
          persons: v.persons.map((p) => ({ id: p.id, name: p.name })),
          transcription: v.transcriptions[0]?.transcriptionText || null,
        })),
        likedVideos: likedVideosData.map((v) => ({
          id: v.id,
          title: v.title,
          description: v.description,
          filePath: v.filePath,
          thumbnailPath: v.thumbnailPath,
          durationSeconds: v.durationSeconds,
          isPublished: v.isPublished,
          region: v.region,
          viewCount: v.viewCount,
          likeCount: v.likeCount,
          createdAt: v.createdAt,
          userId: v.userId,
          persons: [],
        })),
      })
    })

    // Gallery - with video data (published + user's pending videos)
    router.get('/gallery', async ({ inertia, auth }) => {
      const { default: Video } = await import('#models/video')
      const { default: Like } = await import('#models/like')
      const { getPublicUrl } = await import('#utils/url_helper')

      // Get published videos OR user's own videos (even if pending)
      const videos = await Video.query()
        .where((query) => {
          query.where('is_published', true).orWhere('user_id', auth.user!.id)
        })
        .orderBy('created_at', 'desc')
        .paginate(1, 20)

      // Get user's likes for these videos
      const videoIds = videos.all().map((v) => v.id)
      const userLikes = await Like.query()
        .where('user_id', auth.user!.id)
        .whereIn('video_id', videoIds)

      const likedVideoIds = new Set(userLikes.map((l) => l.videoId))

      // Transform URLs from internal (minio:9000) to public (localhost:9000)
      const transformedVideos = videos.all().map((video) => ({
        ...video.toJSON(),
        filePath: getPublicUrl(video.filePath),
        thumbnailPath: video.thumbnailPath ? getPublicUrl(video.thumbnailPath) : null,
        isPublished: video.isPublished,
      }))

      return inertia.render('gallery', {
        videos: {
          ...videos.toJSON(),
          data: transformedVideos,
        },
        userId: auth.user!.id,
        likedVideoIds: Array.from(likedVideoIds),
        auth: {
          user: {
            id: auth.user!.id,
            fullName: auth.user!.fullName,
          },
          isLoggedIn: true,
        },
      })
    })

    // Upload page
    router.on('/upload').renderInertia('upload')

    // Video streaming route (proxy through app to avoid CORS issues)
    router.get('/videos/stream/:id', async ({ params, response, auth }) => {
      const { default: Video } = await import('#models/video')
      const { default: drive } = await import('@adonisjs/drive/services/main')

      try {
        const video = await Video.findOrFail(params.id)

        // Increment view count when serving video (skip for owner)
        if (video.userId !== auth.user!.id) {
          video.viewCount++
          await video.save()
        }

        // Get video content from MinIO
        const videoBuffer = await drive.use('spaces').getBytes(video.filePath)

        // Determine content type from file extension
        const ext = video.filePath.split('.').pop()?.toLowerCase()
        const contentType =
          ext === 'mp4'
            ? 'video/mp4'
            : ext === 'webm'
              ? 'video/webm'
              : ext === 'ogg'
                ? 'video/ogg'
                : 'video/mp4'

        // Stream the content with proper headers for video playback
        response.header('Content-Type', contentType)
        response.header('Content-Length', videoBuffer.length.toString())
        response.header('Accept-Ranges', 'bytes')
        response.header('Cache-Control', 'public, max-age=3600')

        return response.send(videoBuffer)
      } catch (error) {
        console.error('[Stream] Error serving video:', error)
        return response.status(500).send({ error: 'Failed to stream video' })
      }
    })

    // Video upload routes
    router.post('/videos/upload', '#controllers/video_controller.upload').use(middleware.auth())
    router.get('/videos', '#controllers/video_controller.index')
    router.get('/videos/:id', '#controllers/video_controller.show')
    router.post('/videos/:id/publish', '#controllers/video_controller.publish')
    router.get('/videos/:id/url', '#controllers/video_controller.getSignedUrl')
    router.delete('/videos/:id', '#controllers/video_controller.delete')
    // Note: Like route is now only available via API at /api/v1/videos/:id/like
    router.get('/videos/:id/download', '#controllers/video_controller.download')
  })
  .use(middleware.auth())
