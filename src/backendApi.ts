export interface BackendMeResponse {
  authenticated: boolean;
  user: null | {
    userId: string;
    email: string;
    displayName: string;
  };
  message?: string;
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

export async function getBackendMe(): Promise<BackendMeResponse> {
  const response = await fetch(buildApiPath("/api/me"), {
    credentials: "include"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Backend /api/me failed (${response.status}): ${text}`);
  }

  return (await response.json()) as BackendMeResponse;
}
