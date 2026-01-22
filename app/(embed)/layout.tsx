export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Simple layout for embed - no fixed positioning needed inside iframe
  return (
    <div className="min-h-screen bg-white">
      {children}
    </div>
  )
}
