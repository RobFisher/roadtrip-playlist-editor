const GOOGLE_IDENTITY_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";

export const REQUIRED_GOOGLE_SCOPES = ["openid", "profile", "email"] as const;

interface GoogleTokenResponseBase {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface GoogleTokenClient {
  requestAccessToken: (overrides?: {
    prompt?: string;
    scope?: string;
    include_granted_scopes?: boolean;
  }) => void;
}

interface GoogleTokenClientConfig {
  client_id: string;
  scope: string;
  callback: (response: GoogleTokenResponseBase) => void;
  error_callback?: (error: { type: string }) => void;
}

declare global {
  interface Window {
    google?: {
      accounts?: {
        oauth2?: {
          initTokenClient: (config: GoogleTokenClientConfig) => GoogleTokenClient;
          revoke: (token: string, callback?: () => void) => void;
        };
      };
    };
  }
}

let googleScriptLoadPromise: Promise<void> | null = null;

function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.oauth2) {
    return Promise.resolve();
  }
  if (googleScriptLoadPromise) {
    return googleScriptLoadPromise;
  }

  googleScriptLoadPromise = new Promise<void>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      `script[src="${GOOGLE_IDENTITY_SCRIPT_URL}"]`
    );
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("Failed to load Google Identity Services script.")),
        { once: true }
      );
      return;
    }

    const script = document.createElement("script");
    script.src = GOOGLE_IDENTITY_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () =>
      reject(new Error("Failed to load Google Identity Services script."));
    document.head.appendChild(script);
  }).finally(() => {
    if (!window.google?.accounts?.oauth2) {
      googleScriptLoadPromise = null;
    }
  });

  return googleScriptLoadPromise;
}

export interface GoogleTokenResponse {
  accessToken: string;
  expiresIn: number;
  scope: string;
  tokenType: string;
}

export interface GoogleUserProfile {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

export async function requestGoogleAccessToken(
  clientId: string,
  scopes: string[]
): Promise<GoogleTokenResponse> {
  await loadGoogleIdentityScript();
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error("Google Identity Services is unavailable in this browser.");
  }

  return await new Promise<GoogleTokenResponse>((resolve, reject) => {
    const tokenClient = oauth2.initTokenClient({
      client_id: clientId,
      scope: scopes.join(" "),
      callback: (response) => {
        if (response.error) {
          reject(
            new Error(
              `Google auth failed: ${response.error_description ?? response.error}`
            )
          );
          return;
        }
        if (!response.access_token) {
          reject(new Error("Google auth did not return an access token."));
          return;
        }
        resolve({
          accessToken: response.access_token,
          expiresIn: response.expires_in ?? 0,
          scope: response.scope ?? "",
          tokenType: response.token_type ?? "Bearer"
        });
      },
      error_callback: (error) => {
        reject(new Error(`Google auth popup failed: ${error.type}`));
      }
    });

    tokenClient.requestAccessToken({ prompt: "consent" });
  });
}

export async function fetchGoogleUserProfile(
  accessToken: string
): Promise<GoogleUserProfile> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Google user profile request failed (${response.status}): ${text}`);
  }

  const profile = (await response.json()) as Partial<GoogleUserProfile>;
  if (!profile.sub || !profile.email) {
    throw new Error("Google user profile response is missing required fields.");
  }

  return {
    sub: profile.sub,
    email: profile.email,
    name: profile.name?.trim() || profile.email,
    picture: profile.picture
  };
}

export function revokeGoogleAccessToken(accessToken: string): Promise<void> {
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    oauth2.revoke(accessToken, () => resolve());
  });
}
