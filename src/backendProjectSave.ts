export interface LoadedBackendProjectContext {
  projectId: string;
  ownerUserId: string;
  name: string;
  version: number;
}

function normalizeProjectName(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

export function shouldUpdateLoadedBackendProject(
  loadedBackendProject: LoadedBackendProjectContext | null,
  currentUserId: string | null,
  nextProjectName: string
): boolean {
  if (!loadedBackendProject || !currentUserId) {
    return false;
  }
  if (loadedBackendProject.ownerUserId !== currentUserId) {
    return false;
  }
  return normalizeProjectName(loadedBackendProject.name) === normalizeProjectName(nextProjectName);
}
