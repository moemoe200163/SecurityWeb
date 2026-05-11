export function MainContent({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex-1 overflow-auto bg-background">
      {children}
    </main>
  );
}
