import React, { useState } from 'react';
import { Store, MapPin, Phone, Globe, Clock, Star, ShoppingBag, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { G3TZKPBusinessProfile, BusinessProduct } from '@/types/business';
import { businessCallingService } from '@/services/BusinessCallingService';
import { BusinessCallButton } from './BusinessCallButton';

interface BusinessStorefrontDisplayProps {
  business: G3TZKPBusinessProfile;
  isOpen: boolean;
  onClose: () => void;
  onCallBusiness?: (businessId: string) => void;
}

export const BusinessStorefrontDisplay: React.FC<BusinessStorefrontDisplayProps> = ({
  business,
  isOpen,
  onClose,
  onCallBusiness
}) => {
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState(0);
  const [selectedProduct, setSelectedProduct] = useState<BusinessProduct | null>(null);

  if (!isOpen) return null;

  const photos = business.photos || [];
  const products = business.products || [];
  const featuredProducts = products.filter(p => business.featuredProductIds?.includes(p.id));

  const nextPhoto = () => {
    setSelectedPhotoIndex((prev) => (prev + 1) % photos.length);
  };

  const prevPhoto = () => {
    setSelectedPhotoIndex((prev) => (prev - 1 + photos.length) % photos.length);
  };

  const availability = businessCallingService.checkBusinessAvailability(business);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full my-8">
        <div className="relative">
          {photos.length > 0 && (
            <div className="relative h-80 bg-gray-200 rounded-t-lg overflow-hidden">
              <img
                src={photos[selectedPhotoIndex].url}
                alt={photos[selectedPhotoIndex].caption || business.name}
                className="w-full h-full object-cover"
              />
              {photos.length > 1 && (
                <>
                  <button
                    onClick={prevPhoto}
                    className="absolute left-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={nextPhoto}
                    className="absolute right-4 top-1/2 -translate-y-1/2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70"
                  >
                    <ChevronRight size={24} />
                  </button>
                  <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
                    {photos.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedPhotoIndex(idx)}
                        className={`w-2 h-2 rounded-full ${
                          idx === selectedPhotoIndex ? 'bg-white' : 'bg-white/50'
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          <button
            onClick={onClose}
            className="absolute top-4 right-4 bg-white text-gray-700 p-2 rounded-full shadow-lg hover:bg-gray-100"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <h1 className="text-3xl font-bold mb-2">{business.name}</h1>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Store size={16} />
                  <span className="capitalize">{business.category}</span>
                  {business.zkpVerified && (
                    <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full text-xs font-medium">
                      ✓ Verified
                    </span>
                  )}
                </div>
              </div>
              
              <BusinessCallButton
                business={business}
                onCallInitiated={onCallBusiness}
              />
            </div>

            <div className="flex items-center gap-1 text-yellow-500 mb-4">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star key={star} size={18} fill="currentColor" />
              ))}
              <span className="text-sm text-gray-600 ml-2">(4.8)</span>
            </div>
          </div>

          {business.bio && (
            <div>
              <h3 className="font-semibold mb-2">About</h3>
              <p className="text-gray-700 text-sm leading-relaxed">{business.bio}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <MapPin size={20} className="text-gray-400 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium">Address</p>
                  <p className="text-gray-600">
                    {business.location.address.line1}<br />
                    {business.location.address.city}, {business.location.address.postcode}
                  </p>
                </div>
              </div>

              {business.contact.phone && (
                <div className="flex items-center gap-3">
                  <Phone size={20} className="text-gray-400" />
                  <div className="text-sm">
                    <p className="font-medium">Phone</p>
                    <p className="text-gray-600">{business.contact.phone}</p>
                  </div>
                </div>
              )}

              {business.contact.website && (
                <div className="flex items-center gap-3">
                  <Globe size={20} className="text-gray-400" />
                  <div className="text-sm">
                    <p className="font-medium">Website</p>
                    <a
                      href={business.contact.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline"
                    >
                      {business.contact.website}
                    </a>
                  </div>
                </div>
              )}
            </div>

            <div>
              <div className="flex items-start gap-3">
                <Clock size={20} className="text-gray-400 mt-0.5" />
                <div className="text-sm flex-1">
                  <p className="font-medium mb-2">Opening Hours</p>
                  <div className="space-y-1">
                    {Object.entries(business.hours).map(([day, hours]) => (
                      <div key={day} className="flex justify-between text-xs">
                        <span className="capitalize font-medium">{day}</span>
                        <span className="text-gray-600">
                          {hours ? `${hours.open} - ${hours.close}` : 'Closed'}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2">
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                      availability.isOpen
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {availability.isOpen ? '🟢 Open Now' : '🔴 Closed'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {featuredProducts.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <ShoppingBag size={20} />
                <h3 className="font-semibold">Featured Products</h3>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {featuredProducts.map((product) => (
                  <div
                    key={product.id}
                    className="border rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => setSelectedProduct(product)}
                  >
                    {product.imageUrl && (
                      <img
                        src={product.imageUrl}
                        alt={product.name}
                        className="w-full h-32 object-cover rounded-lg mb-3"
                      />
                    )}
                    <h4 className="font-semibold text-sm mb-1">{product.name}</h4>
                    <p className="text-xs text-gray-600 mb-2 line-clamp-2">{product.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-blue-600">
                        {product.currency} {product.price.toFixed(2)}
                      </span>
                      {!product.inStock && (
                        <span className="text-xs text-red-600">Out of Stock</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {selectedProduct && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-lg w-full p-6">
            <div className="flex items-start justify-between mb-4">
              <h3 className="text-xl font-bold">{selectedProduct.name}</h3>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                <X size={24} />
              </button>
            </div>
            {selectedProduct.imageUrl && (
              <img
                src={selectedProduct.imageUrl}
                alt={selectedProduct.name}
                className="w-full h-64 object-cover rounded-lg mb-4"
              />
            )}
            <p className="text-gray-700 mb-4">{selectedProduct.description}</p>
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-blue-600">
                {selectedProduct.currency} {selectedProduct.price.toFixed(2)}
              </span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                selectedProduct.inStock
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {selectedProduct.inStock ? 'In Stock' : 'Out of Stock'}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
