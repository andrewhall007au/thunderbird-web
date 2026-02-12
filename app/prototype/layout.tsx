export default function PrototypeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style>{`
        /* Strip root layout chrome for fullscreen prototype */
        nav.fixed { display: none !important; }
        footer { display: none !important; }
        .fixed.top-0 { display: none !important; }
        main.pt-24 { padding-top: 0 !important; min-height: 0 !important; }
      `}</style>
      {children}
    </>
  );
}
