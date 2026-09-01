import { randomUUID } from 'node:crypto'
import { BaseSeeder } from '@adonisjs/lucid/seeders'
import db from '@adonisjs/lucid/services/db'
import User from '#models/user'

const previewVideos = [
  {
    id: 'de3eebfa-17e1-4dcf-9ef2-4a7f194bb2cf',
    title: "a pa lè a'y",
    description: null,
    filePath: 'seed/memes/videos/9772f8cb-d666-4a2e-8a5a-c2ae53559850.mp4',
    thumbnailPath: 'seed/memes/thumbnails/de3eebfa-17e1-4dcf-9ef2-4a7f194bb2cf.jpg',
    durationSeconds: 0,
    viewCount: 0,
    likeCount: 1,
    region: 'guadeloupe',
    uploadDate: '2026-02-01T00:04:08.712Z',
    createdAt: '2026-02-01T00:04:08.712Z',
    updatedAt: '2026-02-02T02:13:02.022Z',
  },
  {
    id: '7cc64d2b-3f97-48de-b18c-5bf81502e256',
    title: 'Parle plus fort monsieur le maire',
    description: 'Interview maire du carbet avec un invité surprise',
    filePath: 'seed/memes/videos/6c7b74c8-c992-4d80-86ef-4835b049a7e4.mp4',
    thumbnailPath: 'seed/memes/thumbnails/7cc64d2b-3f97-48de-b18c-5bf81502e256.jpg',
    durationSeconds: 0,
    viewCount: 0,
    likeCount: 1,
    region: 'martinique',
    uploadDate: '2026-02-01T07:26:25.752Z',
    createdAt: '2026-02-01T07:26:25.753Z',
    updatedAt: '2026-02-02T02:10:06.459Z',
  },
  {
    id: 'a38be8c2-4f29-4742-88af-a897f9694eaa',
    title: 'Chaud patate',
    description: null,
    filePath: 'seed/memes/videos/c2dc5f74-c7e8-4852-abea-07db19ff004c.mp4',
    thumbnailPath: 'seed/memes/thumbnails/a38be8c2-4f29-4742-88af-a897f9694eaa.jpg',
    durationSeconds: 0,
    viewCount: 0,
    likeCount: 0,
    region: 'martinique',
    uploadDate: '2026-02-01T07:43:02.975Z',
    createdAt: '2026-02-01T07:43:02.975Z',
    updatedAt: '2026-02-02T04:09:13.140Z',
  },
  {
    id: '007731a6-b424-447f-b801-e49dd0c47733',
    title: 'Une place ! Sa pété',
    description: 'Un classique',
    filePath: 'seed/memes/videos/899f3dd4-6a85-4886-9995-263b4c86e67e.mp4',
    thumbnailPath: 'seed/memes/thumbnails/007731a6-b424-447f-b801-e49dd0c47733.jpg',
    durationSeconds: 0,
    viewCount: 1,
    likeCount: 1,
    region: 'guadeloupe',
    uploadDate: '2026-02-01T07:57:02.150Z',
    createdAt: '2026-02-01T07:57:02.150Z',
    updatedAt: '2026-02-22T21:49:34.113Z',
  },
  {
    id: '63108b9d-71f1-4824-8c35-4a62ff1bcdcd',
    title: 'ou anvi fè love',
    description: 'il en avait gros sur la patate',
    filePath: 'seed/memes/videos/ad824eeb-5da6-4cee-9432-b15f93e3866f.mp4',
    thumbnailPath: 'seed/memes/thumbnails/63108b9d-71f1-4824-8c35-4a62ff1bcdcd.jpg',
    durationSeconds: 0,
    viewCount: 0,
    likeCount: 1,
    region: 'guadeloupe',
    uploadDate: '2026-02-01T08:10:29.606Z',
    createdAt: '2026-02-01T08:10:29.607Z',
    updatedAt: '2026-02-02T02:13:10.875Z',
  },
] as const

export default class extends BaseSeeder {
  async run() {
    const owner = await User.firstOrCreate(
      { email: 'seed@memebank.invalid' },
      {
        fullName: 'MemeBank',
        password: randomUUID(),
        totalPoints: 0,
      }
    )

    await db.transaction(async (trx) => {
      for (const video of previewVideos) {
        const payload = {
          user_id: owner.id,
          title: video.title,
          description: video.description,
          file_path: video.filePath,
          thumbnail_path: video.thumbnailPath,
          duration_seconds: video.durationSeconds,
          view_count: video.viewCount,
          like_count: video.likeCount,
          is_published: true,
          is_featured: false,
          region: video.region,
          upload_date: video.uploadDate,
          created_at: video.createdAt,
          updated_at: video.updatedAt,
        }

        const existingVideo = await trx.from('videos').where('id', video.id).first()
        if (existingVideo) {
          await trx.from('videos').where('id', video.id).update(payload)
        } else {
          await trx.table('videos').insert({ id: video.id, ...payload })
        }
      }
    })
  }
}
