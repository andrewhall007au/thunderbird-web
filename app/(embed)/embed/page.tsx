import dynamic from 'next/dynamic';

const EmbedContent = dynamic(() => import('./EmbedContent'), {
  ssr: false,
  loading: () => (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-zinc-400">Loading...</div>
    </div>
  ),
});

export default function EmbedPage() {
  return <EmbedContent />;
}
