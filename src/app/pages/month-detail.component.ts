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
import { InfoCardComponent } from '../components/info-card.component';

@Component({
  selector: 'app-month-detail',
  imports: [CommonModule, MoonMapComponent, InfoCardComponent],
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

  /** Grids to display: stop showing after a grid where the user's location is category A */
  readonly displayGrids = computed(() => {
    const grids = this.visibilityGrids();
    const loc = this.locationService.location();
    if (!loc) return grids;

    const result: VisibilityGrid[] = [];
    for (const grid of grids) {
      result.push(grid);
      // If this grid is "easily visible" at user's location, no need to show later dates
      const cat = this.getLocalCategoryForGrid(grid, loc);
      if (cat === 'A') break;
    }
    return result;
  });

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
      weekday: 'short',
      year: 'numeric',
      month: 'short',
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
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    });

    if (entry.name === 'Ramadan') {
      return `Fasting would therefore begin on ${dayStr}`;
    }
    if (entry.name === 'Shawwal') {
      return `Eid Prayers would therefore be on ${dayStr}`;
    }
    return `Day of ${dayStr}`;
  }

  getSpecialDates(mapDate: Date): { label: string; date: string }[] {
    const entry = this.monthEntry();
    if (!entry) return [];

    const firstDay = new Date(mapDate);
    firstDay.setDate(firstDay.getDate() + 1);

    const formatDate = (d: Date) =>
      d.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });

    if (entry.name === 'Muharram') {
      const ashura = new Date(firstDay);
      ashura.setDate(ashura.getDate() + 9);
      const ashuraNight = new Date(firstDay);
      ashuraNight.setDate(ashuraNight.getDate() + 8);

      const arbaeen = new Date(firstDay);
      arbaeen.setDate(arbaeen.getDate() + 49);
      return [
        { label: 'Night of Ashura', date: formatDate(ashuraNight) },
        { label: 'Day of Ashura (10th of Muharram)', date: formatDate(ashura) },
        { label: 'Day of Arbaeen (20th of Safar)', date: formatDate(arbaeen) },
      ];
    }

    return [];
  }

  /** Find the nearest grid point to the user's location and return its category. */
  getLocalCategory(grid: VisibilityGrid): string {
    const loc = this.locationService.location();
    if (!loc) return 'none';
    return this.getLocalCategoryForGrid(grid, loc);
  }

  private getLocalCategoryForGrid(grid: VisibilityGrid, loc: { lat: number; lng: number }): string {
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
}
