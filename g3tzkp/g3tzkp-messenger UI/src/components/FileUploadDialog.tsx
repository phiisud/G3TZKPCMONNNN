import React, { useState, useRef, useCallback, useEffect, Suspense, lazy } from 'react';
import { 
  Upload, X, Image, Film, File, Box, CheckCircle, 
  Loader2, Sparkles, FileCode, FileText, Trash2, Plus, Wand2,
  Layers, Volume2, VolumeX, Eye, EyeOff
} from 'lucide-react';
import BackgroundRemovalEditor from './media/BackgroundRemovalEditor';
import { ImageAnalyzer } from '../../../Packages/anti-trafficking/src/ImageAnalyzer';
import { usePhiPiStore } from '../stores/usePhiPiStore';
import { bijectiveTensorService } from '../services/BijectiveTensorService';
import { ManifoldType, BijectiveTensorObject } from '../types/phiPiTypes';

const BijectiveTensorRenderer = lazy(() => import('./bijective/BijectiveTensorRenderer'));

interface UploadedFile {
  file: File;
  preview: string | null;
  id: string;
  tensorObject?: BijectiveTensorObject;
}

interface FileUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (files: File[], convert3D: boolean, hdQuality?: boolean, tensorObjects?: BijectiveTensorObject[]) => void;
}

const ACCEPTED_MEDIA_TYPES = 'image/*,video/*';
const ACCEPTED_DOCUMENT_TYPES = '.md,.js,.ts,.jsx,.tsx,.json,.html,.css,.yaml,.yml,.cpp,.c,.h,.circom,.asm,.py,.rs,.go,.pdf,.txt';
const MAX_FILE_SIZE = 50 * 1024 * 1024;

const MANIFOLD_OPTIONS: { type: ManifoldType; label: string; shortLabel: string }[] = [
  { type: 'FLOWER_OF_LIFE_19', label: 'Flower of Life', shortLabel: 'FOL' },
  { type: 'CLIFFORD_TORUS', label: 'Clifford Torus', shortLabel: 'CT' },
  { type: 'MOBIUS_FOLD', label: 'Möbius Fold', shortLabel: 'MF' },
  { type: 'SINGULARITY', label: 'Singularity', shortLabel: 'SNG' },
  { type: 'HYPERDRIVE_UPLINK', label: 'Hyperdrive', shortLabel: 'HYP' },
  { type: 'KLEIN_SLICE', label: 'Klein Slice', shortLabel: 'KS' },
  { type: 'CALABI_YAU', label: 'Calabi-Yau', shortLabel: 'CY' },
  { type: 'NEURAL_FRACTAL', label: 'Neural Fractal', shortLabel: 'NF' },
  { type: 'PHI_GEODESIC', label: 'Φ Geodesic', shortLabel: 'ΦG' },
  { type: 'TORUS', label: 'Torus', shortLabel: 'TOR' }
];

