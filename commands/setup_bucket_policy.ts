import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class SetupBucketPolicy extends BaseCommand {
  static commandName = 'minio:setup-policy'
  static description = 'Instructions to setup MinIO bucket policy for public thumbnails'

  static options: CommandOptions = {
    startApp: false,
  }

  async run() {
    this.logger.info('=== MinIO Bucket Policy Setup ===')
    this.logger.info('')
    this.logger.warning('Thumbnails need public access to be displayed in the gallery.')
    this.logger.info('')
    this.logger.info('Please configure MinIO manually:')
    this.logger.info('')
    this.logger.info('1. Open MinIO Console: http://localhost:9001')
    this.logger.info('2. Login: minioadmin / minioadmin123')
    this.logger.info('3. Navigate: Buckets > memes')
    this.logger.info('4. Click "Access Policy" tab')
    this.logger.info('5. Add new policy:')
    this.logger.info('   - Path: thumbnails/*')
    this.logger.info('   - Access: readonly')
    this.logger.info('')
    this.logger.info('Or use MinIO Client (mc):')
    this.logger.info('  mc anonymous set download local/memes/thumbnails/')
    this.logger.info('')
    this.logger.info('Note: New thumbnails are now uploaded with public visibility.')
    this.logger.info('Existing thumbnails need manual policy setup or re-generation.')
  }
}
