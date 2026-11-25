// The REST client. Types here are written by hand to match the server's
// responses — there is no codegen, so a server change is a change here too.

export type RobotType = "G1" | "GO2";

export type Robot = {
  id: string;
  name: string;
  type: RobotType;
  organization: { id: string; name: string };
};

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`/api${path}`, { headers: { Accept: "application/json" } });
  if (!res.ok) throw new ApiError(res.status, `${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

export function fetchRobots(): Promise<Robot[]> {
  return get<Robot[]>("/robots");
}
