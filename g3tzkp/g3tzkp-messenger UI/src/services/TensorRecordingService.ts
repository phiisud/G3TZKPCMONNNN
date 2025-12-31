import { g3tzkpService } from './G3TZKPService';
import * as localforage from 'localforage';

export interface TensorRecording {
  id: string;
  filename: string;
  blob: Blob;
  timestamp: number;
  duration: number;
  manifoldType: string;
  size: number;
  mimeType: string;
  recipientPeerId?: string;
  status: 'local' | 'sending' | 'sent' | 'failed';
}

class TensorRecordingService {
  private static instance: TensorRecordingService;
  private recordings = new Map<string, TensorRecording>();
  private uploadProgress = new Map<string, number>();
  private chunkSize = 64 * 1024;

  static getInstance(): TensorRecordingService {
    if (!this.instance) {
      this.instance = new TensorRecordingService();
    }
    return this.instance;
  }

  async saveRecordingLocally(blob: Blob, filename: string, manifoldType: string): Promise<TensorRecording> {
    const id = `tensor_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const recording: TensorRecording = {
      id,
      filename,
      blob,
      timestamp: Date.now(),
      duration: 0,
      manifoldType,
      size: blob.size,
      mimeType: blob.type,
      status: 'local'
    };

    this.recordings.set(id, recording);

    try {
      const db = localforage.createInstance({
        name: 'G3ZKP',
        storeName: 'TensorRecordings'
      });
      
      await db.setItem(id, {
        ...recording,
        blob: await blob.arrayBuffer()
      });

      console.log(`[TensorRecording] Saved locally: ${filename} (${(blob.size / 1024 / 1024).toFixed(2)}MB)`);
    } catch (err) {
      console.error('[TensorRecording] Failed to save to storage:', err);
    }

    return recording;
  }

  async sendRecordingToPeer(
    recordingId: string,
    recipientPeerId: string,
    onProgress?: (progress: number) => void
  ): Promise<boolean> {
    const recording = this.recordings.get(recordingId);
    if (!recording) {
      console.error('[TensorRecording] Recording not found:', recordingId);
      return false;
    }

    recording.recipientPeerId = recipientPeerId;
    recording.status = 'sending';

    try {
      const blob = recording.blob;
      const totalChunks = Math.ceil(blob.size / this.chunkSize);

      const metadata = {
        id: recording.id,
        filename: recording.filename,
        manifoldType: recording.manifoldType,
        size: blob.size,
        mimeType: blob.type,
        timestamp: recording.timestamp,
        totalChunks
      };

      await g3tzkpService.sendMessage(recipientPeerId, JSON.stringify({
        type: 'TENSOR_RECORDING_START',
        metadata
      }));

      console.log(`[TensorRecording] Sending to ${recipientPeerId}: ${recording.filename}`);

      for (let i = 0; i < totalChunks; i++) {
        const start = i * this.chunkSize;
        const end = Math.min(start + this.chunkSize, blob.size);
        const chunk = blob.slice(start, end);
        const arrayBuffer = await chunk.arrayBuffer();

        const chunkData = {
          type: 'TENSOR_RECORDING_CHUNK',
          recordingId: recording.id,
          chunkIndex: i,
          totalChunks,
          data: Array.from(new Uint8Array(arrayBuffer))
        };

        await g3tzkpService.sendMessage(recipientPeerId, JSON.stringify(chunkData));

        const progress = ((i + 1) / totalChunks) * 100;
        this.uploadProgress.set(recordingId, progress);
        onProgress?.(progress);

        await new Promise(resolve => setTimeout(resolve, 50));
      }

      await g3tzkpService.sendMessage(recipientPeerId, JSON.stringify({
        type: 'TENSOR_RECORDING_END',
        recordingId: recording.id
      }));

      recording.status = 'sent';
      console.log(`[TensorRecording] Sent successfully to ${recipientPeerId}`);
      return true;

    } catch (err) {
      recording.status = 'failed';
      console.error('[TensorRecording] Send failed:', err);
      return false;
    }
  }

  async receiveRecording(
    metadata: any,
    onProgress?: (progress: number) => void
  ): Promise<{ recordingId: string; onChunk: (chunk: any) => void }> {
    const recordingId = metadata.id;
    const chunks: Uint8Array[] = [];

    return {
      recordingId,
      onChunk: async (chunk: any) => {
        if (chunk.type === 'TENSOR_RECORDING_CHUNK') {
          const uint8Array = new Uint8Array(chunk.data);
          chunks[chunk.chunkIndex] = uint8Array;

          const progress = ((Object.keys(chunks).length) / chunk.totalChunks) * 100;
          onProgress?.(progress);

          if (Object.keys(chunks).length === chunk.totalChunks) {
            const combinedBuffer = new Uint8Array(
              Array.from(chunks).reduce((acc, arr) => acc + arr.length, 0)
            );
            let offset = 0;
            chunks.forEach(chunk => {
              combinedBuffer.set(chunk, offset);
              offset += chunk.length;
            });

            const blob = new Blob([combinedBuffer], { type: metadata.mimeType });
            await this.saveRecordingLocally(blob, metadata.filename, metadata.manifoldType);

            console.log(`[TensorRecording] Received: ${metadata.filename} from peer`);
          }
        }
      }
    };
  }

  getRecording(id: string): TensorRecording | undefined {
    return this.recordings.get(id);
  }

  getAllRecordings(): TensorRecording[] {
    return Array.from(this.recordings.values());
  }

  getUploadProgress(recordingId: string): number {
    return this.uploadProgress.get(recordingId) || 0;
  }

  deleteRecording(recordingId: string): void {
    this.recordings.delete(recordingId);
    this.uploadProgress.delete(recordingId);
  }

  async downloadRecordingAsBlob(recordingId: string): Promise<Blob | null> {
    const recording = this.recordings.get(recordingId);
    if (!recording) return null;
    return recording.blob;
  }
}

export const tensorRecordingService = TensorRecordingService.getInstance();
export default tensorRecordingService;
