import { promises as fs } from 'node:fs';
import { join } from 'node:path';

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

const MANIFEST_PATH = join(process.cwd(), 'models', 'models.json');

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
  const raw = await fs.readFile(MANIFEST_PATH, 'utf-8');
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


