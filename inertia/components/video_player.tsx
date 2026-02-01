interface VideoPlayerProps {
  videoUrl: string
  maxHeight?: string
}

export default function VideoPlayer({ videoUrl, maxHeight = '50vh' }: VideoPlayerProps) {
  return (
    <div className="bg-black border-2 border-black rounded overflow-hidden" style={{ maxHeight }}>
      <video
        src={videoUrl}
        controls
        className="w-full h-full object-contain"
        style={{ maxHeight }}
        preload="metadata"
      >
        <track kind="captions" />
      </video>
    </div>
  )
}
