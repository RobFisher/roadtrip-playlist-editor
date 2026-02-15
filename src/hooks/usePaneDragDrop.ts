import { useRef, useState } from "react";
import { applySongDropAtIndex, type DragPayload, type Playlist } from "../playlistModel.js";

const DRAG_MIME = "application/x-roadtrip-song";

interface UsePaneDragDropArgs {
  playlists: Playlist[];
  setPlaylists: React.Dispatch<React.SetStateAction<Playlist[]>>;
}

interface UsePaneDragDropResult {
  dragModeLabel: "copy" | "move";
  dropTarget: { playlistId: string; index: number } | null;
  setDropTarget: React.Dispatch<
    React.SetStateAction<{ playlistId: string; index: number } | null>
  >;
  onSongDragStart: (
    event: React.DragEvent<HTMLElement>,
    sourcePlaylistId: string,
    songId: string
  ) => void;
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
  onSongDragEnd: () => void;
}

export function usePaneDragDrop({
  playlists,
  setPlaylists
}: UsePaneDragDropArgs): UsePaneDragDropResult {
  const [dragModeLabel, setDragModeLabel] = useState<"copy" | "move">("copy");
  const [dropTarget, setDropTarget] = useState<{
    playlistId: string;
    index: number;
  } | null>(null);
  const dragPayloadRef = useRef<DragPayload | null>(null);

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
      applySongDropAtIndex(prev, payload as DragPayload, destinationPlaylistId, resolvedIndex)
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

  function onSongDragEnd(): void {
    setDropTarget(null);
    dragPayloadRef.current = null;
  }

  return {
    dragModeLabel,
    dropTarget,
    setDropTarget,
    onSongDragStart,
    onPaneDrop,
    onDropSlotDragOver,
    onSongCardDragOver,
    onSongDragEnd
  };
}
