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
   * Build a clean "City, State, Country" or "City, Country" string
   * from Nominatim's structured address object, using abbreviations.
   */
  formatAddress(address: Record<string, string> | undefined, fallback: string): string {
    if (!address) return fallback;
    const city = address['city'] || address['town'] || address['village'] || address['hamlet'] || address['municipality'] || '';
    // Use ISO 3166-2 state code (e.g. "US-CA" → "CA") if available, else full name
    const iso = address['ISO3166-2-lvl4'] || address['ISO3166-2-lvl6'] || '';
    const state = iso ? iso.split('-').pop()! : (address['state'] || address['province'] || address['region'] || '');
    // Use country_code (e.g. "us" → "US") if available, else full name
    const country = address['country_code'] ? address['country_code'].toUpperCase() : (address['country'] || '');
    const parts = [city, state, country].filter(Boolean);
    return parts.length > 0 ? parts.join(', ') : fallback;
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
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&addressdetails=1&lat=${latitude}&lon=${longitude}`;
        const res = await fetch(url, { headers: { Accept: 'application/json' } });
        const data = await res.json();
        displayName = this.formatAddress(data?.address, displayName);
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
