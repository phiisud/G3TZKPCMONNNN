import React, { useState, useRef } from 'react';
import {
  X, Upload, Plus, Trash2, MapPin, DollarSign, Image as ImageIcon,
  Edit2, Save, ChevronRight, Camera, ShoppingBag
} from 'lucide-react';
import { useThemeStore } from '../stores/themeStore';
import { G3TZKPBusinessProfile, BusinessPhoto, BusinessProduct } from '../types/business';
import { businessProfileService } from '../services/BusinessProfileService';
import { businessP2PUpdateService } from '../services/BusinessP2PUpdateService';

interface BusinessProfileModalProps {
  profile: G3TZKPBusinessProfile;
  onClose: () => void;
  onSave: (profile: G3TZKPBusinessProfile) => void;
}

type TabType = 'overview' | 'photos' | 'bio' | 'products' | 'map';

const BusinessProfileModal: React.FC<BusinessProfileModalProps> = ({ profile, onClose, onSave }) => {
  const theme = useThemeStore((state) => state.getCurrentTheme());
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [editedProfile, setEditedProfile] = useState<G3TZKPBusinessProfile>(profile);
  const [isEditing, setIsEditing] = useState(false);
  const [newProduct, setNewProduct] = useState({ name: '', description: '', price: 0 });
  const [selectedPhotos, setSelectedPhotos] = useState<string[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [bioWordCount, setBioWordCount] = useState(profile.bioWordCount || 0);

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || (editedProfile.photos?.length || 0) >= 9) {
      alert('Maximum 9 photos allowed');
      return;
    }

    const newPhotos: BusinessPhoto[] = [];
    for (let i = 0; i < Math.min(files.length, 9 - (editedProfile.photos?.length || 0)); i++) {
      const file = files[i];
      const url = URL.createObjectURL(file);
      newPhotos.push({
        id: `photo-${Date.now()}-${i}`,
        url,
        uploadedAt: Date.now(),
        order: (editedProfile.photos?.length || 0) + i
      });
    }

    const updated = {
      ...editedProfile,
      photos: [...(editedProfile.photos || []), ...newPhotos]
    };
    setEditedProfile(updated);
  };

  const removePhoto = (photoId: string) => {
    const updated = {
      ...editedProfile,
      photos: (editedProfile.photos || [])
        .filter(p => p.id !== photoId)
        .map((p, idx) => ({ ...p, order: idx }))
    };
    setEditedProfile(updated);
  };

  const addProduct = async () => {
    if (!newProduct.name || newProduct.price <= 0) {
      alert('Please fill in product details');
      return;
    }

    if ((editedProfile.products?.length || 0) >= 100) {
      alert('Maximum products limit reached');
      return;
    }

    const product: BusinessProduct = {
      id: `product-${Date.now()}`,
      name: newProduct.name,
      description: newProduct.description,
      price: newProduct.price,
      createdAt: Date.now()
    };

    const updated = {
      ...editedProfile,
      products: [...(editedProfile.products || []), product]
    };
    setEditedProfile(updated);
    setNewProduct({ name: '', description: '', price: 0 });
  };

  const removeProduct = (productId: string) => {
    const updated = {
      ...editedProfile,
      products: (editedProfile.products || []).filter(p => p.id !== productId),
      featuredProductIds: (editedProfile.featuredProductIds || []).filter(id => id !== productId)
    };
    setEditedProfile(updated);
  };

  const toggleFeaturedProduct = (productId: string) => {
    const isFeatured = editedProfile.featuredProductIds?.includes(productId);
    const newFeatured = isFeatured
      ? editedProfile.featuredProductIds?.filter(id => id !== productId) || []
      : [...(editedProfile.featuredProductIds || []), productId].slice(0, 3);

    const updated = {
      ...editedProfile,
      featuredProductIds: newFeatured
    };
    setEditedProfile(updated);
  };

  const updateBio = (bio: string) => {
    const wordCount = bio.trim().split(/\s+/).filter(w => w.length > 0).length;
    if (wordCount <= 200) {
      const updated = {
        ...editedProfile,
        bio,
        bioWordCount: wordCount
      };
      setEditedProfile(updated);
      setBioWordCount(wordCount);
    }
  };

  const handleSave = async () => {
    try {
      await businessProfileService.updateBusinessProfile({
        id: editedProfile.id,
        bio: editedProfile.bio,
        description: editedProfile.description,
        category: editedProfile.category,
        contact: editedProfile.contact,
        hours: editedProfile.hours
      });

      await businessP2PUpdateService.publishProfileUpdate(editedProfile);
      onSave(editedProfile);
      setIsEditing(false);
    } catch (error) {
      alert(`Failed to save profile: ${error}`);
    }
  };

  const handlePublish = async () => {
    if (!editedProfile.photos || editedProfile.photos.length === 0) {
      alert('Add at least one photo to publish');
      return;
    }
    if (!editedProfile.bio || editedProfile.bio.trim().length === 0) {
      alert('Add a bio to publish');
      return;
    }

    try {
      await businessProfileService.publishProfile(editedProfile.id);
      const updated = { ...editedProfile, isPublished: true };
      setEditedProfile(updated);
      await businessP2PUpdateService.publishProfileCreation(updated);
      onSave(updated);
    } catch (error) {
      alert(`Failed to publish: ${error}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div
        className="bg-black rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border-2"
        style={{ borderColor: theme.colors.primary }}
      >
        <div
          className="flex justify-between items-center p-6 border-b"
          style={{ borderColor: theme.colors.border }}
        >
          <h2 className="text-2xl font-bold flex items-center gap-2" style={{ color: theme.colors.primary }}>
            <ShoppingBag size={24} />
            {editedProfile.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="flex gap-4 p-4 border-b" style={{ borderColor: theme.colors.border }}>
          {(['overview', 'photos', 'bio', 'products', 'map'] as TabType[]).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className="px-4 py-2 rounded transition capitalize font-semibold"
              style={{
                backgroundColor: activeTab === tab ? theme.colors.primary : 'transparent',
                color: activeTab === tab ? theme.colors.background : theme.colors.textSecondary,
                borderBottom: activeTab === tab ? `2px solid ${theme.colors.primary}` : 'none'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2" style={{ color: theme.colors.textSecondary }}>
                  Business Name
                </label>
                <input
                  type="text"
                  value={editedProfile.name}
                  disabled
                  className="w-full bg-gray-900 border-2 rounded px-3 py-2"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                />
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: theme.colors.textSecondary }}>
                  Category
                </label>
                <select
                  value={editedProfile.category}
                  onChange={(e) => setEditedProfile({ ...editedProfile, category: e.target.value })}
                  disabled={!isEditing}
                  className="w-full bg-gray-900 border-2 rounded px-3 py-2"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                >
                  <option>retail</option>
                  <option>restaurant</option>
                  <option>service</option>
                  <option>professional</option>
                </select>
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: theme.colors.textSecondary }}>
                  Description
                </label>
                <textarea
                  value={editedProfile.description}
                  onChange={(e) => setEditedProfile({ ...editedProfile, description: e.target.value })}
                  disabled={!isEditing}
                  className="w-full bg-gray-900 border-2 rounded px-3 py-2 h-24"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm mb-2" style={{ color: theme.colors.textSecondary }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={editedProfile.contact?.email}
                    onChange={(e) => setEditedProfile({
                      ...editedProfile,
                      contact: { ...editedProfile.contact, email: e.target.value }
                    })}
                    disabled={!isEditing}
                    className="w-full bg-gray-900 border-2 rounded px-3 py-2"
                    style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                  />
                </div>
                <div>
                  <label className="block text-sm mb-2" style={{ color: theme.colors.textSecondary }}>
                    Phone
                  </label>
                  <input
                    type="tel"
                    value={editedProfile.contact?.phone}
                    onChange={(e) => setEditedProfile({
                      ...editedProfile,
                      contact: { ...editedProfile.contact, phone: e.target.value }
                    })}
                    disabled={!isEditing}
                    className="w-full bg-gray-900 border-2 rounded px-3 py-2"
                    style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm mb-2" style={{ color: theme.colors.textSecondary }}>
                  📍 Location
                </label>
                <p style={{ color: theme.colors.text }}>
                  {editedProfile.location.latitude.toFixed(4)}, {editedProfile.location.longitude.toFixed(4)}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'photos' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2 font-semibold" style={{ color: theme.colors.primary }}>
                  Photos ({editedProfile.photos?.length || 0}/9)
                </label>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!isEditing || (editedProfile.photos?.length || 0) >= 9}
                  className="w-full py-3 rounded border-2 border-dashed flex items-center justify-center gap-2 transition"
                  style={{
                    borderColor: theme.colors.primary,
                    color: (editedProfile.photos?.length || 0) >= 9 ? theme.colors.textSecondary : theme.colors.primary,
                    opacity: (editedProfile.photos?.length || 0) >= 9 ? 0.5 : 1
                  }}
                >
                  <Upload size={20} />
                  {(editedProfile.photos?.length || 0) >= 9 ? 'Maximum photos reached' : 'Click to upload photos'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                {editedProfile.photos?.map((photo) => (
                  <div
                    key={photo.id}
                    className="relative group rounded overflow-hidden"
                    style={{ aspectRatio: '1/1' }}
                  >
                    <img src={photo.url} alt="Business" className="w-full h-full object-cover" />
                    {isEditing && (
                      <button
                        onClick={() => removePhoto(photo.id)}
                        className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-75 flex items-center justify-center transition"
                      >
                        <Trash2 size={20} style={{ color: theme.colors.error }} className="opacity-0 group-hover:opacity-100" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'bio' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm mb-2 font-semibold" style={{ color: theme.colors.primary }}>
                  Business Bio ({bioWordCount}/200 words)
                </label>
                <textarea
                  value={editedProfile.bio}
                  onChange={(e) => updateBio(e.target.value)}
                  disabled={!isEditing}
                  maxLength={1000}
                  className="w-full h-48 bg-gray-900 border-2 rounded px-3 py-2"
                  style={{
                    borderColor: bioWordCount > 200 ? theme.colors.error : theme.colors.border,
                    color: theme.colors.text
                  }}
                  placeholder="Tell customers about your business..."
                />
                <p className="text-xs mt-2" style={{
                  color: bioWordCount > 200 ? theme.colors.error : theme.colors.textSecondary
                }}>
                  {bioWordCount > 200 ? '⚠️ Exceeds 200 word limit' : 'Characters: ' + (editedProfile.bio?.length || 0)}
                </p>
              </div>
            </div>
          )}

          {activeTab === 'products' && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3 pb-4 border-b" style={{ borderColor: theme.colors.border }}>
                <input
                  type="text"
                  placeholder="Product name"
                  value={newProduct.name}
                  onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  disabled={!isEditing}
                  className="bg-gray-900 border-2 rounded px-3 py-2"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                />
                <input
                  type="number"
                  placeholder="Price (£)"
                  value={newProduct.price}
                  onChange={(e) => setNewProduct({ ...newProduct, price: parseFloat(e.target.value) || 0 })}
                  disabled={!isEditing}
                  className="bg-gray-900 border-2 rounded px-3 py-2"
                  style={{ borderColor: theme.colors.border, color: theme.colors.text }}
                />
                <button
                  onClick={addProduct}
                  disabled={!isEditing}
                  className="bg-green-900 hover:bg-green-800 rounded px-4 py-2 transition flex items-center justify-center gap-2"
                  style={{ color: theme.colors.text }}
                >
                  <Plus size={18} />
                  Add
                </button>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold" style={{ color: theme.colors.primary }}>
                  Products ({editedProfile.products?.length || 0})
                </label>
                {editedProfile.products?.map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between p-3 rounded border-2"
                    style={{ borderColor: theme.colors.border }}
                  >
                    <div>
                      <p style={{ color: theme.colors.text }}>{product.name}</p>
                      <p style={{ color: theme.colors.textSecondary }} className="text-sm">
                        £{product.price.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleFeaturedProduct(product.id)}
                        className={`px-3 py-1 rounded text-sm transition ${
                          editedProfile.featuredProductIds?.includes(product.id)
                            ? 'bg-yellow-900 text-yellow-100'
                            : 'bg-gray-900 text-gray-300'
                        }`}
                        disabled={!isEditing}
                      >
                        ⭐ {editedProfile.featuredProductIds?.includes(product.id) ? 'Featured' : 'Feature'}
                      </button>
                      {isEditing && (
                        <button
                          onClick={() => removeProduct(product.id)}
                          className="text-red-500 hover:text-red-400"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'map' && (
            <div>
              <p style={{ color: theme.colors.textSecondary }}>
                Business location on map will be displayed here with exact coordinates.
              </p>
              <p className="text-sm mt-2" style={{ color: theme.colors.text }}>
                📍 {editedProfile.location.latitude.toFixed(6)}, {editedProfile.location.longitude.toFixed(6)}
              </p>
            </div>
          )}
        </div>

        <div
          className="flex justify-end gap-3 p-6 border-t"
          style={{ borderColor: theme.colors.border }}
        >
          {!isEditing ? (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="px-6 py-2 rounded flex items-center gap-2 transition"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background
                }}
              >
                <Edit2 size={18} />
                Edit
              </button>
              {!editedProfile.isPublished && (
                <button
                  onClick={handlePublish}
                  className="px-6 py-2 rounded flex items-center gap-2 transition bg-green-900 hover:bg-green-800"
                  style={{ color: theme.colors.text }}
                >
                  Publish
                </button>
              )}
            </>
          ) : (
            <>
              <button
                onClick={() => {
                  setEditedProfile(profile);
                  setIsEditing(false);
                }}
                className="px-6 py-2 rounded transition"
                style={{
                  backgroundColor: theme.colors.border,
                  color: theme.colors.text
                }}
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded flex items-center gap-2 transition"
                style={{
                  backgroundColor: theme.colors.primary,
                  color: theme.colors.background
                }}
              >
                <Save size={18} />
                Save Changes
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default BusinessProfileModal;