const FileUploadDialog: React.FC<FileUploadDialogProps> = ({ 
  isOpen, 
  onClose, 
  onUpload 
}) => {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [convert3D, setConvert3D] = useState(false);
  const [hdQuality, setHdQuality] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadMode, setUploadMode] = useState<'media' | 'document'>('media');
  const [fileSizeError, setFileSizeError] = useState<string | null>(null);
  const [bgRemovalTarget, setBgRemovalTarget] = useState<UploadedFile | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFile, setPreviewFile] = useState<UploadedFile | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const manifoldType = usePhiPiStore(s => s.manifoldType);
  const setManifoldType = usePhiPiStore(s => s.setManifoldType);
  const isAudioActive = usePhiPiStore(s => s.isAudioActive);
  const setAudioSource = usePhiPiStore(s => s.setAudioSource);
  const addBijectiveObject = usePhiPiStore(s => s.addBijectiveObject);

  const generateId = () => `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  useEffect(() => {
    if (convert3D && uploadedFiles.length > 0 && !previewFile) {
      const mediaFile = uploadedFiles.find(f => 
        f.file.type.startsWith('image/') || f.file.type.startsWith('video/')
      );
      if (mediaFile) {
        setPreviewFile(mediaFile);
      }
    }
  }, [convert3D, uploadedFiles, previewFile]);

  const processFileToTensor = useCallback(async (file: UploadedFile): Promise<UploadedFile> => {
    if (!file.file.type.startsWith('image/') && !file.file.type.startsWith('video/')) {
      return file;
    }

    try {
      const tensorObject = await bijectiveTensorService.encodeFileToBijectiveTensor(
        file.file,
        { manifoldType }
      );
      return { ...file, tensorObject };
    } catch (err) {
      console.error('[FileUpload] Tensor conversion failed:', err);
      return file;
    }
  }, [manifoldType]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    
    setFileSizeError(null);
    const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      setFileSizeError(`${oversizedFiles.length} file(s) exceed 50MB limit`);
    }
    
    const validFiles = files.filter(f => f.size <= MAX_FILE_SIZE);
    const newFiles: UploadedFile[] = validFiles.map(file => {
      let preview: string | null = null;
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        preview = URL.createObjectURL(file);
      }
      return { file, preview, id: generateId() };
    });
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
    if (e.target) e.target.value = '';
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files || []);
    if (files.length === 0) return;
    
    setFileSizeError(null);
    const oversizedFiles = files.filter(f => f.size > MAX_FILE_SIZE);
    if (oversizedFiles.length > 0) {
      setFileSizeError(`${oversizedFiles.length} file(s) exceed 50MB limit`);
    }
    
    const validFiles = files.filter(f => f.size <= MAX_FILE_SIZE);
    const newFiles: UploadedFile[] = validFiles.map(file => {
      let preview: string | null = null;
      if (file.type.startsWith('image/') || file.type.startsWith('video/')) {
        preview = URL.createObjectURL(file);
      }
      return { file, preview, id: generateId() };
    });
    
    setUploadedFiles(prev => [...prev, ...newFiles]);
  }, []);

  const removeFile = useCallback((id: string) => {
    setUploadedFiles(prev => {
      const file = prev.find(f => f.id === id);
      if (file?.preview) {
        URL.revokeObjectURL(file.preview);
      }
      return prev.filter(f => f.id !== id);
    });
    if (previewFile?.id === id) {
      setPreviewFile(null);
      setShowPreview(false);
    }
  }, [previewFile]);

  const handleUpload = useCallback(async () => {
    if (uploadedFiles.length === 0) return;
    
    setIsUploading(true);
    
    let processedFiles = uploadedFiles;
    let tensorObjects: BijectiveTensorObject[] = [];

    if (convert3D) {
      setIsProcessing(true);
      const processed = await Promise.all(
        uploadedFiles.map(f => processFileToTensor(f))
      );
      processedFiles = processed;
      tensorObjects = processed
        .filter(f => f.tensorObject)
        .map(f => f.tensorObject!);
      
      tensorObjects.forEach(obj => addBijectiveObject(obj));
      setIsProcessing(false);
    }
    
    onUpload(
      processedFiles.map(f => f.file), 
      convert3D, 
      hdQuality,
      tensorObjects.length > 0 ? tensorObjects : undefined
    );
    
    uploadedFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    
    setUploadedFiles([]);
    setConvert3D(false);
    setHdQuality(false);
    setFileSizeError(null);
    setIsUploading(false);
    setShowPreview(false);
    setPreviewFile(null);
    onClose();
  }, [uploadedFiles, convert3D, hdQuality, onUpload, onClose, processFileToTensor, addBijectiveObject]);

  const handleClose = useCallback(() => {
    uploadedFiles.forEach(f => {
      if (f.preview) URL.revokeObjectURL(f.preview);
    });
    setUploadedFiles([]);
    setConvert3D(false);
    setShowPreview(false);
    setPreviewFile(null);
    onClose();
  }, [uploadedFiles, onClose]);

  const hasMedia = uploadedFiles.some(f => 
    f.file.type.startsWith('image/') || f.file.type.startsWith('video/')
  );

  const hasImages = uploadedFiles.some(f => f.file.type.startsWith('image/'));

  const handleBackgroundRemovalComplete = useCallback(async ({ imageBlob, maskBlob }: { imageBlob: Blob; maskBlob: Blob }) => {
    if (!bgRemovalTarget) return;

    try {
      const analysis = await ImageAnalyzer.analyzeProcessedImage(
        bgRemovalTarget.file,
        imageBlob,
        maskBlob
      );
      
      console.log('[BackgroundRemoval] Image analysis:', {
        hadBackgroundRemoved: analysis.hadBackgroundRemoved,
        removalMethod: analysis.removalMethod,
        riskScore: analysis.riskScore,
        suspiciousPatterns: analysis.suspiciousPatterns
      });

      if (analysis.riskScore > 0.7) {
        console.warn('[BackgroundRemoval] High risk score detected:', analysis.riskScore);
      }
    } catch (error) {
      console.error('[BackgroundRemoval] Analysis failed:', error);
    }

    const processedFile = new window.File([imageBlob], bgRemovalTarget.file.name.replace(/\.[^.]+$/, '_processed.png'), {
      type: 'image/png'
    });

    const newPreview = URL.createObjectURL(processedFile);

    setUploadedFiles(prev => prev.map(f => {
      if (f.id === bgRemovalTarget.id) {
        if (f.preview) URL.revokeObjectURL(f.preview);
        return { ...f, file: processedFile, preview: newPreview };
      }
      return f;
    }));

    setBgRemovalTarget(null);
  }, [bgRemovalTarget]);

  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) return <Image size={14} className="text-[#00f3ff]" />;
    if (file.type.startsWith('video/')) return <Film size={14} className="text-[#00f3ff]" />;
    if (file.name.match(/\.(js|ts|jsx|tsx|cpp|c|py|rs|go|circom|asm)$/i)) {
      return <FileCode size={14} className="text-[#4caf50]" />;
    }
    return <FileText size={14} className="text-[#00f3ff]/60" />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in duration-200 p-2 sm:p-4">
      <div className="w-full max-w-lg sm:max-w-2xl lg:max-w-4xl bg-[#010401] border border-[#00f3ff]/30 shadow-2xl shadow-[#00f3ff]/10 max-h-[95vh] sm:max-h-[90vh] flex flex-col rounded-lg sm:rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-3 sm:px-6 py-3 sm:py-4 border-b border-[#00f3ff]/20">
          <div className="flex items-center gap-2 sm:gap-3">
            <Upload size={14} className="sm:w-4 sm:h-4 text-[#00f3ff]" />
            <span className="text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.3em] text-[#00f3ff]">
              UPLOAD_MEDIA
            </span>
          </div>
          <button
            onClick={handleClose}
            className="text-[#00f3ff]/40 hover:text-[#00f3ff] transition-colors p-1"
          >
            <X size={16} className="sm:w-5 sm:h-5" />
          </button>
        </div>

        <div className="flex border-b border-[#00f3ff]/20">
          <button
            onClick={() => setUploadMode('media')}
            className={`flex-1 py-2 sm:py-3 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider transition-all ${
              uploadMode === 'media' 
                ? 'bg-[#00f3ff]/10 text-[#00f3ff] border-b-2 border-[#00f3ff]' 
                : 'text-[#00f3ff]/40 hover:text-[#00f3ff]/60'
            }`}
          >
            Images / Videos
          </button>
          <button
            onClick={() => setUploadMode('document')}
            className={`flex-1 py-2 sm:py-3 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider transition-all ${
              uploadMode === 'document' 
                ? 'bg-[#4caf50]/10 text-[#4caf50] border-b-2 border-[#4caf50]' 
                : 'text-[#4caf50]/40 hover:text-[#4caf50]/60'
            }`}
          >
            Documents / Code
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className={`flex flex-col ${showPreview && convert3D ? 'lg:flex-row' : ''}`}>
            <div className={`p-3 sm:p-6 ${showPreview && convert3D ? 'lg:w-1/2' : 'w-full'}`}>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                onChange={handleFileSelect}
                accept={uploadMode === 'media' ? ACCEPTED_MEDIA_TYPES : ACCEPTED_DOCUMENT_TYPES}
                className="hidden"
              />

              {uploadedFiles.length === 0 ? (
                <div
                  onClick={() => fileInputRef.current?.click()}
                  onDrop={handleDrop}
                  onDragOver={(e) => e.preventDefault()}
                  className="border-2 border-dashed border-[#00f3ff]/30 rounded-lg p-6 sm:p-12 flex flex-col items-center justify-center gap-3 sm:gap-4 cursor-pointer hover:border-[#00f3ff]/60 hover:bg-[#00f3ff]/5 transition-all"
                >
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-full bg-[#00f3ff]/10 flex items-center justify-center">
                    <Upload size={20} className="sm:w-6 sm:h-6 text-[#00f3ff]" />
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] sm:text-[11px] font-bold text-[#00f3ff] uppercase tracking-wider">
                      Drop files here or tap to browse
                    </div>
                    <div className="text-[8px] sm:text-[9px] text-[#00f3ff]/40 mt-1 sm:mt-2">
                      {uploadMode === 'media' 
                        ? 'Multiple images and videos supported' 
                        : 'Code files: .md, .js, .ts, .cpp, .circom, .json, .yaml'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3 sm:space-y-4">
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3 max-h-32 sm:max-h-48 overflow-y-auto">
                    {uploadedFiles.map((item) => (
                      <div 
                        key={item.id}
                        onClick={() => {
                          if (convert3D && (item.file.type.startsWith('image/') || item.file.type.startsWith('video/'))) {
                            setPreviewFile(item);
                            setShowPreview(true);
                          }
                        }}
                        className={`relative group bg-black/50 border rounded overflow-hidden cursor-pointer transition-all ${
                          previewFile?.id === item.id 
                            ? 'border-[#00f3ff] ring-1 ring-[#00f3ff]/50' 
                            : 'border-[#00f3ff]/20 hover:border-[#00f3ff]/40'
                        }`}
                      >
                        {item.preview ? (
                          item.file.type.startsWith('video/') ? (
                            <video
                              src={item.preview}
                              className="w-full h-14 sm:h-20 object-cover"
                              muted
                            />
                          ) : (
                            <img
                              src={item.preview}
                              alt={item.file.name}
                              className="w-full h-14 sm:h-20 object-cover"
                            />
                          )
                        ) : (
                          <div className="w-full h-14 sm:h-20 flex items-center justify-center bg-black/70">
                            {getFileIcon(item.file)}
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 right-0 bg-black/80 px-1 sm:px-2 py-0.5 sm:py-1">
                          <div className="text-[6px] sm:text-[8px] text-[#00f3ff] truncate flex items-center gap-1">
                            {item.file.name}
                          </div>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFile(item.id);
                          }}
                          className="absolute top-0.5 right-0.5 sm:top-1 sm:right-1 w-4 h-4 sm:w-5 sm:h-5 bg-red-500/80 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 size={8} className="sm:w-[10px] sm:h-[10px] text-white" />
                        </button>
                        {item.file.type.startsWith('image/') && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setBgRemovalTarget(item);
                            }}
                            className="absolute top-0.5 left-0.5 sm:top-1 sm:left-1 w-4 h-4 sm:w-5 sm:h-5 bg-[#00f3ff]/80 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Remove background"
                          >
                            <Wand2 size={8} className="sm:w-[10px] sm:h-[10px] text-black" />
                          </button>
                        )}
                      </div>
                    ))}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="h-14 sm:h-20 border-2 border-dashed border-[#00f3ff]/20 rounded flex items-center justify-center hover:border-[#00f3ff]/40 hover:bg-[#00f3ff]/5 transition-all"
                    >
                      <Plus size={16} className="sm:w-5 sm:h-5 text-[#00f3ff]/40" />
                    </button>
                  </div>

                  <div className="flex items-center gap-2 p-2 bg-black/30 rounded text-[8px] sm:text-[9px] text-[#00f3ff]/60">
                    <span>{uploadedFiles.length} file{uploadedFiles.length > 1 ? 's' : ''}</span>
                    <span className="text-[#00f3ff]/30">|</span>
                    <span>{(uploadedFiles.reduce((sum, f) => sum + f.file.size, 0) / 1024 / 1024).toFixed(2)} MB</span>
                  </div>

                  {fileSizeError && (
                    <div className="p-2 sm:p-3 bg-red-500/10 border border-red-500/30 rounded text-red-400 text-[8px] sm:text-[9px]" role="alert">
                      {fileSizeError}
                    </div>
                  )}

                  {hasMedia && (
                    <div className="space-y-2 sm:space-y-3">
                      <button
                        onClick={() => setHdQuality(!hdQuality)}
                        className={`w-full flex items-center gap-2 sm:gap-4 p-2 sm:p-3 border rounded transition-all ${
                          hdQuality
                            ? 'bg-[#4caf50]/10 border-[#4caf50]/60 text-[#4caf50]'
                            : 'bg-black/30 border-[#4caf50]/20 text-[#4caf50]/60 hover:border-[#4caf50]/30'
                        }`}
                        aria-pressed={hdQuality}
                      >
                        <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded flex items-center justify-center font-bold text-[8px] sm:text-[10px] ${
                          hdQuality ? 'bg-[#4caf50]/20 text-[#4caf50]' : 'bg-black/50 text-[#4caf50]/40'
                        }`}>
                          HD
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">
                            SEND IN HD QUALITY
                          </div>
                        </div>
                        {hdQuality && (
                          <CheckCircle size={14} className="sm:w-4 sm:h-4 text-[#4caf50]" />
                        )}
                      </button>

                      <button
                        onClick={() => {
                          setConvert3D(!convert3D);
                          if (!convert3D) {
                            const mediaFile = uploadedFiles.find(f => 
                              f.file.type.startsWith('image/') || f.file.type.startsWith('video/')
                            );
                            if (mediaFile) {
                              setPreviewFile(mediaFile);
                              setShowPreview(true);
                            }
                          } else {
                            setShowPreview(false);
                          }
                        }}
                        className={`w-full flex items-center gap-2 sm:gap-4 p-2 sm:p-3 border rounded transition-all ${
                          convert3D
                            ? 'bg-[#00f3ff]/10 border-[#00f3ff]/60 text-[#00f3ff]'
                            : 'bg-black/30 border-[#4caf50]/20 text-[#4caf50]/60 hover:border-[#00f3ff]/30'
                        }`}
                        aria-pressed={convert3D}
                      >
                        <div className={`w-6 h-6 sm:w-8 sm:h-8 rounded flex items-center justify-center ${
                          convert3D ? 'bg-[#00f3ff]/20' : 'bg-black/50'
                        }`}>
                          <Box size={14} className={`sm:w-4 sm:h-4 ${convert3D ? 'text-[#00f3ff]' : 'text-[#4caf50]/40'}`} />
                        </div>
                        <div className="flex-1 text-left">
                          <div className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">
                            BIJECTIVE TENSOR MAPPING
                          </div>
                          <div className="text-[6px] sm:text-[7px] opacity-60 hidden sm:block">
                            Φ-Π Harmonic 3D Manifold Rendering
                          </div>
                        </div>
                        {convert3D && (
                          <Sparkles size={14} className="sm:w-4 sm:h-4 text-[#00f3ff] animate-pulse" />
                        )}
                      </button>

                      {convert3D && (
                        <div className="bg-black/40 border border-[#00f3ff]/20 rounded-lg p-2 sm:p-3 space-y-2 sm:space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Layers size={12} className="sm:w-3.5 sm:h-3.5 text-[#00f3ff]" />
                              <span className="text-[8px] sm:text-[9px] text-[#00f3ff] font-mono uppercase">
                                Manifold Type
                              </span>
                            </div>
                            <button
                              onClick={() => setShowPreview(!showPreview)}
                              className="flex items-center gap-1 text-[7px] sm:text-[8px] text-[#00f3ff]/60 hover:text-[#00f3ff] transition-colors"
                            >
                              {showPreview ? <EyeOff size={10} /> : <Eye size={10} />}
                              <span className="hidden sm:inline">{showPreview ? 'Hide' : 'Show'} Preview</span>
                            </button>
                          </div>
                          <div className="grid grid-cols-5 gap-1">
                            {MANIFOLD_OPTIONS.map(({ type, label, shortLabel }) => (
                              <button
                                key={type}
                                onClick={() => setManifoldType(type)}
                                className={`px-1 py-1 sm:px-2 sm:py-1.5 rounded text-[6px] sm:text-[8px] font-mono uppercase truncate transition-all active:scale-95 ${
                                  manifoldType === type
                                    ? 'bg-[#00f3ff]/30 text-[#00f3ff] border border-[#00f3ff]/50'
                                    : 'bg-black/50 text-[#4caf50]/60 border border-[#4caf50]/20 hover:border-[#00f3ff]/30'
                                }`}
                                title={label}
                              >
                                {shortLabel}
                              </button>
                            ))}
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setAudioSource(isAudioActive ? 'none' : 'microphone')}
                              className={`flex items-center gap-1.5 px-2 py-1 rounded text-[7px] sm:text-[8px] transition-all ${
                                isAudioActive
                                  ? 'bg-[#4caf50]/20 text-[#4caf50] border border-[#4caf50]/40'
                                  : 'bg-black/50 text-[#4caf50]/50 border border-[#4caf50]/20 hover:border-[#4caf50]/40'
                              }`}
                            >
                              {isAudioActive ? <Volume2 size={10} /> : <VolumeX size={10} />}
                              <span className="hidden sm:inline">Audio React</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {showPreview && convert3D && previewFile?.preview && (
              <div className="p-3 sm:p-6 lg:w-1/2 border-t lg:border-t-0 lg:border-l border-[#00f3ff]/20">
                <div className="h-48 sm:h-64 lg:h-full min-h-[200px]">
                  <Suspense fallback={
                    <div className="w-full h-full flex items-center justify-center bg-black/50 rounded-lg">
                      <Loader2 className="w-8 h-8 text-[#00f3ff] animate-spin" />
                    </div>
                  }>
                    <BijectiveTensorRenderer
                      assetUrl={previewFile.preview}
                      assetType={previewFile.file.type.startsWith('video/') ? 'video' : 'image'}
                      manifoldType={manifoldType}
                      className="w-full h-full"
                      compact={false}
                    />
                  </Suspense>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 sm:gap-3 px-3 sm:px-6 py-3 sm:py-4 border-t border-[#00f3ff]/20">
          <button
            onClick={handleClose}
            className="flex-1 py-2 sm:py-3 bg-black/50 border border-[#4caf50]/20 text-[#4caf50]/60 text-[8px] sm:text-[9px] font-bold uppercase tracking-wider hover:bg-black/70 transition-all rounded"
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={uploadedFiles.length === 0 || isUploading}
            className="flex-1 py-2 sm:py-3 bg-[#00f3ff]/20 border border-[#00f3ff]/40 text-[#00f3ff] text-[8px] sm:text-[9px] font-bold uppercase tracking-wider hover:bg-[#00f3ff]/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 rounded"
          >
            {isUploading || isProcessing ? (
              <>
                <Loader2 size={12} className="animate-spin" />
                {isProcessing ? 'TENSOR MAPPING...' : 'PROCESSING...'}
              </>
            ) : (
              <>
                <CheckCircle size={12} />
                {convert3D ? 'SEND_TENSOR' : 'SEND_MEDIA'}
              </>
            )}
          </button>
        </div>
      </div>

      {bgRemovalTarget && (
        <BackgroundRemovalEditor
          originalImage={bgRemovalTarget.file}
          onComplete={handleBackgroundRemovalComplete}
          onCancel={() => setBgRemovalTarget(null)}
        />
      )}
    </div>
  );
};

export default FileUploadDialog;
