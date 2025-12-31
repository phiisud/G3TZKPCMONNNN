import axios from 'axios';
import { LocationCoordinates, SharedLocation, LocationPreview } from '../types/location';

class LocationSharingService {
  private watchId: number | null = null;
  private liveLocationCallbacks: Map<string, (coords: LocationCoordinates) => void> = new Map();

  async getCurrentLocation(): Promise<LocationCoordinates> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined
          });
        },
        (error) => {
          reject(new Error(`Geolocation error: ${error.message}`));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    });
  }

  async reverseGeocode(lat: number, lon: number): Promise<string> {
    try {
      const response = await axios.get(
        `https://nominatim.openstreetmap.org/reverse`,
        {
          params: {
            lat,
            lon,
            format: 'json',
            addressdetails: 1
          },
          headers: {
            'User-Agent': 'G3ZKP-Messenger/1.0'
          }
        }
      );

      if (response.data.display_name) {
        return response.data.display_name;
      }

      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    } catch (error) {
      console.error('[LocationService] Reverse geocode error:', error);
      return `${lat.toFixed(6)}, ${lon.toFixed(6)}`;
    }
  }

  calculateDistance(
    coord1: LocationCoordinates,
    coord2: LocationCoordinates
  ): number {
    const R = 6371e3;
    const φ1 = (coord1.latitude * Math.PI) / 180;
    const φ2 = (coord2.latitude * Math.PI) / 180;
    const Δφ = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
    const Δλ = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  }

  formatDistance(meters: number): string {
    if (meters < 1000) {
      return `${Math.round(meters)}m`;
    } else if (meters < 10000) {
      return `${(meters / 1000).toFixed(1)}km`;
    } else {
      return `${Math.round(meters / 1000)}km`;
    }
  }

  calculateETA(distanceMeters: number): number {
    const speedKmH = 50;
    const speedMS = (speedKmH * 1000) / 3600;
    return Math.round(distanceMeters / speedMS / 60);
  }

  formatETA(minutes: number): string {
    if (minutes < 1) {
      return '< 1 min';
    } else if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return `${hours}h ${mins}m`;
    }
  }

  async getLocationPreview(
    location: LocationCoordinates,
    currentLocation?: LocationCoordinates
  ): Promise<LocationPreview> {
    const address = await this.reverseGeocode(
      location.latitude,
      location.longitude
    );

    let distance: number | undefined;
    let eta: number | undefined;

    if (currentLocation) {
      distance = this.calculateDistance(currentLocation, location);
      eta = this.calculateETA(distance);
    }

    return {
      address,
      distance,
      eta
    };
  }

  startLiveLocationSharing(
    locationId: string,
    callback: (coords: LocationCoordinates) => void,
    intervalMs: number = 5000
  ): void {
    if (this.watchId !== null) {
      this.stopLiveLocationSharing();
    }

    this.liveLocationCallbacks.set(locationId, callback);

    this.watchId = navigator.geolocation.watchPosition(
      (position) => {
        const coords: LocationCoordinates = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          altitudeAccuracy: position.coords.altitudeAccuracy || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined
        };

        this.liveLocationCallbacks.forEach((cb) => cb(coords));
      },
      (error) => {
        console.error('[LocationService] Watch position error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  }

  stopLiveLocationSharing(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
    this.liveLocationCallbacks.clear();
  }

  getStaticMapUrl(
    lat: number,
    lon: number,
    zoom: number = 15,
    width: number = 300,
    height: number = 200
  ): string {
    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lon}&zoom=${zoom}&size=${width}x${height}&markers=${lat},${lon},red-pushpin`;
  }
}

export const locationSharingService = new LocationSharingService();
export default locationSharingService;
