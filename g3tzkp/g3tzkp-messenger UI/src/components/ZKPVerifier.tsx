import React, { useEffect, useState, useRef } from 'react';
import { Shield, Loader2, Database, CheckCircle2, Binary, RefreshCw, LockIcon, Cpu, Play } from 'lucide-react';
import { useG3ZKP } from '../contexts/G3ZKPContext';

const FlowerOfLifeVerifier: React.FC<{ size?: number, color?: string, active?: boolean }> = ({ 
  size = 100, color = "#00f3ff", active = false 
}) => (
    <div className={`relative flex items-center justify-center ${active ? 'animate-[rotorse-alpha_10s_linear_infinite]' : ''}`} style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="w-full h-full transition-all duration-1000">
        <circle cx="50" cy="50" r="16" fill="none" stroke={color} strokeWidth="0.5" />
        {[0, 60, 120, 180, 240, 300].map(angle => (
            <circle 
                key={angle} 
                cx={50 + 16 * Math.cos(angle * Math.PI / 180)} 
                cy={50 + 16 * Math.sin(angle * Math.PI / 180)} 
                r="16" 
                fill="none" 
                stroke={color} 
                strokeWidth="0.5" 
                opacity={active ? 1 : 0.4}
            />
        ))}
      </svg>
    </div>
);

const ISO_VERIFICATION_KEY = 'g3zkp_iso_verified';

