import React, { useState } from 'react';
import { X } from 'lucide-react';
import { peerContactService } from '@/services/PeerContactService';

interface AddPeerContactDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const AddPeerContactDialog: React.FC<AddPeerContactDialogProps> = ({ isOpen, onClose, onSuccess }) => {
  const [peerId, setPeerId] = useState('');
  const [contactName, setContactName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      await peerContactService.addContact({
        peerId: peerId.trim(),
        contactName: contactName.trim()
      });

      setPeerId('');
      setContactName('');
      onSuccess?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add contact');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Add Peer Contact</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Peer ID *
            </label>
            <input
              type="text"
              value={peerId}
              onChange={(e) => setPeerId(e.target.value)}
              placeholder="G3-XXXXXXXXXXXX..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the peer's G3TZKP ID (starts with G3-)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Contact Name *
            </label>
            <input
              type="text"
              value={contactName}
              onChange={(e) => setContactName(e.target.value)}
              placeholder="John Doe"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
              disabled={isLoading}
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-1">
              Give this peer a name you'll remember
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
              disabled={isLoading || !peerId.trim() || !contactName.trim()}
            >
              {isLoading ? 'Adding...' : 'Add Contact'}
            </button>
          </div>
        </form>

        <div className="px-6 pb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-sm text-blue-900 mb-2">💡 How it works:</h3>
            <ul className="text-xs text-blue-800 space-y-1">
              <li>• Copy the peer ID from the other person</li>
              <li>• Paste it here and give them a contact name</li>
              <li>• They'll appear in your contacts instantly</li>
              <li>• You'll see their operator profile when they connect</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};
