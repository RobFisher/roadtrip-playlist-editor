import { useMemo, useState } from "react";
import "./app.css";
import {
  applySongDropAtIndex,
  countSongMemberships,
  seedProjectData,
  type DragPayload,
  type Playlist
} from "./playlistModel.js";

const initialPanePlaylistIds = seedProjectData.playlists.slice(0, 3).map((p) => p.id);

export function App() {
  const [playlists, setPlaylists] = useState<Playlist[]>(seedProjectData.playlists);
  const [panePlaylistIds, setPanePlaylistIds] = useState<string[]>(initialPanePlaylistIds);
  const [dragModeLabel, setDragModeLabel] = useState<"copy" | "move">("copy");
  const [dropTarget, setDropTarget] = useState<{
    playlistId: string;
    index: number;
  } | null>(null);

  const songsById = useMemo(() => {
    return new Map(seedProjectData.songs.map((song) => [song.id, song]));
  }, []);

  const availableForNewPane = seedProjectData.playlists.find(
    (playlist) => !panePlaylistIds.includes(playlist.id)
  );

  function addPane(): void {
    if (!availableForNewPane) {
      return;
    }
    setPanePlaylistIds((prev) => [...prev, availableForNewPane.id]);
  }

  function removePane(index: number): void {
    setPanePlaylistIds((prev) => prev.filter((_, paneIndex) => paneIndex !== index));
  }

  function updatePanePlaylist(index: number, playlistId: string): void {
    setPanePlaylistIds((prev) =>
      prev.map((currentId, paneIndex) =>
        paneIndex === index ? playlistId : currentId
      )
    );
  }

  function onSongDragStart(
    event: React.DragEvent<HTMLElement>,
    sourcePlaylistId: string,
    songId: string
  ): void {
    const mode: DragPayload["mode"] = event.shiftKey ? "move" : "copy";
    setDragModeLabel(mode);

    const payload: DragPayload = { songId, sourcePlaylistId, mode };
    event.dataTransfer.setData("application/json", JSON.stringify(payload));
    event.dataTransfer.effectAllowed = "copyMove";
  }

  function onPaneDrop(
    event: React.DragEvent<HTMLElement>,
    destinationPlaylistId: string,
    destinationIndex: number
  ): void {
    event.preventDefault();
    const payloadRaw = event.dataTransfer.getData("application/json");
    if (!payloadRaw) {
      return;
    }

    const payload = JSON.parse(payloadRaw) as DragPayload;
    setPlaylists((prev) =>
      applySongDropAtIndex(prev, payload, destinationPlaylistId, destinationIndex)
    );
    setDropTarget(null);
  }

  function onDropSlotDragOver(
    event: React.DragEvent<HTMLElement>,
    playlistId: string,
    destinationIndex: number
  ): void {
    event.preventDefault();
    setDropTarget({ playlistId, index: destinationIndex });
  }

  return (
    <main className="workspace">
      <header className="workspace-header">
        <div>
          <p className="eyebrow">Milestone 2 UI Concept</p>
          <h1>Roadtrip Playlist Pane Editor</h1>
          <p className="subtitle">
            Drag songs between playlist panes. Default: copy. Hold Shift while dragging
            to move.
          </p>
        </div>
        <div className="workspace-actions">
          <button onClick={addPane} disabled={!availableForNewPane}>
            Add Pane
          </button>
          <span className="drag-mode-indicator">Current drag mode: {dragModeLabel}</span>
        </div>
      </header>

      <section className="pane-grid">
        {panePlaylistIds.map((panePlaylistId, paneIndex) => {
          const playlist = playlists.find((item) => item.id === panePlaylistId);
          if (!playlist) {
            return null;
          }

          return (
            <article className="pane" key={`${paneIndex}-${panePlaylistId}`}>
              <header className="pane-header">
                <select
                  value={playlist.id}
                  onChange={(event) => updatePanePlaylist(paneIndex, event.target.value)}
                >
                  {seedProjectData.playlists.map((option) => (
                    <option key={option.id} value={option.id}>
                      {option.name}
                    </option>
                  ))}
                </select>
                <button
                  className="pane-remove"
                  onClick={() => removePane(paneIndex)}
                  disabled={panePlaylistIds.length <= 1}
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
                  const membershipCount = countSongMemberships(playlists, song.id);

                  return (
                    <li className="song-row" key={`${playlist.id}-${song.id}`}>
                      <div
                        className={`drop-slot ${
                          dropTarget?.playlistId === playlist.id &&
                          dropTarget.index === songIndex
                            ? "drop-slot-active"
                            : ""
                        }`}
                        onDragOver={(event) =>
                          onDropSlotDragOver(event, playlist.id, songIndex)
                        }
                        onDrop={(event) => onPaneDrop(event, playlist.id, songIndex)}
                      />
                      <article
                        className="song-card"
                        draggable
                        onDragStart={(event) =>
                          onSongDragStart(event, playlist.id, song.id)
                        }
                        onDragEnd={() => setDropTarget(null)}
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
                    onDrop={(event) =>
                      onPaneDrop(event, playlist.id, playlist.songIds.length)
                    }
                  />
                </li>
              </ul>
            </article>
          );
        })}
      </section>
    </main>
  );
}