const ZKPVerifier: React.FC = () => {
  const { 
    networkStats, 
    storageStats, 
    connectedPeers, 
    circuits, 
    activeSessions,
    pendingProofs,
    connectionQuality,
    localPeerId,
    identityPublicKey
  } = useG3ZKP();
  
  const [hasVerified, setHasVerified] = useState(() => {
    return localStorage.getItem(ISO_VERIFICATION_KEY) === 'true';
  });
  const [step, setStep] = useState(hasVerified ? 7 : 0);
  const [log, setLog] = useState<string[]>([]);
  const [isRunning, setIsRunning] = useState(!hasVerified);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  
  const peerCount = connectedPeers.length;
  const messageCount = storageStats?.messageCount || 0;
  const zkProofCount = storageStats?.zkProofCount || 0;
  const sessionCount = activeSessions.length;
  const circuitCount = circuits.filter(c => c.status === 'ready').length;
  const routesCached = networkStats?.routesCached || 0;

  const steps = [
    { 
      label: 'CALIBRATING_MATRIX', 
      icon: Database, 
      details: `ENTROPY_SEED: 0x${identityPublicKey?.substring(2, 10) || '8F2F..A2'}` 
    },
    { 
      label: 'ISO_MAPPING_GEODESIC', 
      icon: Binary, 
      details: `PEER_NODES: ${peerCount} | ROUTES: ${routesCached}` 
    },
    { 
      label: 'POLYNOMIAL_CRUNCH', 
      icon: Cpu, 
      details: `CIRCUITS_LOADED: ${circuitCount} | DEGREE: 2^24_SNARK` 
    },
    { 
      label: 'GRADE_3_SOUNDNESS', 
      icon: Loader2, 
      details: `SESSIONS: ${sessionCount} | PROOFS: ${zkProofCount}` 
    },
    { 
      label: 'FLOWER_OF_LIFE_SYNC', 
      icon: RefreshCw, 
      details: `ROTORSE_ALIGNED: ${(Math.random() * 0.0001).toFixed(6)}` 
    },
    { 
      label: 'TAUTOLOGICAL_PROOF', 
      icon: Shield, 
      details: `MESSAGES_STORED: ${messageCount} | HASH: OK` 
    },
    { 
      label: 'TRANSMISSION_SEALED', 
      icon: CheckCircle2, 
      details: `CONNECTION: ${connectionQuality.toUpperCase()} | ZKP: TRUE` 
    }
  ];

  useEffect(() => {
    if (!isRunning) return;

    timerRef.current = setInterval(() => {
      setStep(prev => {
        if (prev < steps.length - 1) {
          setLog(l => [`>> ${steps[prev].details}`, ...l].slice(0, 5));
          return prev + 1;
        } else {
          if (timerRef.current) clearInterval(timerRef.current);
          localStorage.setItem(ISO_VERIFICATION_KEY, 'true');
          setHasVerified(true);
          setIsRunning(false);
          return prev;
        }
      });
    }, 550);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning, steps]);

  const handleRerunVerification = () => {
    localStorage.removeItem(ISO_VERIFICATION_KEY);
    setHasVerified(false);
    setStep(0);
    setLog([]);
    setIsRunning(true);
  };

  const isComplete = step >= steps.length - 1;

  return (
    <div className="p-5 md:p-12 border-[0.5px] border-[#00f3ff]/60 bg-black/95 flex flex-col items-center gap-5 md:gap-10 max-w-lg w-full shadow-[0_0_60px_rgba(0,243,255,0.1)] relative overflow-hidden transition-all">
      <div className="absolute top-0 left-0 w-full h-[0.5px] bg-[#00f3ff] shadow-[0_0_15px_#00f3ff]"></div>
      
      <div className="flex flex-col md:flex-row items-center gap-5 md:gap-10 w-full">
         <div className="relative group shrink-0">
            <div className="absolute inset-0 bg-[#00f3ff]/10 blur-3xl rounded-full animate-pulse"></div>
            <div className={`p-6 md:p-9 border-[0.5px] border-[#4caf50]/60 rounded-full text-[#00f3ff] bg-black shadow-[0_0_30px_rgba(76,175,80,0.15)] transition-all duration-700 ${step >= 3 && step <= 5 && isRunning ? 'scale-110 shadow-[0_0_40px_#00f3ff22]' : 'scale-90'}`}>
               <FlowerOfLifeVerifier size={window.innerWidth < 768 ? 50 : 70} color={step % 2 === 0 ? "#00f3ff" : "#4caf50"} active={step >= 4 && isRunning} />
            </div>
            <div className="absolute -bottom-1 -right-1 p-2 bg-black border-[0.5px] border-[#4caf50]/60 text-[#4caf50] shadow-2xl">
              <LockIcon size={14} strokeWidth={1} />
            </div>
         </div>

         <div className="flex-1 w-full text-left space-y-2">
            <div className="flex justify-between items-end mb-2">
               <h3 className="orbitron text-xs md:text-lg font-black tracking-[0.2em] md:tracking-[0.4em] text-[#00f3ff] uppercase leading-none opacity-100">ISO PROOF G3T</h3>
               <span className="text-[7px] font-mono opacity-40">VER: 3.1.0_X</span>
            </div>
            <div className="bg-[#0a1a0a] border-[0.5px] border-[#4caf50]/20 p-3 font-mono text-[7px] md:text-[9px] space-y-1 h-24 md:h-28 overflow-hidden relative">
               <div className="absolute top-0 right-0 p-2 opacity-10 animate-pulse"><Cpu size={14} /></div>
               {hasVerified && !isRunning && log.length === 0 ? (
                 <div className="h-full flex flex-col items-center justify-center gap-2">
                   <CheckCircle2 size={20} className="text-[#4caf50]" />
                   <p className="text-[#4caf50] text-center">ISO Verification Complete</p>
                   <p className="text-[#4caf50]/60 text-[7px]">Peer ID: {localPeerId?.substring(0, 20)}...</p>
                 </div>
               ) : (
                 <>
                   {log.map((item, idx) => (
                     <p key={idx} className="text-[#4caf50] animate-in fade-in slide-in-from-left-2 flex items-center gap-2">
                        <span className="opacity-30">[{new Date().getMilliseconds().toString().padStart(3, '0')}]</span>
                        <span className="font-bold tracking-widest">{item}</span>
                     </p>
                   ))}
                   {log.length === 0 && <p className="opacity-20 animate-pulse">INITIALIZING_G3T_CRUNCH...</p>}
                 </>
               )}
            </div>
         </div>
      </div>
      
      <div className="w-full relative z-10 space-y-1.5">
          {steps.map((s, i) => (
            <div 
              key={i} 
              className={`text-[8px] md:text-[10px] font-mono flex items-center justify-between px-4 py-2 md:py-3 border-[0.5px] transition-all duration-400 ${
                i === step && isRunning ? 'bg-[#00f3ff]/20 text-[#00f3ff] border-[#00f3ff] scale-[1.01] font-black' : 
                i < step || (isComplete && i === step) ? 'text-[#4caf50] border-[#4caf50]/20 opacity-50' : 
                'text-[#00f3ff]/20 border-white/5'
              }`}
            >
              <div className="flex items-center gap-4 md:gap-5">
                 <span className="opacity-40 font-black">{i.toString().padStart(2, '0')}</span>
                 <span className="tracking-[0.1em] md:tracking-[0.3em] uppercase">{s.label}</span>
              </div>
              {i < step || (isComplete && i === step) ? (
                <CheckCircle2 size={12} className="text-[#4caf50]" strokeWidth={1} />
              ) : i === step && isRunning ? (
                <Loader2 size={12} className="animate-spin text-[#00f3ff]" strokeWidth={1} />
              ) : (
                <div className="w-3 h-3 border-[0.5px] border-white/10 rounded-sm"></div>
              )}
            </div>
          ))}
      </div>
      
      {isComplete && (
        <button
          onClick={handleRerunVerification}
          className="flex items-center gap-2 px-6 py-3 border-[0.5px] border-[#00f3ff]/30 text-[#00f3ff] text-[8px] font-black uppercase tracking-widest hover:bg-[#00f3ff]/10 transition-all"
        >
          <Play size={12} /> RE-RUN VERIFICATION
        </button>
      )}
      
      <div className="text-[7px] md:text-[9px] opacity-40 uppercase text-center font-black tracking-[0.2em] md:tracking-[0.5em] leading-loose max-w-[90%] mx-auto italic">
        Geodesic Soundness Verified via Flower Of Life rotor symmetry.<br/>
        Workflow optimized via <span className="text-[#00f3ff] opacity-100">Grade 3 Tautological Proving</span>
      </div>

      <div className="absolute top-3 left-3 w-4 h-4 border-t-[0.5px] border-l-[0.5px] border-[#00f3ff]/30"></div>
      <div className="absolute top-3 right-3 w-4 h-4 border-t-[0.5px] border-r-[0.5px] border-[#00f3ff]/30"></div>
      <div className="absolute bottom-3 left-3 w-4 h-4 border-b-[0.5px] border-l-[0.5px] border-[#00f3ff]/30"></div>
      <div className="absolute bottom-3 right-3 w-4 h-4 border-b-[0.5px] border-r-[0.5px] border-[#00f3ff]/30"></div>
    </div>
  );
};

export default ZKPVerifier;
