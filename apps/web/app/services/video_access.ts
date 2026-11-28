export function canManageVideo(ownerId: string, userId: string): boolean {
  return ownerId === userId
}

export function canViewVideo(video: { userId: string; isPublished: boolean }, userId?: string) {
  return video.isPublished || (userId !== undefined && video.userId === userId)
}
