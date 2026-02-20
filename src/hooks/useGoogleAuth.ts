import { useMemo, useState } from "react";
import {
  fetchGoogleUserProfile,
  REQUIRED_GOOGLE_SCOPES,
  requestGoogleAccessToken,
  revokeGoogleAccessToken,
  type GoogleUserProfile
} from "../google.js";

export interface UseGoogleAuthResult {
  googleToken: string | null;
  googleUser: GoogleUserProfile | null;
  googleAuthError: string | null;
  googleAuthLoading: boolean;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
}

export function useGoogleAuth(): UseGoogleAuthResult {
  const [googleToken, setGoogleToken] = useState<string | null>(null);
  const [googleUser, setGoogleUser] = useState<GoogleUserProfile | null>(null);
  const [googleAuthError, setGoogleAuthError] = useState<string | null>(null);
  const [googleAuthLoading, setGoogleAuthLoading] = useState(false);

  const googleClientId = useMemo(() => import.meta.env.VITE_GOOGLE_CLIENT_ID ?? "", []);

  async function connectGoogle(): Promise<void> {
    if (!googleClientId) {
      setGoogleAuthError("Missing VITE_GOOGLE_CLIENT_ID. Check README setup.");
      return;
    }

    setGoogleAuthLoading(true);
    try {
      const token = await requestGoogleAccessToken(googleClientId, [
        ...REQUIRED_GOOGLE_SCOPES
      ]);
      const profile = await fetchGoogleUserProfile(token.accessToken);
      setGoogleToken(token.accessToken);
      setGoogleUser(profile);
      setGoogleAuthError(null);
    } catch (error) {
      setGoogleToken(null);
      setGoogleUser(null);
      setGoogleAuthError(error instanceof Error ? error.message : "Google login failed.");
    } finally {
      setGoogleAuthLoading(false);
    }
  }

  async function disconnectGoogle(): Promise<void> {
    const tokenToRevoke = googleToken;
    setGoogleToken(null);
    setGoogleUser(null);
    setGoogleAuthError(null);
    if (tokenToRevoke) {
      await revokeGoogleAccessToken(tokenToRevoke);
    }
  }

  return {
    googleToken,
    googleUser,
    googleAuthError,
    googleAuthLoading,
    connectGoogle,
    disconnectGoogle
  };
}
