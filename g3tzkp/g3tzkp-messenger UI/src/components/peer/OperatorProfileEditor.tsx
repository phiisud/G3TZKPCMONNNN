import React, { useState, useEffect } from 'react';
import { User, Edit2, Save, X } from 'lucide-react';
import { operatorProfileService } from '@/services/OperatorProfileService';
import { OperatorProfile } from '@/types/peer';

interface OperatorProfileEditorProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OperatorProfileEditor: React.FC<OperatorProfileEditorProps> = ({ isOpen, onClose }) => {
  const [profile, setProfile] = useState<OperatorProfile | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const currentProfile = operatorProfileService.getLocalProfile();
      if (currentProfile) {
        setProfile(currentProfile);
        setDisplayName(currentProfile.displayName);
        setBio(currentProfile.bio || '');
      }
    }
  }, [isOpen]);

  if (!isOpen || !profile) return null;

  const handleSave = async () => {
    setError(null);
    setIsSaving(true);

    try {
      if (displayName !== profile.displayName) {
        await operatorProfileService.updateDisplayName(displayName);
      }

      if (bio !== (profile.bio || '')) {
        await operatorProfileService.updateBio(bio);
      }

      const updated = operatorProfileService.getLocalProfile();
      if (updated) {
        setProfile(updated);
      }

      setIsEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save profile');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setDisplayName(profile.displayName);
    setBio(profile.bio || '');
    setIsEditing(false);
    setError(null);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold">Operator Profile</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center">
              <User size={40} className="text-blue-600" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium text-gray-500">Peer ID:</span>
                {!isEditing && (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="ml-auto text-blue-600 hover:text-blue-700 flex items-center gap-1 text-sm"
                  >
                    <Edit2 size={16} /> Edit
                  </button>
                )}
              </div>
              <code className="text-xs bg-gray-100 px-2 py-1 rounded font-mono block">
                {profile.peerId}
              </code>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50"
              disabled={!isEditing || isSaving}
              maxLength={50}
            />
            <p className="text-xs text-gray-500 mt-1">
              {displayName.length}/50 characters
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Bio (Optional)
            </label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 resize-none"
              disabled={!isEditing || isSaving}
              maxLength={500}
              rows={4}
              placeholder="Tell other operators about yourself..."
            />
            <p className="text-xs text-gray-500 mt-1">
              {bio.length}/500 characters
            </p>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <span className="text-gray-500">Status:</span>
            <span className={`font-medium ${profile.isOnline ? 'text-green-600' : 'text-gray-400'}`}>
              {profile.isOnline ? '🟢 Online' : '⚫ Offline'}
            </span>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {isEditing && (
            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={handleCancel}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                disabled={isSaving}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                disabled={isSaving || displayName.trim().length < 2}
              >
                <Save size={18} />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>

        <div className="px-6 pb-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-xs text-blue-800">
              💡 Your display name and bio are shared with peers you connect to. Choose a name that helps them recognize you.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
