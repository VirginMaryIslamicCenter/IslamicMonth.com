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
