export const VIDEO_TERRITORIES = [
  { id: 'guadeloupe', name: 'Guadeloupe' },
  { id: 'martinique', name: 'Martinique' },
  { id: 'guyane', name: 'Guyane' },
] as const

export const VIDEO_TERRITORY_IDS = VIDEO_TERRITORIES.map(({ id }) => id)
