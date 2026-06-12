export const SHARED_PASSWORD = "govimo2026";

export interface DemoUser {
  id: string;
  name: "Michael" | "Felipe" | "Federico";
  role: string;
  organization: string;
}

export const USERS: DemoUser[] = [
  { id: "michael", name: "Michael", role: "AXIO Builder", organization: "AXIO" },
  { id: "felipe", name: "Felipe", role: "Partner / KPIs", organization: "Cosmic" },
  { id: "federico", name: "Federico", role: "Datos y flujo", organization: "Govimo" },
];

export function authenticateUser(name: string, password: string): DemoUser | null {
  const user = USERS.find((candidate) => candidate.name === name);
  if (!user || password !== SHARED_PASSWORD) return null;
  return user;
}

export function serializeSession(user: DemoUser | null): string {
  return JSON.stringify(user);
}

export function restoreSession(value: string | null): DemoUser | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<DemoUser>;
    return USERS.find((user) => user.id === parsed.id && user.name === parsed.name) ?? null;
  } catch {
    return null;
  }
}
