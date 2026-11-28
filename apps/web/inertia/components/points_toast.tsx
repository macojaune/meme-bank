import { useEffect, useState } from 'react'

interface Toast {
  id: string
  points: number
  reason: string
  message: string
}

export default function PointsToast({ userId }: { userId: string }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  useEffect(() => {
    // TODO: Implement WebSocket or SSE connection when Transmit is fully configured
    // For now, points are displayed on the dashboard stats card
    console.log(`[PointsToast] Monitoring points for user ${userId}`)
  }, [userId])

  // No polling needed - points are shown in dashboard stats
  // Real-time notifications disabled until WebSocket/SSE is properly configured
  return null
}
