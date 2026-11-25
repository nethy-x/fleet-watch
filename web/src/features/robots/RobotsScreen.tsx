import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { fetchRobots } from "@/lib/api";

// Proves the wiring (web → proxy → server → Postgres) and nothing more.
// The screen you are asked to build is in the Figma file.
export function RobotsScreen() {
  const robots = useQuery({ queryKey: ["robots"], queryFn: fetchRobots });

  return (
    <div className="mx-auto max-w-5xl p-6">
      <h1 className="mb-4 text-2xl font-bold tracking-tight">Robots</h1>
      {robots.isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
      {robots.isError && <p className="text-sm text-destructive">Failed to load robots.</p>}
      <ul className="space-y-2">
        {robots.data?.map((robot) => (
          <li
            key={robot.id}
            className="flex items-center justify-between rounded-lg border border-border bg-card p-4"
          >
            <span className="font-semibold">{robot.name}</span>
            <Badge>{robot.type}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
