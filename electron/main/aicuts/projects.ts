import { ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs/promises';

/**
 * Silent (no-dialog) project persistence backing autosave + the Home page
 * project hub. One JSON file per project in userData/projects/.
 *
 * The dialog-based aicuts:save-project / aicuts:open-project handlers in
 * ./index.ts remain for explicit "export project file" use.
 */

export interface ProjectFileV1 {
  version: 1;
  id: string;
  name: string;
  savedAt: string; // ISO
  tracks: unknown[];
  mediaLibrary: Array<
    { src?: string; name?: string } & Record<string, unknown>
  >;
  zoom?: number;
}

export interface ProjectMeta {
  id: string;
  name: string;
  savedAt: string;
  clipCount: number;
  mediaCount: number;
}

function projectsDir(): string {
  return path.join(app.getPath('userData'), 'projects');
}

function projectPath(id: string): string {
  // ids are uuids we generate; strip anything path-like defensively
  const safe = id.replace(/[^a-zA-Z0-9-]/g, '');
  return path.join(projectsDir(), `${safe}.json`);
}

function countClips(tracks: unknown[]): number {
  let n = 0;
  for (const t of tracks) {
    const clips = (t as { clips?: unknown[] })?.clips;
    if (Array.isArray(clips)) n += clips.length;
  }
  return n;
}

export function registerProjectHandlers(): void {
  ipcMain.handle('aicuts:project-save', async (_, project: ProjectFileV1) => {
    if (!project?.id) return { success: false, error: 'Missing project id' };
    await fs.mkdir(projectsDir(), { recursive: true });
    const data: ProjectFileV1 = {
      ...project,
      version: 1,
      savedAt: new Date().toISOString(),
    };
    const file = projectPath(project.id);
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(data, null, 2));
    await fs.rename(tmp, file);
    return { success: true, savedAt: data.savedAt };
  });

  ipcMain.handle('aicuts:project-list', async (): Promise<ProjectMeta[]> => {
    let files: string[];
    try {
      files = await fs.readdir(projectsDir());
    } catch {
      return [];
    }
    const metas: ProjectMeta[] = [];
    for (const f of files) {
      if (!f.endsWith('.json')) continue;
      try {
        const raw = await fs.readFile(path.join(projectsDir(), f), 'utf-8');
        const p = JSON.parse(raw) as ProjectFileV1;
        if (!p?.id) continue;
        metas.push({
          id: p.id,
          name: p.name || 'Untitled Project',
          savedAt: p.savedAt ?? '',
          clipCount: Array.isArray(p.tracks) ? countClips(p.tracks) : 0,
          mediaCount: Array.isArray(p.mediaLibrary) ? p.mediaLibrary.length : 0,
        });
      } catch {
        // Skip corrupt files rather than breaking the whole list.
      }
    }
    metas.sort((a, b) => (a.savedAt < b.savedAt ? 1 : -1));
    return metas;
  });

  ipcMain.handle('aicuts:project-load', async (_, id: string) => {
    try {
      const raw = await fs.readFile(projectPath(id), 'utf-8');
      const project = JSON.parse(raw) as ProjectFileV1;
      // Flag media whose source files have moved/been deleted since last save.
      const missing: string[] = [];
      for (const m of project.mediaLibrary ?? []) {
        if (typeof m.src === 'string' && m.src) {
          try {
            await fs.access(m.src);
          } catch {
            missing.push(m.src);
          }
        }
      }
      return { project, missing };
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : 'Failed to load project',
      };
    }
  });

  ipcMain.handle('aicuts:project-delete', async (_, id: string) => {
    try {
      await fs.rm(projectPath(id), { force: true });
      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Delete failed',
      };
    }
  });
}
