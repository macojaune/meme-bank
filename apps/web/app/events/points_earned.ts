import User from '#models/user'

export default class PointsEarned {
  constructor(
    public user: User,
    public points: number,
    public reason: string
  ) {}
}
