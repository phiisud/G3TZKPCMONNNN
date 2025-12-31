import { AppManifest, AppFile, AppLoadState, LoadProgress, LoadProgressCallback } from '@/types/g3tzkp-web';
import { g3tzkpWebService } from './G3TZKPWebService';
import { g3tzkpWebCache } from './G3TZKPWebCache';
import { g3tzkpWebManifest } from './G3TZKPWebManifest';
import { nameRegistryService } from '../NameRegistryService';

interface RouteMatch {
  appId: string;
  name?: string;
  path: string;
  params: URLSearchParams;
}

class G3TZKPWebRouter {
  private loadProgressCallbacks: Map<string, Set<LoadProgressCallback>> = new Map();

  parseUrl(url: string): RouteMatch | null {
    if (!url.startsWith('g3tzkp://')) {
      return null;
    }

    const urlWithoutProtocol = url.substring('g3tzkp://'.length);
    const [appIdAndPath, queryString] = urlWithoutProtocol.split('?');
    const [rawAppId, ...pathParts] = appIdAndPath.split('/');
    const path = '/' + pathParts.join('/');
    const params = new URLSearchParams(queryString || '');

    let appId = rawAppId;
    let name: string | undefined;

    if (rawAppId.length <= 9 && !rawAppId.startsWith('G3-')) {
      const parsed = nameRegistryService.parseUrl(`g3tzkp://${rawAppId}`);
      if (parsed?.peerId) {
        appId = parsed.peerId;
        name = parsed.name;
      } else {
        name = rawAppId.toUpperCase();
      }
    } else {
      const resolvedName = nameRegistryService.lookupHash(rawAppId);
      if (resolvedName) {
        name = resolvedName;
      }
    }

    return { appId, name, path, params };
  }

  formatUrl(appId: string): string {
    const name = nameRegistryService.getDisplayName(appId);
    if (name) {
      return `g3tzkp://${name}`;
    }
    return `g3tzkp://${appId}`;
  }

  async loadApp(url: string, containerElement: HTMLElement): Promise<void> {
    const route = this.parseUrl(url);
    if (!route) {
      throw new Error('Invalid G3TZKP URL');
    }

    this.notifyProgress(route.appId, {
      state: AppLoadState.CHECKING_CACHE,
      progress: 0,
      message: 'Checking cache...'
    });

    const cachedApp = await g3tzkpWebCache.getCachedApp(route.appId);
    
    if (cachedApp) {
      this.notifyProgress(route.appId, {
        state: AppLoadState.READY,
        progress: 100,
        message: 'Loading from cache...'
      });
      await this.renderApp(cachedApp.manifest, containerElement, route);
      return;
    }

    this.notifyProgress(route.appId, {
      state: AppLoadState.DISCOVERING_PEERS,
      progress: 10,
      message: 'Finding peers...'
    });

    const manifest = await g3tzkpWebService.requestManifest(route.appId);
    
    if (!manifest) {
      this.notifyProgress(route.appId, {
        state: AppLoadState.ERROR,
        progress: 0,
        message: 'App not found on network'
      });
      throw new Error('App not found on network');
    }

    this.notifyProgress(route.appId, {
      state: AppLoadState.DOWNLOADING,
      progress: 20,
      message: 'Downloading files...'
    });

    await this.downloadAppFiles(manifest);

    this.notifyProgress(route.appId, {
      state: AppLoadState.VERIFYING,
      progress: 90,
      message: 'Verifying integrity...'
    });

    const isValid = await g3tzkpWebManifest.verifyManifest(manifest);
    if (!isValid) {
      this.notifyProgress(route.appId, {
        state: AppLoadState.ERROR,
        progress: 0,
        message: 'Manifest verification failed'
      });
      throw new Error('Manifest verification failed');
    }

    await g3tzkpWebCache.cacheApp(manifest);

    this.notifyProgress(route.appId, {
      state: AppLoadState.READY,
      progress: 100,
      message: 'Ready'
    });

    await this.renderApp(manifest, containerElement, route);
  }

  private async downloadAppFiles(manifest: AppManifest): Promise<void> {
    const totalFiles = manifest.files.length;
    let downloadedFiles = 0;

    for (const file of manifest.files) {
      if (file.content) {
        downloadedFiles++;
        const progress = 20 + (downloadedFiles / totalFiles) * 70;
        this.notifyProgress(manifest.appId, {
          state: AppLoadState.DOWNLOADING,
          progress,
          message: `Downloading ${file.path}...`
        });
        continue;
      }

      if (file.chunks) {
        for (const chunk of file.chunks) {
          const chunkData = await g3tzkpWebService.requestChunk(manifest.appId, chunk.hash);
          
          if (!chunkData) {
            throw new Error(`Failed to download chunk ${chunk.hash}`);
          }

          const isValid = await g3tzkpWebCache.verifyChunk(chunkData, chunk.hash);
          if (!isValid) {
            throw new Error(`Chunk verification failed: ${chunk.hash}`);
          }

          await g3tzkpWebCache.cacheChunk(chunk.hash, chunkData, manifest.appId);
        }
      }

      downloadedFiles++;
      const progress = 20 + (downloadedFiles / totalFiles) * 70;
      this.notifyProgress(manifest.appId, {
        state: AppLoadState.DOWNLOADING,
        progress,
        message: `Downloading ${file.path}...`
      });
    }
  }

