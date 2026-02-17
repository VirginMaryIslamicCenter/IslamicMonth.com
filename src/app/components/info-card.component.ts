import { Component, input, inject } from '@angular/core';
import { VisibilityGrid } from '../services/islamic-month.service';
import { LocationService, type UserLocation } from '../services/location.service';
import { LocationDialogService } from '../services/location-dialog.service';

@Component({
  selector: 'app-info-card',
  templateUrl: './info-card.component.html',
  styleUrl: './info-card.component.scss',
})
export class InfoCardComponent {
  readonly grid = input.required<VisibilityGrid>();
  readonly monthName = input.required<string>();
  readonly actionLine = input.required<string>();
  readonly specialDates = input.required<{ label: string; date: string }[]>();
  readonly sightingDate = input.required<string>();

  readonly locationService = inject(LocationService);
  readonly locationDialogService = inject(LocationDialogService);

  getLocalCategory(): string {
    const loc = this.locationService.location();
    if (!loc) return 'none';
    const grid = this.grid();
    let nearest = grid.results[0];
    let minDist = Infinity;
    for (const r of grid.results) {
      const d = Math.abs(r.lat - loc.lat) + Math.abs(r.lng - loc.lng);
      if (d < minDist) {
        minDist = d;
        nearest = r;
      }
    }
    return nearest?.category ?? 'E';
  }

  getLocalIcon(): string {
    const cat = this.getLocalCategory();
    switch (cat) {
      case 'A':
        return '/assets/icons/easily-visible.svg';
      case 'B':
        return '/assets/icons/visible-conditions.svg';
      case 'C':
        return '/assets/icons/optical-aid.svg';
      case 'D':
        return '/assets/icons/optical-aid.svg';
      default:
        return '/assets/icons/not-visible.svg';
    }
  }

  getLocalDescription(): string {
    const cat = this.getLocalCategory();
    switch (cat) {
      case 'A':
        return 'Easily visible with the naked eye';
      case 'B':
        return 'Visible with the naked eye in perfect conditions';
      case 'C':
        return 'Need optical aid (binoculars) to find, then visible with naked eye';
      case 'D':
        return 'Only visible with optical aid (telescope / binoculars)';
      default:
        return 'Moon not visible';
    }
  }
}
