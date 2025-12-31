import { AppDeployment, DeployOptions } from '@/types/g3tzkp-web';
import { g3tzkpWebService } from './G3TZKPWebService';

interface FileEntry {
  path: string;
  content: string;
}

class G3TZKPWebDeployer {
  async deployFromFiles(files: FileEntry[], options: DeployOptions): Promise<AppDeployment> {
    const fileMap = new Map<string, string>();
    
    for (const file of files) {
      fileMap.set(file.path, file.content);
    }

    if (!fileMap.has('index.html') && !Array.from(fileMap.keys()).some(k => k.endsWith('.html'))) {
      throw new Error('Deployment must include at least one HTML file (preferably index.html)');
    }

    return g3tzkpWebService.deploy(fileMap, options);
  }

  async deployFromDirectory(directory: FileList | File[], options: DeployOptions): Promise<AppDeployment> {
    const files: FileEntry[] = [];

    for (let i = 0; i < directory.length; i++) {
      const file = directory instanceof FileList ? directory[i] : directory[i];
      const content = await this.readFileAsText(file);
      const path = (file as any).webkitRelativePath || file.name;
      
      files.push({ path: this.normalizePath(path), content });
    }

    return this.deployFromFiles(files, options);
  }

  async deploySimpleApp(html: string, css: string, js: string, options: DeployOptions): Promise<AppDeployment> {
    const files: FileEntry[] = [
      { path: 'index.html', content: html },
      { path: 'style.css', content: css },
      { path: 'app.js', content: js }
    ];

    return this.deployFromFiles(files, options);
  }

  async deployReactApp(buildDir: FileList | File[], options: DeployOptions): Promise<AppDeployment> {
    return this.deployFromDirectory(buildDir, options);
  }

  private readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  private normalizePath(path: string): string {
    let normalized = path.replace(/\\/g, '/');
    
    const parts = normalized.split('/');
    if (parts.length > 1 && parts[0].length > 0) {
      normalized = parts.slice(1).join('/');
    }

    if (normalized.startsWith('/')) {
      normalized = normalized.substring(1);
    }

    return normalized || 'index.html';
  }

  createDeploymentPackage(files: FileEntry[], options: DeployOptions): Blob {
    const packageData = {
      files,
      options,
      version: '1.0.0',
      createdAt: Date.now()
    };

    return new Blob([JSON.stringify(packageData, null, 2)], { type: 'application/json' });
  }

  async deployFromPackage(packageBlob: Blob, options?: Partial<DeployOptions>): Promise<AppDeployment> {
    const text = await packageBlob.text();
    const packageData = JSON.parse(text);

    const mergedOptions = {
      ...packageData.options,
      ...options
    };

    return this.deployFromFiles(packageData.files, mergedOptions);
  }

  async getDeploymentInfo(appId: string): Promise<{ deployed: boolean; manifest?: any }> {
    const manifest = g3tzkpWebService.getDeployedApp(appId);
    
    if (manifest) {
      return {
        deployed: true,
        manifest
      };
    }

    return { deployed: false };
  }

  getAllDeployments(): any[] {
    return g3tzkpWebService.getAllDeployedApps();
  }
}

export const g3tzkpWebDeployer = new G3TZKPWebDeployer();
