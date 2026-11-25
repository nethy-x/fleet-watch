import { RobotsScreen } from "@/features/robots/RobotsScreen";

export function App() {
  return (
    <div className="flex min-h-full flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-6">
        <div className="flex items-center gap-2">
          <span className="h-5 w-5 rounded-sm bg-foreground" aria-hidden />
          <span className="text-sm font-semibold">Fleet Watch</span>
        </div>
        <span className="text-sm text-muted-foreground">Northwind Security</span>
      </header>
      <main className="flex-1">
        <RobotsScreen />
      </main>
    </div>
  );
}
