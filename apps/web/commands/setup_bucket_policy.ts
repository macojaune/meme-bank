import { BaseCommand } from '@adonisjs/core/ace'
import type { CommandOptions } from '@adonisjs/core/types/ace'

export default class SetupBucketPolicy extends BaseCommand {
  static commandName = 'minio:setup-policy'
  static description = 'Show the object access policy required for MemeBank'

  static options: CommandOptions = {
    startApp: false,
  }

  async run() {
    this.logger.info(
      'Keep both video buckets private, including thumbnails. MemeBank serves authorized media.'
    )
    this.logger.info(
      'Review anonymous access in the MinIO console for existing buckets and prefixes.'
    )
  }
}
