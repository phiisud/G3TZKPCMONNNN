import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Terminal, Upload, Camera, CameraOff, ChevronRight, Settings } from 'lucide-react';
import { getDeployedApps, getGatewayStatus, formatDate, resolveName } from '../utils/cliApi';

interface TerminalManifoldProps {
  onImageUpload: (file: File | null) => void;
  isCameraActive: boolean;
  setIsCameraActive: (active: boolean) => void;
  phiValue: number;
  setPhiValue: (phi: number) => void;
  recursionStages: number;
  setRecursionStages: (stages: number) => void;
}

interface CommandOutput {
  id: string;
  type: 'input' | 'output' | 'error' | 'success';
  text: string;
  timestamp: Date;
}

export const TerminalManifold: React.FC<TerminalManifoldProps> = ({
  onImageUpload,
  isCameraActive,
  setIsCameraActive,
  phiValue,
  setPhiValue,
  recursionStages,
  setRecursionStages
}) => {
  const [command, setCommand] = useState('');
  const [history, setHistory] = useState<CommandOutput[]>([
    { id: '0', type: 'output', text: 'G3TZKP CLI v1.0.0 - Tensor Manifold Interface', timestamp: new Date() },
    { id: '1', type: 'output', text: 'Type "help" for available commands', timestamp: new Date() },
  ]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [showSettings, setShowSettings] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [history]);

  const idCounter = useRef(0);
  
  const addOutput = useCallback((text: string, type: 'output' | 'error' | 'success' = 'output') => {
    idCounter.current += 1;
    setHistory(prev => [...prev, {
      id: `out-${Date.now()}-${idCounter.current}`,
      type,
      text,
      timestamp: new Date()
    }]);
  }, []);

  const executeCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim().toLowerCase();
    const parts = trimmed.split(' ');
    const mainCmd = parts[0];
    const args = parts.slice(1);

    setHistory(prev => [...prev, {
      id: Date.now().toString(),
      type: 'input',
      text: `$ ${cmd}`,
      timestamp: new Date()
    }]);

    switch (mainCmd) {
      case 'help':
        addOutput(`
Available Commands:
  list                         List deployed apps from gateway
  gateway status               Check gateway status
  resolve <NAME>               Resolve app name to ID
  open <NAME>                  Open app in new tab
  camera on|off                Toggle live camera feed
  upload                       Upload image for manifold
  phi <value>                  Set phi value (0.5-2.0)
  recursion <1-6>              Set recursion stages
  clear                        Clear terminal
  help                         Show this help
        `.trim());
        break;

      case 'list':
        addOutput('Fetching deployed applications...');
        try {
          const apps = await getDeployedApps();
          if (apps.length === 0) {
            addOutput('No deployed applications found', 'output');
          } else {
            addOutput('Deployed Applications:', 'success');
            apps.forEach((app) => {
              const size = app.size || 'N/A';
              const date = app.deployedAt ? formatDate(app.deployedAt) : 'Unknown';
              addOutput(`  ${app.name.padEnd(12)} | ${app.appId} | ${size} | ${date}`);
            });
          }
        } catch {
          addOutput('Failed to fetch apps. Is the gateway running?', 'error');
        }
        break;

      case 'gateway':
        if (args[0] === 'status') {
          addOutput('Checking gateway status...');
          try {
            const status = await getGatewayStatus();
            if (status.running) {
              addOutput('Gateway Status: RUNNING', 'success');
              addOutput(`  Port: ${status.port}`);
              addOutput(`  Apps: ${status.apps} deployed`);
            } else {
              addOutput('Gateway Status: OFFLINE', 'error');
              addOutput('  Start with: g3tzkp-web gateway start');
            }
          } catch {
            addOutput('Gateway Status: OFFLINE', 'error');
          }
        } else {
          addOutput('Usage: gateway status', 'error');
        }
        break;

      case 'resolve':
        if (args[0]) {
          const name = args[0].toUpperCase();
          addOutput(`Resolving ${name}...`);
          const appId = await resolveName(name);
          if (appId) {
            addOutput(`${name} -> ${appId}`, 'success');
            addOutput(`  URL: http://localhost:8080/${name}`);
          } else {
            addOutput(`App "${name}" not found`, 'error');
          }
        } else {
          addOutput('Usage: resolve <NAME>', 'error');
        }
        break;

      case 'open':
        if (args[0]) {
          const name = args[0].toUpperCase();
          const url = `http://localhost:8080/${name}`;
          window.open(url, '_blank');
          addOutput(`Opening ${url}...`, 'success');
        } else {
          addOutput('Usage: open <NAME>', 'error');
        }
        break;

      case 'camera':
        if (args[0] === 'on') {
          setIsCameraActive(true);
          addOutput('Camera feed activated - bijectively mapping to tensor manifold', 'success');
        } else if (args[0] === 'off') {
          setIsCameraActive(false);
          addOutput('Camera feed deactivated', 'success');
        } else {
          addOutput('Usage: camera on|off', 'error');
        }
        break;

      case 'upload':
        fileInputRef.current?.click();
        addOutput('Opening file picker...');
        break;

      case 'phi':
        const phiVal = parseFloat(args[0]);
        if (!isNaN(phiVal) && phiVal >= 0.5 && phiVal <= 2.0) {
          setPhiValue(phiVal);
          addOutput(`Phi value set to ${phiVal} - tensor basis transformed`, 'success');
        } else {
          addOutput('Invalid phi value. Use: phi <0.5-2.0>', 'error');
        }
        break;

      case 'recursion':
        const recVal = parseInt(args[0]);
        if (!isNaN(recVal) && recVal >= 1 && recVal <= 6) {
          setRecursionStages(recVal);
          addOutput(`Recursion stages set to ${recVal} - manifold depth adjusted`, 'success');
        } else {
          addOutput('Invalid recursion value. Use: recursion <1-6>', 'error');
        }
        break;

      case 'clear':
        setHistory([]);
        break;

      case '':
        break;

      default:
        addOutput(`Unknown command: ${mainCmd}. Type "help" for available commands.`, 'error');
    }

    setCommandHistory(prev => [...prev, cmd]);
    setHistoryIndex(-1);
  }, [addOutput, setIsCameraActive, setPhiValue, setRecursionStages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(command);
      setCommand('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setCommand(commandHistory[commandHistory.length - 1 - newIndex] || '');
      } else {
        setHistoryIndex(-1);
        setCommand('');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImageUpload(file);
      addOutput(`Loaded image: ${file.name}`, 'success');
      addOutput('Bijectively mapping pixels to tensor coordinate space...', 'output');
      addOutput('Transducing luma values to geometry depth...', 'output');
    }
  };

  return (
    <div className="absolute bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[500px] bg-black/90 backdrop-blur-sm border border-cyan-500/30 rounded-lg overflow-hidden font-mono text-sm shadow-2xl shadow-cyan-500/10">
      <div className="flex items-center justify-between px-3 py-2 bg-gradient-to-r from-cyan-900/50 to-transparent border-b border-cyan-500/20">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span className="text-cyan-400 font-bold text-xs tracking-wider">G3TZKP MANIFOLD</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-1.5 hover:bg-cyan-500/20 rounded transition-colors"
            title="Upload Image"
          >
            <Upload className="w-4 h-4 text-cyan-400" />
          </button>
          <button
            onClick={() => setIsCameraActive(!isCameraActive)}
            className={`p-1.5 rounded transition-colors ${isCameraActive ? 'bg-red-500/30 text-red-400' : 'hover:bg-cyan-500/20 text-cyan-400'}`}
            title={isCameraActive ? 'Stop Camera' : 'Start Camera'}
          >
            {isCameraActive ? <CameraOff className="w-4 h-4" /> : <Camera className="w-4 h-4" />}
          </button>
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`p-1.5 rounded transition-colors ${showSettings ? 'bg-cyan-500/30' : 'hover:bg-cyan-500/20'} text-cyan-400`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>

      {showSettings && (
        <div className="px-3 py-2 border-b border-cyan-500/20 bg-gray-900/50">
          <div className="flex items-center gap-4 text-xs">
            <label className="flex items-center gap-2 text-gray-400">
              <span>PHI:</span>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.01"
                value={phiValue}
                onChange={(e) => setPhiValue(parseFloat(e.target.value))}
                className="w-20 accent-cyan-500"
              />
              <span className="text-cyan-400 w-10">{phiValue.toFixed(3)}</span>
            </label>
            <label className="flex items-center gap-2 text-gray-400">
              <span>DEPTH:</span>
              <input
                type="range"
                min="1"
                max="6"
                step="1"
                value={recursionStages}
                onChange={(e) => setRecursionStages(parseInt(e.target.value))}
                className="w-16 accent-cyan-500"
              />
              <span className="text-cyan-400">{recursionStages}</span>
            </label>
          </div>
        </div>
      )}

      <div 
        ref={outputRef}
        className="h-48 overflow-y-auto p-3 space-y-1"
        onClick={() => inputRef.current?.focus()}
      >
        {history.map((item) => (
          <div 
            key={item.id}
            className={`whitespace-pre-wrap break-all ${
              item.type === 'input' ? 'text-cyan-300' :
              item.type === 'error' ? 'text-red-400' :
              item.type === 'success' ? 'text-green-400' :
              'text-gray-300'
            }`}
          >
            {item.text}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 border-t border-cyan-500/20 bg-gray-900/30">
        <ChevronRight className="w-4 h-4 text-cyan-500" />
        <input
          ref={inputRef}
          type="text"
          value={command}
          onChange={(e) => setCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command..."
          className="flex-1 bg-transparent text-cyan-100 outline-none placeholder:text-gray-600"
          autoFocus
        />
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
};
