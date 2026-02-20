import { countSongMemberships, type Playlist, type Song } from "../playlistModel.js";

interface PlaylistPaneProps {
  paneIndex: number;
  paneCount: number;
  playlist: Playlist;
  playlists: Playlist[];
  membershipPlaylists: Playlist[];
  songsById: Map<string, Song>;
  selectedSong: { playlistId: string; songId: string } | null;
  dropTarget: { playlistId: string; index: number } | null;
  newPlaylistValue: string;
  importSpotifyValue: string;
  searchSpotifyValue: string;
  onUpdatePanePlaylist: (paneIndex: number, playlistId: string) => void;
  onDeleteSelectedFromPlaylist: (playlistId: string) => void;
  onOpenSpotifyExport: (paneIndex: number) => void;
  onRemovePane: (paneIndex: number) => void;
  onPaneDrop: (
    event: React.DragEvent<HTMLElement>,
    destinationPlaylistId: string,
    destinationIndex?: number
  ) => void;
  onDropSlotDragOver: (
    event: React.DragEvent<HTMLElement>,
    playlistId: string,
    destinationIndex: number
  ) => void;
  onSongCardDragOver: (
    event: React.DragEvent<HTMLElement>,
    playlistId: string,
    songIndex: number
  ) => void;
  onSongDragStart: (
    event: React.DragEvent<HTMLElement>,
    sourcePlaylistId: string,
    songId: string
  ) => void;
  onSongClick: (playlistId: string, songId: string) => void;
  onSongDragEnd: () => void;
  canLoadMore: boolean;
  loadMoreLoading: boolean;
  onLoadMore: (paneIndex: number) => Promise<void>;
}

export function PlaylistPane({
  paneIndex,
  paneCount,
  playlist,
  playlists,
  membershipPlaylists,
  songsById,
  selectedSong,
  dropTarget,
  newPlaylistValue,
  importSpotifyValue,
  searchSpotifyValue,
  onUpdatePanePlaylist,
  onDeleteSelectedFromPlaylist,
  onOpenSpotifyExport,
  onRemovePane,
  onPaneDrop,
  onDropSlotDragOver,
  onSongCardDragOver,
  onSongDragStart,
  onSongClick,
  onSongDragEnd,
  canLoadMore,
  loadMoreLoading,
  onLoadMore
}: PlaylistPaneProps) {
  return (
    <article
      className="pane"
      key={`${paneIndex}-${playlist.id}`}
      onDragOver={(event) => event.preventDefault()}
      onDrop={(event) => onPaneDrop(event, playlist.id)}
    >
      <header className="pane-header">
        <select
          value={playlist.id}
          onChange={(event) => onUpdatePanePlaylist(paneIndex, event.target.value)}
        >
          {playlists.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
            </option>
          ))}
          <option value={newPlaylistValue}>New playlist...</option>
          <option value={importSpotifyValue}>Import from Spotify...</option>
          <option value={searchSpotifyValue}>Spotify search...</option>
        </select>
        <button
          className="pane-delete"
          onClick={() => onDeleteSelectedFromPlaylist(playlist.id)}
          disabled={selectedSong?.playlistId !== playlist.id}
          title="Delete selected song from this playlist"
        >
          Delete Selected
        </button>
        <button
          className="pane-remove"
          onClick={() => onRemovePane(paneIndex)}
          disabled={paneCount <= 1}
          title="Remove pane"
        >
          Remove
        </button>
      </header>

      <ul className="song-list">
        {playlist.songIds.map((songId, songIndex) => {
          const song = songsById.get(songId);
          if (!song) {
            return null;
          }
          const membershipCount = countSongMemberships(membershipPlaylists, song.id);

          return (
            <li className="song-row" key={`${playlist.id}-${song.id}`}>
              <div
                className={`drop-slot ${
                  dropTarget?.playlistId === playlist.id && dropTarget.index === songIndex
                    ? "drop-slot-active"
                    : ""
                }`}
                onDragOver={(event) => onDropSlotDragOver(event, playlist.id, songIndex)}
                onDrop={(event) => onPaneDrop(event, playlist.id, songIndex)}
              />
              <article
                className={`song-card ${
                  selectedSong?.playlistId === playlist.id && selectedSong.songId === song.id
                    ? "song-card-selected"
                    : ""
                }`}
                draggable
                onClick={() => onSongClick(playlist.id, song.id)}
                onDragStart={(event) => onSongDragStart(event, playlist.id, song.id)}
                onDragOver={(event) => onSongCardDragOver(event, playlist.id, songIndex)}
                onDragEnd={onSongDragEnd}
              >
                <img src={song.artworkUrl} alt="" />
                <div className="song-copy">
                  <strong>{song.title}</strong>
                  <span>{song.artist}</span>
                  <small>
                    in {membershipCount} playlist
                    {membershipCount === 1 ? "" : "s"}
                  </small>
                </div>
              </article>
            </li>
          );
        })}
        <li className="song-row">
          <div
            className={`drop-slot ${
              dropTarget?.playlistId === playlist.id &&
              dropTarget.index === playlist.songIds.length
                ? "drop-slot-active"
                : ""
            }`}
            onDragOver={(event) =>
              onDropSlotDragOver(event, playlist.id, playlist.songIds.length)
            }
            onDrop={(event) => onPaneDrop(event, playlist.id, playlist.songIds.length)}
          />
        </li>
      </ul>
      <div className="pane-footer">
        {canLoadMore && (
          <button
            className="pane-export"
            onClick={() => void onLoadMore(paneIndex)}
            disabled={loadMoreLoading}
          >
            {loadMoreLoading ? "Loading..." : "Load more"}
          </button>
        )}
        <button className="pane-export" onClick={() => onOpenSpotifyExport(paneIndex)}>
          Export to Spotify...
        </button>
      </div>
    </article>
  );
}
