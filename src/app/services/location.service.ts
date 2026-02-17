import { Injectable, signal } from '@angular/core';

export interface UserLocation {
  lat: number;
  lng: number;
  displayName: string;
}

const STORAGE_KEY = 'islamic-month-user-location';

@Injectable({
  providedIn: 'root',
})
export class LocationService {
  /** Reactive signal for the current user location (null if not set). */
  readonly location = signal<UserLocation | null>(null);

  constructor() {
    this.loadFromStorage();
  }

  setLocation(loc: UserLocation) {
    this.location.set(loc);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(loc));
    } catch {
      /* ignore */
    }
  }

  clearLocation() {
    this.location.set(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      /* ignore */
    }
  }

  /**
   * Request browser geolocation, reverse-geocode via Nominatim, and set location.
   * Resolves to true if location was obtained, false otherwise.
   */
  async requestBrowserLocation(): Promise<boolean> {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      return false;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 300000,
        });
      });

      const { latitude, longitude } = position.coords;

      // Reverse-geocode via Nominatim
      let displayName = `${latitude.toFixed(2)}, ${longitude.toFixed(2)}`;
      try {
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const data = await res.json();
        if (data?.display_name) {
          displayName = data.display_name.split(',').slice(0, 3).join(',');
        }
      } catch {
        /* use fallback coordinates display name */
      }

      this.setLocation({ lat: latitude, lng: longitude, displayName });
      return true;
    } catch {
      return false;
    }
  }

  private loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as UserLocation;
        if (parsed.lat != null && parsed.lng != null && parsed.displayName) {
          this.location.set(parsed);
        }
      }
    } catch {
      /* ignore */
    }
  }
}
