import { Component, signal, inject, OnInit, OnDestroy, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import {
  IslamicMonthService,
  VisibilityGrid,
  VisibilityCategory,
  IslamicMonthEntry,
} from '../services/islamic-month.service';
import { LocationService } from '../services/location.service';
import { MoonMapComponent } from '../components/moon-map.component';

@Component({
  selector: 'app-month-detail',
  imports: [CommonModule, MoonMapComponent],
  templateUrl: './month-detail.component.html',
  styleUrl: './month-detail.component.scss',
})
export class MonthDetailComponent implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly moonService = inject(IslamicMonthService);
  readonly locationService = inject(LocationService);
  private sub!: Subscription;

  readonly monthEntry = signal<IslamicMonthEntry | null>(null);

  readonly computing = signal(false);
  readonly computingStep = signal(0);
  readonly visibilityGrids = signal<VisibilityGrid[]>([]);
  readonly notFound = signal(false);

  ngOnInit() {
    this.sub = this.route.params.subscribe((params) => {
      const year = params['year'];
      const month = params['month'];
      this.loadMonth(year, month);
    });
  }

  ngOnDestroy() {
    this.sub?.unsubscribe();
  }

  private async loadMonth(yearStr: string, monthSlug: string) {
    this.computing.set(true);
    this.visibilityGrids.set([]);
    this.notFound.set(false);

    const months = this.moonService.getUpcomingIslamicMonths(new Date(), 12);
    const entry = this.moonService.findMonthByRoute(yearStr, monthSlug, months);

    if (!entry) {
      this.notFound.set(true);
      this.computing.set(false);
      // Redirect after a short delay
      setTimeout(() => {
        const fallback = this.moonService.getNearestMonthRoute(months);
        this.router.navigateByUrl(fallback);
      }, 1500);
      return;
    }

    this.monthEntry.set(entry);

    const dayLabels = [
      'New Moon Day (Conjunction)',
      '+1 Day After New Moon',
      '+2 Days After New Moon',
    ];
    const grids: VisibilityGrid[] = [];

    for (let i = 0; i < entry.mapDates.length; i++) {
      this.computingStep.set(i + 1);
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const grid = this.moonService.calculateVisibilityGrid(entry.mapDates[i], 'waxing', 4);
          grid.dayLabel = dayLabels[i];
          grid.islamicMonthLabel = `${entry.name} ${entry.year} AH`;
          grids.push(grid);
          resolve();
        }, 30);
      });
    }

    this.visibilityGrids.set(grids);
    this.computing.set(false);
  }

  getEveningTitle(mapDate: Date): string {
    return mapDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });
  }

  formatShortDate(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  getActionLine(mapDate: Date): string {
    const entry = this.monthEntry();
    if (!entry) return '';

    const dayAfter = new Date(mapDate);
    dayAfter.setDate(dayAfter.getDate() + 1);
    const dayStr = dayAfter.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    if (entry.name === 'Ramadan') {
      return `Fasting will begin on ${dayStr}`;
    }
    if (entry.name === 'Shawwal') {
      return `Eid Prayers will be on ${dayStr}`;
    }
    return `Day of ${dayStr}`;
  }

  /** Find the nearest grid point to the user's location and return its category. */
  getLocalCategory(grid: VisibilityGrid): string {
    const loc = this.locationService.location();
    if (!loc) return 'none';

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

  getLocalIcon(grid: VisibilityGrid): string {
    const cat = this.getLocalCategory(grid);
    switch (cat) {
      case 'A':
        return '👁️';
      case 'B':
        return '👁️';
      case 'C':
        return '🔭';
      case 'D':
        return '🔭';
      default:
        return '🚫';
    }
  }

  getLocalDescription(grid: VisibilityGrid): string {
    const cat = this.getLocalCategory(grid);
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
        return 'Moon not expected to be visible';
    }
  }
}
