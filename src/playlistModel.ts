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
  const destinationPlaylist = playlists.find(
    (playlist) => playlist.id === destinationPlaylistId
  );
  const destinationIndex = destinationPlaylist
    ? destinationPlaylist.songIds.length
    : 0;

  return applySongDropAtIndex(
    playlists,
    payload,
    destinationPlaylistId,
    destinationIndex
  );
}

export function applySongDropAtIndex(
  playlists: Playlist[],
  payload: DragPayload,
  destinationPlaylistId: string,
  destinationIndex: number
): Playlist[] {
  const sourcePlaylist = playlists.find(
    (playlist) => playlist.id === payload.sourcePlaylistId
  );
  const destinationPlaylist = playlists.find(
    (playlist) => playlist.id === destinationPlaylistId
  );

  if (!sourcePlaylist || !destinationPlaylist) {
    return playlists;
  }

  const sourceIndex = sourcePlaylist.songIds.indexOf(payload.songId);
  if (sourceIndex < 0) {
    return playlists;
  }

  const samePlaylist = payload.sourcePlaylistId === destinationPlaylistId;
  const destinationHasSong = destinationPlaylist.songIds.includes(payload.songId);

  if (samePlaylist) {
    if (payload.mode === "copy") {
      return playlists;
    }

    const reordered = [...sourcePlaylist.songIds];
    reordered.splice(sourceIndex, 1);
    const boundedIndex = Math.max(0, Math.min(destinationIndex, reordered.length));
    reordered.splice(boundedIndex, 0, payload.songId);

    return playlists.map((playlist) =>
      playlist.id === sourcePlaylist.id
        ? {
            ...playlist,
            songIds: reordered
          }
        : playlist
    );
  }

  let destinationSongs = [...destinationPlaylist.songIds];
  if (!destinationHasSong) {
    const boundedIndex = Math.max(
      0,
      Math.min(destinationIndex, destinationSongs.length)
    );
    destinationSongs.splice(boundedIndex, 0, payload.songId);
  }

  const shouldRemoveFromSource = payload.mode === "move";
  const sourceSongs = shouldRemoveFromSource
    ? sourcePlaylist.songIds.filter((songId) => songId !== payload.songId)
    : sourcePlaylist.songIds;

  return playlists.map((playlist) => {
    if (playlist.id === sourcePlaylist.id) {
      return {
        ...playlist,
        songIds: sourceSongs
      };
    }

    if (playlist.id === destinationPlaylist.id) {
      return {
        ...playlist,
        songIds: destinationSongs
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
