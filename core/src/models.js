"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.loadModelManifest = loadModelManifest;
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
const MANIFEST_PATH = (0, node_path_1.join)(process.cwd(), 'models', 'models.json');
async function loadModelManifest() {
    const raw = await node_fs_1.promises.readFile(MANIFEST_PATH, 'utf-8');
    const manifest = JSON.parse(raw);
    return manifest.models.map((entry) => ({
        id: entry.id,
        name: entry.name,
        kind: entry.kind === 'embedding' ? 'embedding' : 'generator',
        sizeMb: entry.size_mb,
        license: entry.license,
        sha256: entry.sha256,
        tasks: entry.kind === 'embedding' ? ['embedding'] : ['summarize', 'generate'],
    }));
}
//# sourceMappingURL=models.js.map