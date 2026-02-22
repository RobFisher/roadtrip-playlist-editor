export interface BackendSessionUser {
  userId: string;
  email: string;
  displayName: string;
}

export interface BackendProject {
  projectId: string;
  name: string;
  ownerUserId: string;
  ownerDisplayName: string;
  version: number;
  updatedAt: string;
  payload?: unknown;
}

export interface BackendMeResponse {
  authenticated: boolean;
  user: BackendSessionUser | null;
}

export interface BackendSessionDebugResponse {
  env: string;
  request: {
    origin: string;
    host: string;
  };
  cookie: {
    headerPresent: boolean;
    hasSessionCookie: boolean;
    sessionIdPrefix: string | null;
  };
  session: {
    authenticated: boolean;
    user: BackendSessionUser | null;
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

async function parseResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend request failed (${response.status}): ${text}`);
  }
  if (!contentType.toLowerCase().includes("application/json")) {
    const text = await response.text();
    throw new Error(
      `Backend returned non-JSON response (${response.status}, content-type: ${contentType || "unknown"}): ${text.slice(0, 180)}`
    );
  }
  return (await response.json()) as T;
}

export async function createBackendGoogleSession(
  accessToken: string,
  displayName?: string
): Promise<BackendMeResponse> {
  const response = await fetch(buildApiPath("/api/auth/google/session"), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({
      accessToken,
      displayName: displayName?.trim() || undefined
    })
  });
  return await parseResponse<BackendMeResponse>(response);
}

export async function logoutBackendSession(): Promise<void> {
  const response = await fetch(buildApiPath("/api/auth/logout"), {
    method: "POST",
    credentials: "include"
  });
  await parseResponse<{ ok: boolean }>(response);
}

export async function getBackendMe(): Promise<BackendMeResponse> {
  const response = await fetch(buildApiPath("/api/me"), {
    credentials: "include"
  });
  return await parseResponse<BackendMeResponse>(response);
}

export async function getBackendSessionDebug(): Promise<BackendSessionDebugResponse> {
  const response = await fetch(buildApiPath("/api/debug/session"), {
    credentials: "include"
  });
  return await parseResponse<BackendSessionDebugResponse>(response);
}

export async function setBackendDebugCookie(): Promise<{ ok: boolean; message: string }> {
  const response = await fetch(buildApiPath("/api/debug/set-cookie"), {
    method: "POST",
    credentials: "include"
  });
  return await parseResponse<{ ok: boolean; message: string }>(response);
}

export async function listBackendProjects(): Promise<BackendProject[]> {
  const response = await fetch(buildApiPath("/api/projects"), {
    method: "GET",
    credentials: "include"
  });
  const parsed = await parseResponse<{ projects: BackendProject[] }>(response);
  return parsed.projects;
}

export async function getBackendProject(projectId: string): Promise<BackendProject> {
  const response = await fetch(buildApiPath(`/api/projects/${encodeURIComponent(projectId)}`), {
    method: "GET",
    credentials: "include"
  });
  const parsed = await parseResponse<{ project: BackendProject }>(response);
  return parsed.project;
}

export async function createBackendProject(
  name: string,
  payload: unknown
): Promise<BackendProject> {
  const response = await fetch(buildApiPath("/api/projects"), {
    method: "POST",
    headers: {
      "content-type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ name, payload })
  });
  const parsed = await parseResponse<{ project: BackendProject }>(response);
  return parsed.project;
}

export async function updateBackendProject(
  projectId: string,
  name: string,
  payload: unknown
): Promise<BackendProject> {
  const response = await fetch(buildApiPath(`/api/projects/${encodeURIComponent(projectId)}`), {
    method: "PUT",
    headers: {
      "content-type": "application/json"
    },
    credentials: "include",
    body: JSON.stringify({ name, payload })
  });
  const parsed = await parseResponse<{ project: BackendProject }>(response);
  return parsed.project;
}
