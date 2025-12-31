import React, { useState } from 'react';
import { Radio, Clock, X, Check } from 'lucide-react';

interface LiveLocationShareProps {
  onStart: (duration: number) => void;
  onClose: () => void;
}

const DURATIONS = [
  { label: '15 minutes', value: 15 * 60 * 1000 },
  { label: '1 hour', value: 60 * 60 * 1000 },
  { label: '8 hours', value: 8 * 60 * 60 * 1000 },
];

export function LiveLocationShare({ onStart, onClose }: LiveLocationShareProps) {
  const [selectedDuration, setSelectedDuration] = useState(DURATIONS[0].value);

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-cyan-500/30 rounded-lg max-w-md w-full">
        <div className="p-4 border-b border-gray-800 flex items-center justify-between">
          <h2 className="text-xl font-bold text-cyan-400">Share Live Location</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-cyan-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <Radio className="w-8 h-8 text-cyan-400 animate-pulse" />
            </div>
            <h3 className="text-lg font-bold text-white mb-2">Live Location Sharing</h3>
            <p className="text-sm text-gray-400">
              Your real-time location will be shared and automatically updated
            </p>
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              <Clock className="w-4 h-4 inline mr-2" />
              Duration
            </label>
            {DURATIONS.map((duration) => (
              <button
                key={duration.value}
                onClick={() => setSelectedDuration(duration.value)}
                className={`w-full px-4 py-3 rounded-lg border-2 transition-all ${
                  selectedDuration === duration.value
                    ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400'
                    : 'border-gray-700 bg-gray-800 text-gray-300 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{duration.label}</span>
                  {selectedDuration === duration.value && (
                    <Check className="w-5 h-5" />
                  )}
                </div>
              </button>
            ))}
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
            <p className="text-xs text-yellow-400">
              <strong>Note:</strong> Live location sharing will continuously update your position
              and consume battery. You can stop sharing at any time.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 bg-gray-800 text-white font-bold rounded-lg hover:bg-gray-700 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onStart(selectedDuration)}
              className="flex-1 px-6 py-3 bg-cyan-500 text-black font-bold rounded-lg hover:bg-cyan-400 transition-colors flex items-center justify-center gap-2"
            >
              <Radio className="w-5 h-5" />
              Start Sharing
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default LiveLocationShare;
