export function canManageVideo(ownerId: string, userId: string): boolean {
  return ownerId === userId
}
