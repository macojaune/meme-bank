import { DateTime } from 'luxon'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { BaseModel, column, hasMany, hasOne, manyToMany, beforeCreate } from '@adonisjs/lucid/orm'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { v4 as uuidv4 } from 'uuid'

import Video from './video.js'
import UserProfile from './user_profile.js'
import UserSetting from './user_setting.js'
import Like from './like.js'
import Comment from './comment.js'
import View from './view.js'
import Playlist from './playlist.js'
import Payment from './payment.js'
import Notification from './notification.js'
import Report from './report.js'
import Subscription from './subscription.js'
import type { HasOne, HasMany, ManyToMany } from '@adonisjs/lucid/types/relations'

const AuthFinder = withAuthFinder(() => hash.use('scrypt'), {
  uids: ['email'],
  passwordColumnName: 'password',
})

export default class User extends compose(BaseModel, AuthFinder) {
  @column({ isPrimary: true })
  declare id: string
  
  @beforeCreate()
  static assignUuid(user: User) {
    user.id = uuidv4()
  }

  @column()
  declare fullName: string | null

  @column()
  declare email: string

  @column({ serializeAs: null })
  declare password: string

  @column.dateTime({ autoCreate: true })
  declare createdAt: DateTime

  @column.dateTime({ autoCreate: true, autoUpdate: true })
  declare updatedAt: DateTime | null

  // Relationships
  @hasOne(() => UserProfile)
  declare profile: HasOne<typeof UserProfile>

  @hasOne(() => UserSetting)
  declare settings: HasOne<typeof UserSetting>

  @hasMany(() => Video)
  declare videos: HasMany<typeof Video>

  @hasMany(() => Like)
  declare likes: HasMany<typeof Like>

  @hasMany(() => Comment)
  declare comments: HasMany<typeof Comment>

  @hasMany(() => View, {
    foreignKey: 'userId',
  })
  declare views: HasMany<typeof View>

  @hasMany(() => Playlist)
  declare playlists: HasMany<typeof Playlist>

  @hasMany(() => Payment)
  declare payments: HasMany<typeof Payment>

  @hasMany(() => Notification, {
    foreignKey: 'userId',
  })
  declare notifications: HasMany<typeof Notification>

  @hasMany(() => Notification, {
    foreignKey: 'actorId',
  })
  declare actorNotifications: HasMany<typeof Notification>

  @hasMany(() => Report, {
    foreignKey: 'reporterId',
  })
  declare reports: HasMany<typeof Report>

  @hasMany(() => Report, {
    foreignKey: 'adminId',
  })
  declare adminReports: HasMany<typeof Report>

  @hasMany(() => Subscription, {
    foreignKey: 'subscriberId',
  })
  declare subscriptions: HasMany<typeof Subscription>

  @hasMany(() => Subscription, {
    foreignKey: 'creatorId',
  })
  declare subscribers: HasMany<typeof Subscription>

  @manyToMany(() => User, {
    pivotTable: 'user_followers',
    pivotForeignKey: 'follower_id',
    pivotRelatedForeignKey: 'following_id',
    pivotTimestamps: true,
  })
  declare following: ManyToMany<typeof User>

  @manyToMany(() => User, {
    pivotTable: 'user_followers',
    pivotForeignKey: 'following_id',
    pivotRelatedForeignKey: 'follower_id',
    pivotTimestamps: true,
  })
  declare followers: ManyToMany<typeof User>
}