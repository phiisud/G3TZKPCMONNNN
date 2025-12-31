import React, { useEffect, useState } from 'react';
import { Cpu, CheckCircle, AlertCircle, Clock, Hash } from 'lucide-react';
import { cryptoStateService, ZKPCircuit } from '../../services/CryptoStateService';

const ZKPCircuitRegistry: React.FC = () => {
  const [circuits, setCircuits] = useState<ZKPCircuit[]>([]);
  const [engineStatus, setEngineStatus] = useState<'production' | 'simulated' | 'offline'>('simulated');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCircuits = async () => {
      setIsLoading(true);
      try {
        const zkpState = await cryptoStateService.getZKPState();
        setCircuits(zkpState.circuits);
        setEngineStatus(zkpState.engineStatus);
      } finally {
        setIsLoading(false);
      }
    };

    fetchCircuits();
    const interval = setInterval(fetchCircuits, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: ZKPCircuit['status']) => {
    switch (status) {
      case 'active':
        return <CheckCircle size={14} className="text-green-400" />;
      case 'simulated':
        return <AlertCircle size={14} className="text-yellow-400" />;
      default:
        return <Clock size={14} className="text-gray-500" />;
    }
  };

  if (isLoading) {
    return (
      <div className="bg-black border border-cyan-800 rounded-lg p-4">
        <div className="animate-pulse text-cyan-400 font-mono">
          Loading ZKP circuits...
        </div>
      </div>
    );
  }

  return (
    <div className="bg-black border border-cyan-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-cyan-400 font-mono flex items-center gap-2">
          <Cpu size={18} />
          ZKP CIRCUIT REGISTRY
        </h3>
        <span className={`px-2 py-1 rounded text-xs font-mono ${
          engineStatus === 'production' ? 'bg-green-900 text-green-400' :
          engineStatus === 'simulated' ? 'bg-yellow-900 text-yellow-400' :
          'bg-red-900 text-red-400'
        }`}>
          {engineStatus.toUpperCase()}
        </span>
      </div>

      <div className="space-y-3">
        {circuits.map((circuit, index) => (
          <div 
            key={index}
            className="bg-gray-900 border border-gray-800 rounded p-3"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(circuit.status)}
                <span className="text-green-400 font-mono text-sm">{circuit.name}</span>
              </div>
              <span className="text-gray-500 font-mono text-xs">v{circuit.version}</span>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1 text-gray-400 font-mono">
                <Hash size={12} />
                <span>{circuit.constraints.toLocaleString()} constraints</span>
              </div>
              <div className="text-right text-gray-500 font-mono">
                {circuit.proofsGenerated} proofs
              </div>
            </div>

            {circuit.lastUsed && (
              <div className="mt-2 text-xs text-gray-600 font-mono">
                Last used: {new Date(circuit.lastUsed).toLocaleTimeString()}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-4 pt-3 border-t border-gray-800">
        <div className="text-xs font-mono text-gray-500 space-y-1">
          <div className="flex justify-between">
            <span>Groth16 proving system</span>
            <span className="text-cyan-400">Active</span>
          </div>
          <div className="flex justify-between">
            <span>BN254 curve</span>
            <span className="text-cyan-400">Configured</span>
          </div>
          <div className="flex justify-between">
            <span>snarkjs runtime</span>
            <span className="text-cyan-400">v0.7.0</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ZKPCircuitRegistry;
