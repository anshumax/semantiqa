import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

type ModelManifestEntry = {
  id: string;
  name: string;
  kind: 'embedding' | 'generator';
  sizeMb: number;
  license: string;
  sha256: string;
  description?: string;
  tasks: string[];
};

const moduleDir = dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = join(process.cwd(), 'models', 'models.json');
const MANIFEST_FALLBACK_PATH = join(
  moduleDir,
  '..',
  '..',
  'models',
  'models.json',
);

interface ModelManifestFile {
  version: string;
  models: Array<{
    id: string;
    name: string;
    kind: string;
    size_mb: number;
    license: string;
    sha256: string;
    url: string;
  }>;
}

export async function loadModelManifest(): Promise<ModelManifestEntry[]> {
  const candidatePaths = [MANIFEST_PATH, MANIFEST_FALLBACK_PATH];
  let raw: string | null = null;

  for (const pathCandidate of candidatePaths) {
    try {
      raw = await fs.readFile(pathCandidate, 'utf-8');
      break;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  if (!raw) {
    throw new Error(
      `Model manifest not found. Looked in: ${candidatePaths.join(', ')}`,
    );
  }
  const manifest = JSON.parse(raw) as ModelManifestFile;
  return manifest.models.map((entry) => ({
    id: entry.id,
    name: entry.name,
    kind: entry.kind === 'embedding' ? 'embedding' : 'generator',
    sizeMb: entry.size_mb,
    license: entry.license,
    sha256: entry.sha256,
    tasks: entry.kind === 'embedding' ? ['embedding'] : ['summarize', 'generate'],
  })) as ModelManifestEntry[];
}


