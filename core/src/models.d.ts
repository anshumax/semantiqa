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
export declare function loadModelManifest(): Promise<ModelManifestEntry[]>;
export {};
//# sourceMappingURL=models.d.ts.map