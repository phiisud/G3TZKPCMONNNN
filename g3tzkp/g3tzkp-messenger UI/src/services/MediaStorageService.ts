const MESSAGING_SERVER = '';

export interface MediaMetadata {
  id: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  size: number;
  senderId: string;
  uploadedAt: number;
}

export interface UploadResult {
  success: boolean;
  fileId: string;
  url: string;
  metadata: MediaMetadata;
}

export interface TensorObjectData {
  objectUrl: string;
  dimensions: { width: number; height: number; depth: number };
  vertices: number;
  tensorField?: {
    pixelCount: number;
    resolution: number;
    phiValue: number;
    piValue: number;
  };
  flowerOfLife?: {
    generations: number;
    rayCount: number;
    sacredGeometryScale: number;
  };
  originalFiles: {
    fileId: string;
    fileName: string;
    url: string;
    mimeType: string;
    size: number;
  }[];
}

const DOCUMENT_MIME_TYPES: Record<string, string> = {
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  '.doc': 'application/msword',
  '.odt': 'application/vnd.oasis.opendocument.text',
  '.rtf': 'application/rtf',
  '.pages': 'application/x-iwork-pages-sffpages',
  '.wpd': 'application/vnd.wordperfect',
  '.wp5': 'application/vnd.wordperfect',
  '.wps': 'application/vnd.ms-works',
  '.gdoc': 'application/vnd.google-apps.document',
  '.txt': 'text/plain',
  '.md': 'text/markdown',
  '.log': 'text/plain',
  '.csv': 'text/csv',
  '.asc': 'text/plain',
  '.tex': 'application/x-tex',
  '.ini': 'text/plain',
  '.cfg': 'text/plain',
  '.pdf': 'application/pdf',
  '.epub': 'application/epub+zip',
  '.ps': 'application/postscript',
  '.xps': 'application/vnd.ms-xpsdocument',
  '.eml': 'message/rfc822',
  '.emlx': 'message/rfc822',
  '.msg': 'application/vnd.ms-outlook',
  '.html': 'text/html',
  '.htm': 'text/html',
  '.xml': 'application/xml',
  '.json': 'application/json',
  '.c': 'text/x-csrc',
  '.cpp': 'text/x-c++src',
  '.h': 'text/x-c++src',
  '.java': 'text/x-java',
  '.class': 'application/java-vm',
  '.py': 'text/x-python',
  '.js': 'text/javascript',
  '.ts': 'text/typescript',
  '.jsx': 'text/javascript',
  '.tsx': 'text/typescript',
  '.sh': 'application/x-sh',
  '.bat': 'application/x-bat',
  '.ipynb': 'application/x-ipynb+json',
  '.css': 'text/css',
  '.yaml': 'text/yaml',
  '.yml': 'text/yaml',
  '.circom': 'application/x-circom',
  '.asm': 'text/x-asm',
  '.rs': 'text/x-rust',
  '.go': 'text/x-go',
};

class MediaStorageService {
  private static instance: MediaStorageService;
  
  static getInstance(): MediaStorageService {
    if (!this.instance) {
      this.instance = new MediaStorageService();
    }
    return this.instance;
  }

  async uploadFile(file: File, senderId: string): Promise<UploadResult> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          
          const response = await fetch(`${MESSAGING_SERVER}/api/media/upload`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              data: base64Data,
              filename: file.name,
              mimeType: file.type || this.getMimeType(file.name),
              senderId
            })
          });
          
          if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error || 'Upload failed');
          }
          
          const result = await response.json();
          resolve({
            success: true,
            fileId: result.fileId,
            url: `${MESSAGING_SERVER}${result.url}`,
            metadata: result.metadata
          });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  }

  async uploadMultipleFiles(files: File[], senderId: string): Promise<UploadResult[]> {
    const results: UploadResult[] = [];
    
    for (const file of files) {
      try {
        const result = await this.uploadFile(file, senderId);
        results.push(result);
      } catch (error) {
        console.error(`Failed to upload ${file.name}:`, error);
      }
    }
    
    return results;
  }

  getMediaUrl(storedName: string): string {
    return `${MESSAGING_SERVER}/media/${storedName}`;
  }

  getDownloadUrl(fileId: string): string {
    return `${MESSAGING_SERVER}/api/media/${fileId}`;
  }

  async getFileInfo(fileId: string): Promise<MediaMetadata | null> {
    try {
      const response = await fetch(`${MESSAGING_SERVER}/api/media/${fileId}/info`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  }

  getMimeType(filename: string): string {
    const ext = '.' + filename.split('.').pop()?.toLowerCase();
    return DOCUMENT_MIME_TYPES[ext] || 'application/octet-stream';
  }

  isImage(mimeType: string): boolean {
    return mimeType.startsWith('image/');
  }

  isVideo(mimeType: string): boolean {
    return mimeType.startsWith('video/');
  }

  isDocument(mimeType: string): boolean {
    return mimeType.startsWith('text/') || 
           mimeType.startsWith('application/vnd.openxmlformats') ||
           mimeType.startsWith('application/vnd.oasis.opendocument') ||
           mimeType === 'application/pdf' ||
           mimeType === 'application/json' ||
           mimeType === 'application/msword' ||
           mimeType === 'application/rtf' ||
           mimeType === 'application/epub+zip' ||
           mimeType === 'application/postscript' ||
           mimeType === 'application/xml' ||
           mimeType === 'application/x-circom' ||
           mimeType === 'application/x-ipynb+json' ||
           mimeType === 'message/rfc822';
  }

  getFileTypeCategory(mimeType: string): 'image' | 'video' | 'document' | 'unknown' {
    if (this.isImage(mimeType)) return 'image';
    if (this.isVideo(mimeType)) return 'video';
    if (this.isDocument(mimeType)) return 'document';
    return 'unknown';
  }
}

export const mediaStorageService = MediaStorageService.getInstance();
export default mediaStorageService;
