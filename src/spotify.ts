const AUTH_BASE_URL = "https://accounts.spotify.com";
const API_BASE_URL = "https://api.spotify.com/v1";
export const REQUIRED_SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative"
] as const;

export interface SpotifyTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
  scope: string;
}

export interface SpotifyPlaylistSummary {
  id: string;
  name: string;
  tracksTotal: number;
  ownerId: string;
  ownerDisplayName: string;
}

export interface SpotifyTrackSummary {
  id: string;
  title: string;
  artists: string;
  artworkUrl: string;
  spotifyUri: string;
}

export interface SpotifyAuthConfig {
  clientId: string;
  redirectUri: string;
  scopes: string[];
}

export function generateRandomString(length: number): string {
  const alphabet =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += alphabet[bytes[i] % alphabet.length];
  }
  return result;
}

function toBase64Url(input: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...input));
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function createCodeChallenge(verifier: string): Promise<string> {
  const encoded = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return toBase64Url(new Uint8Array(digest));
}

export async function buildSpotifyAuthorizeUrl(
  config: SpotifyAuthConfig,
  state: string,
  codeVerifier: string
): Promise<string> {
  const challenge = await createCodeChallenge(codeVerifier);
  const query = new URLSearchParams({
    client_id: config.clientId,
    response_type: "code",
    redirect_uri: config.redirectUri,
    code_challenge_method: "S256",
    code_challenge: challenge,
    state,
    scope: config.scopes.join(" "),
    show_dialog: "true"
  });

  return `${AUTH_BASE_URL}/authorize?${query.toString()}`;
}

export async function exchangeCodeForToken(
  config: SpotifyAuthConfig,
  code: string,
  codeVerifier: string
): Promise<SpotifyTokenResponse> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.clientId,
    code_verifier: codeVerifier
  });

  const response = await fetch(`${AUTH_BASE_URL}/api/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Spotify token exchange failed: ${response.status} ${text}`);
  }

  return (await response.json()) as SpotifyTokenResponse;
}

async function spotifyGet<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    const text = await response.text();
    let detail = text;
    try {
      const parsed = JSON.parse(text) as {
        error?: { status?: number; message?: string };
        error_description?: string;
      };
      if (parsed.error?.message) {
        detail = parsed.error.message;
      } else if (parsed.error_description) {
        detail = parsed.error_description;
      }
    } catch {
      // Keep raw response text when it is not JSON.
    }
    throw new Error(`Spotify request failed (${response.status}): ${detail}`);
  }

  return (await response.json()) as T;
}

export async function getCurrentUserPlaylists(
  accessToken: string
): Promise<SpotifyPlaylistSummary[]> {
  type PageResponse = {
    items: Array<{
      id: string;
      name: string;
      tracks?: { total?: number };
      owner?: { id?: string; display_name?: string };
    }>;
    next: string | null;
  };

  const playlists: SpotifyPlaylistSummary[] = [];
  let nextPath = "/me/playlists?limit=50";

  while (nextPath) {
    const page = await spotifyGet<PageResponse>(nextPath, accessToken);
    playlists.push(
      ...page.items.map((item) => ({
        id: item.id,
        name: item.name,
        tracksTotal: item.tracks?.total ?? 0,
        ownerId: item.owner?.id ?? "",
        ownerDisplayName: item.owner?.display_name ?? item.owner?.id ?? ""
      }))
    );

    if (!page.next) {
      break;
    }

    const nextUrl = new URL(page.next);
    nextPath = `${nextUrl.pathname.replace("/v1", "")}${nextUrl.search}`;
  }

  return playlists;
}

export async function getCurrentUserProfile(
  accessToken: string
): Promise<{ id: string; displayName: string }> {
  const me = await spotifyGet<{ id: string; display_name?: string }>("/me", accessToken);
  return {
    id: me.id,
    displayName: me.display_name ?? me.id
  };
}

export async function getPlaylistTracks(
  accessToken: string,
  playlistId: string
): Promise<SpotifyTrackSummary[]> {
  type TracksResponse = {
    items: Array<{
      is_local?: boolean;
      track: null | {
        id: string | null;
        name?: string;
        uri?: string;
        artists?: Array<{ name?: string }>;
        album?: { images?: Array<{ url?: string }> };
      };
    }>;
    next: string | null;
  };

  const tracks: SpotifyTrackSummary[] = [];
  const seenTrackIds = new Set<string>();
  let nextPath = `/playlists/${encodeURIComponent(playlistId)}/items?limit=100`;

  while (nextPath) {
    const page = await spotifyGet<TracksResponse>(nextPath, accessToken);
    page.items.forEach((item, index) => {
      const track = item.track;
      if (!track) {
        return;
      }

      const spotifyUri = track.uri ?? "";
      const fallbackFromUri = spotifyUri
        ? spotifyUri.replace("spotify:", "spotify_").replace(/:/g, "_")
        : `playlist_${playlistId}_item_${tracks.length + index + 1}`;
      const canonicalId = track.id ?? fallbackFromUri;
      if (seenTrackIds.has(canonicalId)) {
        return;
      }
      seenTrackIds.add(canonicalId);

      const artistNames =
        track.artists
          ?.map((artist) => artist.name?.trim() ?? "")
          .filter((name) => name.length > 0)
          .join(", ") ?? "";

      tracks.push({
        id: canonicalId,
        title: track.name?.trim() || "Unknown title",
        artists: artistNames || "Unknown artist",
        artworkUrl: track.album?.images?.[0]?.url ?? "",
        spotifyUri
      });
    });

    if (!page.next) {
      break;
    }

    const nextUrl = new URL(page.next);
    nextPath = `${nextUrl.pathname.replace("/v1", "")}${nextUrl.search}`;
  }

  return tracks;
}

export function hasRequiredScopes(grantedScope: string, requiredScopes: string[]): boolean {
  const granted = new Set(grantedScope.split(" ").map((scope) => scope.trim()).filter(Boolean));
  return requiredScopes.every((scope) => granted.has(scope));
}
