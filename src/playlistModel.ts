export interface Song {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string;
}

export interface Playlist {
  id: string;
  name: string;
  songIds: string[];
}

export interface ProjectData {
  songs: Song[];
  playlists: Playlist[];
}

export interface DragPayload {
  songId: string;
  sourcePlaylistId: string;
  mode: "copy" | "move";
}

export function countSongMemberships(
  playlists: Playlist[],
  songId: string
): number {
  return playlists.filter((playlist) => playlist.songIds.includes(songId)).length;
}

export function applySongDrop(
  playlists: Playlist[],
  payload: DragPayload,
  destinationPlaylistId: string
): Playlist[] {
  return playlists.map((playlist) => {
    if (playlist.id === destinationPlaylistId) {
      if (playlist.songIds.includes(payload.songId)) {
        return playlist;
      }

      return {
        ...playlist,
        songIds: [...playlist.songIds, payload.songId]
      };
    }

    if (
      payload.mode === "move" &&
      playlist.id === payload.sourcePlaylistId &&
      payload.sourcePlaylistId !== destinationPlaylistId
    ) {
      return {
        ...playlist,
        songIds: playlist.songIds.filter((songId) => songId !== payload.songId)
      };
    }

    return playlist;
  });
}

export const seedProjectData: ProjectData = {
  songs: [
    {
      id: "song-001",
      title: "Levitating",
      artist: "Dua Lipa",
      artworkUrl: "https://picsum.photos/seed/roadtrip-1/80/80"
    },
    {
      id: "song-002",
      title: "Go Your Own Way",
      artist: "Fleetwood Mac",
      artworkUrl: "https://picsum.photos/seed/roadtrip-2/80/80"
    },
    {
      id: "song-003",
      title: "Midnight City",
      artist: "M83",
      artworkUrl: "https://picsum.photos/seed/roadtrip-3/80/80"
    },
    {
      id: "song-004",
      title: "Mr. Brightside",
      artist: "The Killers",
      artworkUrl: "https://picsum.photos/seed/roadtrip-4/80/80"
    },
    {
      id: "song-005",
      title: "On Top of the World",
      artist: "Imagine Dragons",
      artworkUrl: "https://picsum.photos/seed/roadtrip-5/80/80"
    },
    {
      id: "song-006",
      title: "Viva La Vida",
      artist: "Coldplay",
      artworkUrl: "https://picsum.photos/seed/roadtrip-6/80/80"
    }
  ],
  playlists: [
    {
      id: "playlist-001",
      name: "Roadtrip Bangers",
      songIds: ["song-001", "song-003", "song-004"]
    },
    {
      id: "playlist-002",
      name: "Sunset Warmup",
      songIds: ["song-002", "song-005", "song-006"]
    },
    {
      id: "playlist-003",
      name: "Arrival Energy",
      songIds: ["song-001", "song-004", "song-006"]
    },
    {
      id: "playlist-004",
      name: "Chill Segment",
      songIds: ["song-002", "song-003", "song-005"]
    }
  ]
};