  private async renderApp(manifest: AppManifest, containerElement: HTMLElement, route: RouteMatch): Promise<void> {
    const entryFile = manifest.files.find(f => f.path === manifest.entryPoint);
    if (!entryFile) {
      throw new Error(`Entry point ${manifest.entryPoint} not found`);
    }

    let html = entryFile.content || '';

    if (!html && entryFile.chunks) {
      const chunks: ArrayBuffer[] = [];
      for (const chunkInfo of entryFile.chunks) {
        const chunkData = await g3tzkpWebCache.getCachedChunk(chunkInfo.hash);
        if (!chunkData) {
          throw new Error(`Chunk ${chunkInfo.hash} not in cache`);
        }
        chunks.push(chunkData);
      }
      
      const totalSize = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
      const combined = new Uint8Array(totalSize);
      let offset = 0;
      for (const chunk of chunks) {
        combined.set(new Uint8Array(chunk), offset);
        offset += chunk.byteLength;
      }
      
      const decoder = new TextDecoder();
      html = decoder.decode(combined);
    }

    html = await this.processHtmlReferences(html, manifest);

    const iframe = document.createElement('iframe');
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = 'none';
    iframe.sandbox.add('allow-scripts');
    iframe.sandbox.add('allow-same-origin');

    if (manifest.permissions.network) {
      iframe.sandbox.add('allow-forms');
    }

    containerElement.innerHTML = '';
    containerElement.appendChild(iframe);

    if (iframe.contentWindow) {
      iframe.contentWindow.document.open();
      iframe.contentWindow.document.write(html);
      iframe.contentWindow.document.close();

      (iframe.contentWindow as any).g3tzkpWebAPI = {
        appId: manifest.appId,
        getState: (key: string) => g3tzkpWebService.getState(manifest.appId, key),
        setState: (key: string, value: any) => g3tzkpWebService.updateState(manifest.appId, key, value),
        onStateUpdate: (callback: (key: string, value: any) => void) => {
          return g3tzkpWebService.onMessage((message) => {
            if (message.type === 'APP_STATE_UPDATE' && message.appId === manifest.appId) {
              callback((message as any).stateKey, (message as any).stateData);
            }
          });
        }
      };
    }
  }

  private async processHtmlReferences(html: string, manifest: AppManifest): Promise<string> {
    const linkRegex = /<link[^>]+href=["']([^"']+)["'][^>]*>/g;
    const scriptRegex = /<script[^>]+src=["']([^"']+)["'][^>]*><\/script>/g;
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/g;

    let processedHtml = html;

    const replacements: Array<{ original: string; replacement: string }> = [];

    let match;
    while ((match = linkRegex.exec(html)) !== null) {
      const href = match[1];
      if (!href.startsWith('http') && !href.startsWith('data:')) {
        const file = manifest.files.find(f => f.path === href || f.path === `/${href}`);
        if (file?.content) {
          const dataUrl = `data:${file.mimeType};base64,${btoa(file.content)}`;
          replacements.push({ original: match[0], replacement: match[0].replace(href, dataUrl) });
        }
      }
    }

    while ((match = scriptRegex.exec(html)) !== null) {
      const src = match[1];
      if (!src.startsWith('http') && !src.startsWith('data:')) {
        const file = manifest.files.find(f => f.path === src || f.path === `/${src}`);
        if (file?.content) {
          const scriptTag = `<script>${file.content}</script>`;
          replacements.push({ original: match[0], replacement: scriptTag });
        }
      }
    }

    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      if (!src.startsWith('http') && !src.startsWith('data:')) {
        const file = manifest.files.find(f => f.path === src || f.path === `/${src}`);
        if (file?.content && file.mimeType.startsWith('image/')) {
          const dataUrl = `data:${file.mimeType};base64,${btoa(file.content)}`;
          replacements.push({ original: match[0], replacement: match[0].replace(src, dataUrl) });
        }
      }
    }

    for (const { original, replacement } of replacements) {
      processedHtml = processedHtml.replace(original, replacement);
    }

    return processedHtml;
  }

  onLoadProgress(appId: string, callback: LoadProgressCallback): () => void {
    if (!this.loadProgressCallbacks.has(appId)) {
      this.loadProgressCallbacks.set(appId, new Set());
    }
    
    this.loadProgressCallbacks.get(appId)!.add(callback);
    
    return () => {
      this.loadProgressCallbacks.get(appId)?.delete(callback);
    };
  }

  private notifyProgress(appId: string, progress: LoadProgress): void {
    const callbacks = this.loadProgressCallbacks.get(appId);
    if (callbacks) {
      callbacks.forEach(callback => callback(progress));
    }
  }
}

export const g3tzkpWebRouter = new G3TZKPWebRouter();
