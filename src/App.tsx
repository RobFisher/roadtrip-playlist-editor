import { useMemo, useRef, useState } from "react";
import "./app.css";
import {
  applySongDropAtIndex,
  countSongMemberships,
  seedProjectData,
  type DragPayload,
  type Playlist
} from "./playlistModel.js";

const initialPanePlaylistIds = seedProjectData.playlists.slice(0, 3).map((p) => p.id);
const DRAG_MIME = "application/x-roadtrip-song";

export function App() {
  const [playlists, setPlaylists] = useState<Playlist[]>(seedProjectData.playlists);
  const [panePlaylistIds, setPanePlaylistIds] = useState<string[]>(initialPanePlaylistIds);
  const [dragModeLabel, setDragModeLabel] = useState<"copy" | "move">("copy");
  const dragPayloadRef = useRef<DragPayload | null>(null);
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
    dragPayloadRef.current = payload;
    const payloadText = JSON.stringify(payload);
    event.dataTransfer.setData(DRAG_MIME, payloadText);
    event.dataTransfer.setData("text/plain", payloadText);
    event.dataTransfer.effectAllowed = "copyMove";
  }

  function onPaneDrop(
    event: React.DragEvent<HTMLElement>,
    destinationPlaylistId: string,
    destinationIndex?: number
  ): void {
    event.preventDefault();
    const payloadRaw =
      event.dataTransfer.getData(DRAG_MIME) ||
      event.dataTransfer.getData("text/plain");
    let payload: DragPayload | null = null;

    if (payloadRaw) {
      try {
        payload = JSON.parse(payloadRaw) as DragPayload;
      } catch {
        payload = null;
      }
    }

    if (!payload) {
      payload = dragPayloadRef.current;
    }

    if (!payload) {
      return;
    }

    const resolvedIndex =
      destinationIndex ??
      (dropTarget?.playlistId === destinationPlaylistId
        ? dropTarget.index
        : playlists.find((playlist) => playlist.id === destinationPlaylistId)?.songIds
            .length ?? 0);

    setPlaylists((prev) =>
      applySongDropAtIndex(prev, payload, destinationPlaylistId, resolvedIndex)
    );
    setDropTarget(null);
    dragPayloadRef.current = null;
  }

  function onDropSlotDragOver(
    event: React.DragEvent<HTMLElement>,
    playlistId: string,
    destinationIndex: number
  ): void {
    event.preventDefault();
    setDropTarget({ playlistId, index: destinationIndex });
  }

  function onSongCardDragOver(
    event: React.DragEvent<HTMLElement>,
    playlistId: string,
    songIndex: number
  ): void {
    event.preventDefault();
    const bounds = event.currentTarget.getBoundingClientRect();
    const isLowerHalf = event.clientY > bounds.top + bounds.height / 2;
    setDropTarget({ playlistId, index: isLowerHalf ? songIndex + 1 : songIndex });
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
            <article
              className="pane"
              key={`${paneIndex}-${panePlaylistId}`}
              onDragOver={(event) => event.preventDefault()}
              onDrop={(event) => onPaneDrop(event, playlist.id)}
            >
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
                        onDragOver={(event) =>
                          onSongCardDragOver(event, playlist.id, songIndex)
                        }
                        onDragEnd={() => {
                          setDropTarget(null);
                          dragPayloadRef.current = null;
                        }}
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
