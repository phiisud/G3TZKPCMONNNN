export interface LocationCoordinates {
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
}

export interface SharedLocation {
  id: string;
  coordinates: LocationCoordinates;
  address?: string;
  timestamp: number;
  senderId: string;
  recipientId: string;
  type: 'static' | 'live';
  expiresAt?: number;
  name?: string;
  venueType?: string;
}

export interface LiveLocationUpdate {
  locationId: string;
  coordinates: LocationCoordinates;
  timestamp: number;
  batteryLevel?: number;
}

export interface LocationPreview {
  address: string;
  thumbnail?: string;
  distance?: number;
  eta?: number;
}
