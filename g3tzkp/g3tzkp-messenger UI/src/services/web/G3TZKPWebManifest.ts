import { AppManifest, AppFile, AppPermissions, DeployOptions, ChunkInfo } from '@/types/g3tzkp-web';
import { g3tzkpWebCache } from './G3TZKPWebCache';

const DEFAULT_PERMISSIONS: AppPermissions = {
  network: false,
  storage: true,
  camera: false,
  microphone: false,
  location: false,
  notifications: false
};

const MIME_TYPES: Record<string, string> = {
  'html': 'text/html',
  'css': 'text/css',
  'js': 'application/javascript',
  'json': 'application/json',
  'png': 'image/png',
  'jpg': 'image/jpeg',
  'jpeg': 'image/jpeg',
  'gif': 'image/gif',
  'svg': 'image/svg+xml',
  'woff': 'font/woff',
  'woff2': 'font/woff2',
  'ttf': 'font/ttf',
  'ico': 'image/x-icon'
};

class G3TZKPWebManifest {
  async createManifest(
    appId: string,
    files: Map<string, string>,
    options: DeployOptions,
    deployerId: string
  ): Promise<AppManifest> {
    const appFiles: AppFile[] = [];

    for (const [path, content] of files.entries()) {
      const file = await this.createAppFile(path, content, appId);
      appFiles.push(file);
    }

    const manifest: AppManifest = {
      appId,
      version: options.version || '1.0.0',
      name: options.name,
      description: options.description || '',
      author: options.author || deployerId,
      entryPoint: this.findEntryPoint(appFiles),
      files: appFiles,
      dependencies: [],
      permissions: { ...DEFAULT_PERMISSIONS, ...options.permissions },
      cacheStrategy: options.cacheStrategy || 'moderate',
      cacheDuration: options.cacheDuration || 24 * 60 * 60 * 1000,
      deployedAt: Date.now(),
      deployedBy: deployerId,
      manifestHash: '',
      signature: ''
    };

    manifest.manifestHash = await this.hashManifest(manifest);
    manifest.signature = await this.signManifest(manifest);

    return manifest;
  }

  async createAppFile(path: string, content: string, appId: string): Promise<AppFile> {
    const encoder = new TextEncoder();
    const contentBytes = encoder.encode(content);
    const hash = await g3tzkpWebCache.hash(contentBytes.buffer);

    const file: AppFile = {
      path,
      size: contentBytes.byteLength,
      mimeType: this.getMimeType(path),
      hash,
      content: contentBytes.byteLength < 256 * 1024 ? content : undefined
    };

    if (contentBytes.byteLength >= 256 * 1024) {
      file.chunks = g3tzkpWebCache.splitIntoChunks(contentBytes.buffer);
      
      for (const chunk of file.chunks) {
        const chunkStart = chunk.index * 256 * 1024;
        const chunkEnd = chunkStart + chunk.size;
        const chunkData = contentBytes.buffer.slice(chunkStart, chunkEnd);
        await g3tzkpWebCache.cacheChunk(chunk.hash, chunkData, appId);
      }
    }

    return file;
  }

  private findEntryPoint(files: AppFile[]): string {
    const indexHtml = files.find(f => f.path === 'index.html' || f.path === '/index.html');
    if (indexHtml) return indexHtml.path;

    const htmlFile = files.find(f => f.path.endsWith('.html'));
    if (htmlFile) return htmlFile.path;

    throw new Error('No HTML entry point found. App must have an index.html file.');
  }

  private getMimeType(path: string): string {
    const ext = path.split('.').pop()?.toLowerCase() || '';
    return MIME_TYPES[ext] || 'application/octet-stream';
  }

  async hashManifest(manifest: AppManifest): Promise<string> {
    const manifestCopy = { ...manifest, manifestHash: '', signature: '' };
    const manifestJson = JSON.stringify(manifestCopy, Object.keys(manifestCopy).sort());
    const encoder = new TextEncoder();
    const data = encoder.encode(manifestJson);
    return g3tzkpWebCache.hash(data.buffer);
  }

  async signManifest(manifest: AppManifest): Promise<string> {
    const hash = manifest.manifestHash || await this.hashManifest(manifest);
    return `sig_${hash.substring(0, 32)}`;
  }

  async verifyManifest(manifest: AppManifest): Promise<boolean> {
    const expectedHash = await this.hashManifest(manifest);
    return expectedHash === manifest.manifestHash;
  }

  async verifySignature(manifest: AppManifest): Promise<boolean> {
    const expectedSig = await this.signManifest(manifest);
    return expectedSig === manifest.signature;
  }

  async verifyFile(file: AppFile, content: ArrayBuffer): Promise<boolean> {
    const actualHash = await g3tzkpWebCache.hash(content);
    return actualHash === file.hash;
  }

  serializeManifest(manifest: AppManifest): string {
    return JSON.stringify(manifest, null, 2);
  }

  deserializeManifest(json: string): AppManifest {
    return JSON.parse(json) as AppManifest;
  }

  getManifestSize(manifest: AppManifest): number {
    return manifest.files.reduce((sum, file) => sum + file.size, 0);
  }

  getManifestStats(manifest: AppManifest): {
    totalFiles: number;
    totalSize: number;
    totalChunks: number;
    largestFile: AppFile | null;
  } {
    let totalChunks = 0;
    let largestFile: AppFile | null = null;

    for (const file of manifest.files) {
      if (file.chunks) {
        totalChunks += file.chunks.length;
      }
      if (!largestFile || file.size > largestFile.size) {
        largestFile = file;
      }
    }

    return {
      totalFiles: manifest.files.length,
      totalSize: this.getManifestSize(manifest),
      totalChunks,
      largestFile
    };
  }
}

export const g3tzkpWebManifest = new G3TZKPWebManifest();
