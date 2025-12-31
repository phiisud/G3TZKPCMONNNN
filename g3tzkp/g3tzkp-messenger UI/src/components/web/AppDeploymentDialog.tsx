import React, { useState, useCallback, useEffect } from 'react';
import { 
  Upload, X, Folder, File, Package, Shield, Globe, Loader2,
  Check, AlertTriangle, Copy, ExternalLink, Info, Link
} from 'lucide-react';
import { useDropzone } from 'react-dropzone';
import { g3tzkpWebDeployer } from '../../services/web/G3TZKPWebDeployer';
import { AppDeployment, DeployOptions, AppPermissions } from '../../types/g3tzkp-web';
import { nameRegistryService } from '../../services/NameRegistryService';
import { g3tzkpService } from '../../services/G3TZKPService';

interface AppDeploymentDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onDeployed?: (deployment: AppDeployment) => void;
}

type DeploymentStep = 'upload' | 'configure' | 'deploying' | 'complete';

const DEFAULT_PERMISSIONS: AppPermissions = {
  network: false,
  storage: true,
  camera: false,
  microphone: false,
  location: false,
  notifications: false
};

export const AppDeploymentDialog: React.FC<AppDeploymentDialogProps> = ({
  isOpen,
  onClose,
  onDeployed
}) => {
  const [step, setStep] = useState<DeploymentStep>('upload');
  const [files, setFiles] = useState<File[]>([]);
  const [appName, setAppName] = useState('');
  const [shortName, setShortName] = useState('');
  const [shortNameError, setShortNameError] = useState<string | null>(null);
  const [appDescription, setAppDescription] = useState('');
  const [appVersion, setAppVersion] = useState('1.0.0');
  const [permissions, setPermissions] = useState<AppPermissions>(DEFAULT_PERMISSIONS);
  const [cacheStrategy, setCacheStrategy] = useState<'aggressive' | 'moderate' | 'minimal'>('aggressive');
  const [deployProgress, setDeployProgress] = useState(0);
  const [deployStatus, setDeployStatus] = useState('');
  const [deployment, setDeployment] = useState<AppDeployment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [humanReadableUrl, setHumanReadableUrl] = useState<string | null>(null);

  useEffect(() => {
    nameRegistryService.initialize();
  }, []);

  useEffect(() => {
    if (shortName) {
      const sanitized = nameRegistryService.sanitizeName(shortName);
      if (sanitized.length > 0) {
        if (nameRegistryService.isNameAvailable(sanitized)) {
          setShortNameError(null);
        } else {
          setShortNameError('This name is already taken');
        }
      } else {
        setShortNameError('Invalid characters');
      }
    } else {
      setShortNameError(null);
    }
  }, [shortName]);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setFiles(prev => [...prev, ...acceptedFiles]);
    setError(null);
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/html': ['.html', '.htm'],
      'text/css': ['.css'],
      'text/javascript': ['.js', '.mjs'],
      'application/json': ['.json'],
      'image/*': ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp'],
      'font/*': ['.woff', '.woff2', '.ttf', '.eot']
    }
  });

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleDeploy = async () => {
    if (files.length === 0) {
      setError('Please add at least one file to deploy');
      return;
    }

    if (!appName.trim()) {
      setError('Please enter an app name');
      return;
    }

    setStep('deploying');
    setDeployProgress(0);
    setDeployStatus('Preparing files...');
    setError(null);

    try {
      const options: DeployOptions = {
        name: appName.trim(),
        description: appDescription.trim() || undefined,
        version: appVersion,
        permissions,
        cacheStrategy
      };

      setDeployProgress(10);
      setDeployStatus('Creating manifest...');

      setDeployProgress(30);
      setDeployStatus('Chunking files...');

      const result = await g3tzkpWebDeployer.deployFromFiles(files, options);

      setDeployProgress(70);
      setDeployStatus('Broadcasting to network...');

      await new Promise(resolve => setTimeout(resolve, 1000));

      if (shortName.trim()) {
        setDeployProgress(85);
        setDeployStatus('Registering human-readable name...');
        try {
          const sanitized = nameRegistryService.sanitizeName(shortName);
          const peerId = g3tzkpService.getPeerId();
          if (peerId) {
            await nameRegistryService.registerName(sanitized, peerId);
            setHumanReadableUrl(`g3tzkp://${sanitized}`);
          }
        } catch (nameErr) {
          console.warn('[Deploy] Failed to register name:', nameErr);
        }
      }

      setDeployProgress(100);
      setDeployStatus('Deployment complete!');
      setDeployment(result);
      setStep('complete');

      onDeployed?.(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Deployment failed');
      setStep('configure');
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const resetDialog = () => {
    setStep('upload');
    setFiles([]);
    setAppName('');
    setShortName('');
    setShortNameError(null);
    setAppDescription('');
    setAppVersion('1.0.0');
    setPermissions(DEFAULT_PERMISSIONS);
    setCacheStrategy('aggressive');
    setDeployProgress(0);
    setDeployStatus('');
    setDeployment(null);
    setError(null);
    setHumanReadableUrl(null);
  };

  const handleClose = () => {
    resetDialog();
    onClose();
  };

  if (!isOpen) return null;

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);
  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-black border border-[#00f3ff]/30 rounded-xl shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between p-4 bg-black border-b border-[#00f3ff]/20">
          <div className="flex items-center gap-3">
            <Package className="text-[#00f3ff]" size={24} />
            <h2 className="text-lg font-semibold text-[#00f3ff]">Deploy to G3TZKP Network</h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[#00f3ff]/10 rounded-lg transition-colors text-white/60 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="flex items-center justify-center gap-4 p-4 border-b border-[#00f3ff]/10">
          {['upload', 'configure', 'deploying', 'complete'].map((s, i) => (
            <React.Fragment key={s}>
              <div className={`flex items-center gap-2 ${step === s || ['upload', 'configure', 'deploying', 'complete'].indexOf(step) > i ? 'text-[#00f3ff]' : 'text-white/30'}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 ${step === s ? 'bg-[#00f3ff]/20 border-[#00f3ff]' : ['upload', 'configure', 'deploying', 'complete'].indexOf(step) > i ? 'bg-[#4caf50]/20 border-[#4caf50] text-[#4caf50]' : 'border-white/30'}`}>
                  {['upload', 'configure', 'deploying', 'complete'].indexOf(step) > i ? (
                    <Check size={16} />
                  ) : (
                    <span className="text-sm">{i + 1}</span>
                  )}
                </div>
                <span className="text-sm capitalize hidden sm:inline">{s}</span>
              </div>
              {i < 3 && <div className={`w-8 h-0.5 ${['upload', 'configure', 'deploying', 'complete'].indexOf(step) > i ? 'bg-[#4caf50]' : 'bg-white/10'}`} />}
            </React.Fragment>
          ))}
        </div>

        <div className="p-6">
          {step === 'upload' && (
            <div className="space-y-6">
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragActive 
                    ? 'border-[#00f3ff] bg-[#00f3ff]/10' 
                    : 'border-[#00f3ff]/30 hover:border-[#00f3ff]/50 hover:bg-[#00f3ff]/5'
                }`}
              >
                <input {...getInputProps()} />
                <Upload className="mx-auto mb-4 text-[#00f3ff]/60" size={48} />
                <p className="text-white/80 mb-2">
                  {isDragActive ? 'Drop files here...' : 'Drag & drop your app files here'}
                </p>
                <p className="text-sm text-white/40">
                  or click to browse (HTML, CSS, JS, images, fonts)
                </p>
              </div>

              {files.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-white/60">{files.length} files selected</span>
                    <span className="text-[#00f3ff]">{formatSize(totalSize)}</span>
                  </div>
                  <div className="max-h-48 overflow-y-auto space-y-1">
                    {files.map((file, i) => (
                      <div key={i} className="flex items-center justify-between p-2 bg-[#00f3ff]/5 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <File size={16} className="text-[#00f3ff]/60 shrink-0" />
                          <span className="text-sm truncate">{file.name}</span>
                          <span className="text-xs text-white/40">{formatSize(file.size)}</span>
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          className="p-1 hover:bg-red-500/20 rounded text-red-400"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <button
                onClick={() => setStep('configure')}
                disabled={files.length === 0}
                className="w-full py-3 bg-[#00f3ff]/20 hover:bg-[#00f3ff]/30 border border-[#00f3ff]/50 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Continue
              </button>
            </div>
          )}

          {step === 'configure' && (
            <div className="space-y-6">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-white/60 mb-2">App Name *</label>
                  <input
                    type="text"
                    value={appName}
                    onChange={(e) => setAppName(e.target.value)}
                    placeholder="My Awesome App"
                    className="w-full px-4 py-3 bg-[#00f3ff]/5 border border-[#00f3ff]/30 rounded-lg text-white outline-none focus:border-[#00f3ff] transition-colors"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">
                    <div className="flex items-center gap-2">
                      <Link size={14} />
                      Short Name (max 9 chars)
                    </div>
                  </label>
                  <div className="relative">
                    <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[#00f3ff]/60 font-mono text-sm">
                      g3tzkp://
                    </div>
                    <input
                      type="text"
                      value={shortName}
                      onChange={(e) => setShortName(e.target.value.toUpperCase().slice(0, 9))}
                      placeholder="MYAPP"
                      maxLength={9}
                      className={`w-full pl-24 pr-4 py-3 bg-[#00f3ff]/5 border rounded-lg text-[#00f3ff] font-mono outline-none focus:border-[#00f3ff] transition-colors uppercase ${
                        shortNameError ? 'border-red-500/50' : 'border-[#00f3ff]/30'
                      }`}
                    />
                  </div>
                  {shortNameError ? (
                    <p className="text-xs text-red-400 mt-1">{shortNameError}</p>
                  ) : shortName ? (
                    <p className="text-xs text-[#4caf50] mt-1">
                      Your app will be accessible at: g3tzkp://{nameRegistryService.sanitizeName(shortName)}
                    </p>
                  ) : (
                    <p className="text-xs text-white/40 mt-1">
                      Create a human-readable URL (letters and numbers only)
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">Description</label>
                  <textarea
                    value={appDescription}
                    onChange={(e) => setAppDescription(e.target.value)}
                    placeholder="A brief description of your app..."
                    rows={3}
                    className="w-full px-4 py-3 bg-[#00f3ff]/5 border border-[#00f3ff]/30 rounded-lg text-white outline-none focus:border-[#00f3ff] transition-colors resize-none"
                  />
                </div>

                <div>
                  <label className="block text-sm text-white/60 mb-2">Version</label>
                  <input
                    type="text"
                    value={appVersion}
                    onChange={(e) => setAppVersion(e.target.value)}
                    placeholder="1.0.0"
                    className="w-full px-4 py-3 bg-[#00f3ff]/5 border border-[#00f3ff]/30 rounded-lg text-white outline-none focus:border-[#00f3ff] transition-colors"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-3">Permissions</label>
                <div className="grid grid-cols-2 gap-3">
                  {Object.entries(permissions).map(([key, value]) => (
                    <label key={key} className="flex items-center gap-3 p-3 bg-[#00f3ff]/5 rounded-lg cursor-pointer hover:bg-[#00f3ff]/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(e) => setPermissions(prev => ({ ...prev, [key]: e.target.checked }))}
                        className="w-4 h-4 rounded border-[#00f3ff]/50 bg-transparent checked:bg-[#00f3ff]"
                      />
                      <span className="text-sm capitalize">{key}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm text-white/60 mb-3">Cache Strategy</label>
                <div className="flex gap-3">
                  {(['aggressive', 'moderate', 'minimal'] as const).map(strategy => (
                    <button
                      key={strategy}
                      onClick={() => setCacheStrategy(strategy)}
                      className={`flex-1 py-2 px-4 rounded-lg border transition-colors capitalize ${
                        cacheStrategy === strategy 
                          ? 'bg-[#00f3ff]/20 border-[#00f3ff] text-[#00f3ff]' 
                          : 'border-[#00f3ff]/30 hover:border-[#00f3ff]/50'
                      }`}
                    >
                      {strategy}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400">
                  <AlertTriangle size={18} />
                  <span className="text-sm">{error}</span>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setStep('upload')}
                  className="flex-1 py-3 border border-[#00f3ff]/30 hover:border-[#00f3ff]/50 rounded-lg font-medium transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleDeploy}
                  className="flex-1 py-3 bg-[#00f3ff] hover:bg-[#00d4e6] text-black rounded-lg font-semibold transition-colors"
                >
                  Deploy
                </button>
              </div>
            </div>
          )}

          {step === 'deploying' && (
            <div className="py-12 text-center">
              <Loader2 className="mx-auto mb-6 text-[#00f3ff] animate-spin" size={64} />
              <h3 className="text-xl font-semibold mb-2">{deployStatus}</h3>
              <div className="w-full max-w-xs mx-auto mt-6">
                <div className="h-2 bg-[#00f3ff]/10 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#00f3ff] transition-all duration-500"
                    style={{ width: `${deployProgress}%` }}
                  />
                </div>
                <p className="text-sm text-white/40 mt-2">{deployProgress}%</p>
              </div>
            </div>
          )}

          {step === 'complete' && deployment && (
            <div className="py-8 text-center">
              <div className="w-20 h-20 mx-auto mb-6 bg-[#4caf50]/20 rounded-full flex items-center justify-center">
                <Check className="text-[#4caf50]" size={40} />
              </div>
              <h3 className="text-2xl font-semibold mb-2 text-[#4caf50]">Deployment Successful!</h3>
              <p className="text-white/60 mb-8">Your app is now live on the G3TZKP network</p>

              <div className="bg-[#00f3ff]/5 border border-[#00f3ff]/30 rounded-xl p-6 mb-6 text-left">
                <div className="space-y-4">
                  {humanReadableUrl && (
                    <div>
                      <label className="text-xs text-white/40 block mb-1">Human-Readable URL</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 p-3 bg-[#4caf50]/10 border border-[#4caf50]/30 rounded-lg text-[#4caf50] text-lg font-bold break-all">
                          {humanReadableUrl}
                        </code>
                        <button
                          onClick={() => copyToClipboard(humanReadableUrl)}
                          className="p-3 hover:bg-[#4caf50]/10 rounded-lg transition-colors"
                          title="Copy URL"
                        >
                          {copied ? <Check size={18} className="text-[#4caf50]" /> : <Copy size={18} className="text-[#4caf50]" />}
                        </button>
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="text-xs text-white/40 block mb-1">{humanReadableUrl ? 'Full App URL' : 'App URL'}</label>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 p-3 bg-black/50 rounded-lg text-[#00f3ff] text-sm break-all">
                        {deployment.url}
                      </code>
                      <button
                        onClick={() => copyToClipboard(deployment.url)}
                        className="p-3 hover:bg-[#00f3ff]/10 rounded-lg transition-colors"
                        title="Copy URL"
                      >
                        {copied ? <Check size={18} className="text-[#4caf50]" /> : <Copy size={18} />}
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-white/40">App ID:</span>
                      <p className="text-white truncate">{deployment.appId}</p>
                    </div>
                    <div>
                      <span className="text-white/40">Size:</span>
                      <p className="text-white">{formatSize(deployment.totalSize)}</p>
                    </div>
                    <div>
                      <span className="text-white/40">Files:</span>
                      <p className="text-white">{deployment.fileCount}</p>
                    </div>
                    <div>
                      <span className="text-white/40">Chunks:</span>
                      <p className="text-white">{deployment.chunkCount}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={resetDialog}
                  className="flex-1 py-3 border border-[#00f3ff]/30 hover:border-[#00f3ff]/50 rounded-lg font-medium transition-colors"
                >
                  Deploy Another
                </button>
                <button
                  onClick={handleClose}
                  className="flex-1 py-3 bg-[#00f3ff] hover:bg-[#00d4e6] text-black rounded-lg font-semibold transition-colors"
                >
                  Done
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AppDeploymentDialog;
