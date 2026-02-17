import { Component, signal, inject, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LocationService, type UserLocation } from '../services/location.service';

@Component({
  selector: 'app-location-dialog',
  imports: [CommonModule, FormsModule],
  templateUrl: './location-dialog.component.html',
  styleUrl: './location-dialog.component.scss',
})
export class LocationDialogComponent {
  private readonly locationService = inject(LocationService);
  
  readonly close = output<void>();
  
  locationQuery = '';
  readonly searching = signal(false);
  readonly gettingBrowser = signal(false);
  readonly locationError = signal<string | null>(null);

  async getBrowserLocation() {
    this.gettingBrowser.set(true);
    this.locationError.set(null);

    const result = await this.locationService.requestBrowserLocation();
    
    this.gettingBrowser.set(false);
    
    if (result === 'success') {
      this.close.emit();
    } else if (result === 'denied') {
      this.locationError.set('Location permission denied. To enable: Click the location icon in your browser\'s address bar and allow location access, then try again.');
    } else {
      this.locationError.set('Browser location not available. Please search manually.');
    }
  }

  async searchLocation() {
    const query = this.locationQuery.trim();
    if (!query) return;

    this.searching.set(true);
    this.locationError.set(null);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=1&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
      const data = await res.json();

      if (data?.length > 0) {
        const result = data[0];
        const loc: UserLocation = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          displayName: this.locationService.formatAddress(result.address, query),
        };
        this.locationService.setLocation(loc);
        this.locationQuery = '';
        this.close.emit();
      } else {
        this.locationError.set('Location not found. Try a different search.');
      }
    } catch {
      this.locationError.set('Network error. Please try again.');
    } finally {
      this.searching.set(false);
    }
  }

  closeDialog() {
    this.close.emit();
  }
}
