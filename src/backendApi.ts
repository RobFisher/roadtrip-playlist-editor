export interface BackendActor {
  userId: string;
  email: string;
  displayName: string;
}

export interface BackendProject {
  projectId: string;
  name: string;
  ownerUserId: string;
  version: number;
  updatedAt: string;
  payload?: unknown;
}

export interface BackendMeResponse {
  authenticated: boolean;
  user: null | {
    userId: string;
    email: string;
    displayName: string;
  };
}

function normalizeApiBaseUrl(rawValue: string | undefined): string {
  const trimmed = rawValue?.trim() ?? "";
  if (!trimmed) {
    return "";
  }
  return trimmed.replace(/\/+$/g, "");
}

export function getApiBaseUrl(): string {
  const configured = normalizeApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
  if (configured) {
    return configured;
  }
  return "";
}

function buildApiPath(path: string): string {
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return path;
  }
  return `${baseUrl}${path}`;
}

function buildHeaders(actor: BackendActor | null): HeadersInit {
  const headers: Record<string, string> = {
    "content-type": "application/json"
  };
  if (actor) {
    headers["x-google-user-id"] = actor.userId;
    headers["x-google-email"] = actor.email;
    headers["x-google-display-name"] = actor.displayName;
  }
  return headers;
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend request failed (${response.status}): ${text}`);
  }
  return (await response.json()) as T;
}

export async function getBackendMe(actor: BackendActor | null): Promise<BackendMeResponse> {
  const response = await fetch(buildApiPath("/api/me"), {
    headers: buildHeaders(actor),
    credentials: "include"
  });
  return await parseResponse<BackendMeResponse>(response);
}

export async function listBackendProjects(actor: BackendActor): Promise<BackendProject[]> {
  const response = await fetch(buildApiPath("/api/projects"), {
    method: "GET",
    headers: buildHeaders(actor),
    credentials: "include"
  });
  const parsed = await parseResponse<{ projects: BackendProject[] }>(response);
  return parsed.projects;
}

export async function getBackendProject(
  actor: BackendActor,
  projectId: string
): Promise<BackendProject> {
  const response = await fetch(buildApiPath(`/api/projects/${encodeURIComponent(projectId)}`), {
    method: "GET",
    headers: buildHeaders(actor),
    credentials: "include"
  });
  const parsed = await parseResponse<{ project: BackendProject }>(response);
  return parsed.project;
}

export async function createBackendProject(
  actor: BackendActor,
  name: string,
  payload: unknown
): Promise<BackendProject> {
  const response = await fetch(buildApiPath("/api/projects"), {
    method: "POST",
    headers: buildHeaders(actor),
    credentials: "include",
    body: JSON.stringify({ name, payload })
  });
  const parsed = await parseResponse<{ project: BackendProject }>(response);
  return parsed.project;
}

export async function updateBackendProject(
  actor: BackendActor,
  projectId: string,
  name: string,
  payload: unknown
): Promise<BackendProject> {
  const response = await fetch(buildApiPath(`/api/projects/${encodeURIComponent(projectId)}`), {
    method: "PUT",
    headers: buildHeaders(actor),
    credentials: "include",
    body: JSON.stringify({ name, payload })
  });
  const parsed = await parseResponse<{ project: BackendProject }>(response);
  return parsed.project;
}
