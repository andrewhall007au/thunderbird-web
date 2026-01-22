export default function PreviewLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // This layout removes the parent's header/footer by using absolute positioning
  // to cover them, and provides its own dark background
  return (
    <div className="fixed inset-0 z-[100] bg-zinc-900">
      {children}
    </div>
  )
}
