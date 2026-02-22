import { useEffect, useMemo, useState } from "react";
import {
  REQUIRED_SPOTIFY_SCOPES,
  buildSpotifyAuthorizeUrl,
  exchangeCodeForToken,
  generateRandomString,
  hasRequiredScopes,
  type SpotifyAuthConfig
} from "../spotify.js";

const SPOTIFY_AUTH_STATE_KEY = "spotify_pkce_state";
const SPOTIFY_AUTH_VERIFIER_KEY = "spotify_pkce_verifier";
const SPOTIFY_ACCESS_TOKEN_KEY = "spotify_access_token";
const SPOTIFY_ACCESS_TOKEN_EXPIRES_AT_KEY = "spotify_access_token_expires_at";

function isLoopbackHostname(hostname: string): boolean {
  const normalized = hostname.trim().toLowerCase();
  return normalized === "localhost" || normalized === "127.0.0.1";
}

function resolveSpotifyRedirectUri(configuredRedirectUri?: string): string {
  const currentPageRedirectUri = `${window.location.origin}${window.location.pathname}`;
  const currentUrl = new URL(currentPageRedirectUri);
  if (!isLoopbackHostname(currentUrl.hostname)) {
    return currentPageRedirectUri;
  }

  const configured = configuredRedirectUri?.trim() ?? "";
  if (!configured) {
    return currentPageRedirectUri;
  }

  try {
    const configuredUrl = new URL(configured);
    // On loopback hosts, allow explicit override for local dev scenarios.
    if (!isLoopbackHostname(configuredUrl.hostname)) {
      return currentPageRedirectUri;
    }
    return configuredUrl.toString();
  } catch {
    return currentPageRedirectUri;
  }
}

export interface UseSpotifyAuthResult {
  spotifyToken: string | null;
  spotifyAuthError: string | null;
  connectSpotify: () => Promise<void>;
  disconnectSpotify: () => void;
}

export function useSpotifyAuth(): UseSpotifyAuthResult {
  const [spotifyToken, setSpotifyToken] = useState<string | null>(
    localStorage.getItem(SPOTIFY_ACCESS_TOKEN_KEY)
  );
  const [spotifyAuthError, setSpotifyAuthError] = useState<string | null>(null);

  const spotifyConfig: SpotifyAuthConfig = useMemo(() => {
    const clientId = import.meta.env.VITE_SPOTIFY_CLIENT_ID ?? "";
    const redirectUri = resolveSpotifyRedirectUri(import.meta.env.VITE_SPOTIFY_REDIRECT_URI);

    return {
      clientId,
      redirectUri,
      scopes: [...REQUIRED_SPOTIFY_SCOPES]
    };
  }, []);

  useEffect(() => {
    const expiresAtRaw = localStorage.getItem(SPOTIFY_ACCESS_TOKEN_EXPIRES_AT_KEY);
    const expiresAt = expiresAtRaw ? Number.parseInt(expiresAtRaw, 10) : 0;
    if (expiresAt && Date.now() > expiresAt) {
      localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_KEY);
      localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_EXPIRES_AT_KEY);
      setSpotifyToken(null);
    }
  }, []);

  useEffect(() => {
    const url = new URL(window.location.href);
    const code = url.searchParams.get("code");
    const returnedState = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");

    if (oauthError) {
      setSpotifyAuthError(`Spotify auth error: ${oauthError}`);
      url.searchParams.delete("error");
      window.history.replaceState({}, "", url.toString());
      return;
    }

    if (!code || !returnedState) {
      return;
    }

    const expectedState = sessionStorage.getItem(SPOTIFY_AUTH_STATE_KEY);
    const verifier = sessionStorage.getItem(SPOTIFY_AUTH_VERIFIER_KEY);
    if (!expectedState || !verifier || expectedState !== returnedState) {
      setSpotifyAuthError("Spotify auth state mismatch. Please try again.");
      return;
    }

    // Consume callback params before async work to avoid double exchange in dev remounts.
    url.searchParams.delete("code");
    url.searchParams.delete("state");
    window.history.replaceState({}, "", url.toString());

    const run = async () => {
      try {
        const tokenResponse = await exchangeCodeForToken(spotifyConfig, code, verifier);
        setSpotifyToken(tokenResponse.access_token);
        localStorage.setItem(SPOTIFY_ACCESS_TOKEN_KEY, tokenResponse.access_token);
        localStorage.setItem(
          SPOTIFY_ACCESS_TOKEN_EXPIRES_AT_KEY,
          String(Date.now() + tokenResponse.expires_in * 1000)
        );
        if (!hasRequiredScopes(tokenResponse.scope, [...REQUIRED_SPOTIFY_SCOPES])) {
          throw new Error(
            "Spotify login is missing required playlist scopes. Disconnect and connect again."
          );
        }
        setSpotifyAuthError(null);
      } catch (error) {
        setSpotifyToken(null);
        localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_KEY);
        localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_EXPIRES_AT_KEY);
        setSpotifyAuthError(
          error instanceof Error ? error.message : "Failed to complete Spotify auth."
        );
      } finally {
        sessionStorage.removeItem(SPOTIFY_AUTH_STATE_KEY);
        sessionStorage.removeItem(SPOTIFY_AUTH_VERIFIER_KEY);
      }
    };

    void run();
  }, [spotifyConfig]);

  async function connectSpotify(): Promise<void> {
    if (!spotifyConfig.clientId) {
      setSpotifyAuthError("Missing VITE_SPOTIFY_CLIENT_ID. Check README setup.");
      return;
    }

    const state = generateRandomString(32);
    const verifier = generateRandomString(64);
    sessionStorage.setItem(SPOTIFY_AUTH_STATE_KEY, state);
    sessionStorage.setItem(SPOTIFY_AUTH_VERIFIER_KEY, verifier);

    const authUrl = await buildSpotifyAuthorizeUrl(spotifyConfig, state, verifier);
    window.location.href = authUrl;
  }

  function disconnectSpotify(): void {
    setSpotifyToken(null);
    localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(SPOTIFY_ACCESS_TOKEN_EXPIRES_AT_KEY);
  }

  return {
    spotifyToken,
    spotifyAuthError,
    connectSpotify,
    disconnectSpotify
  };
}
