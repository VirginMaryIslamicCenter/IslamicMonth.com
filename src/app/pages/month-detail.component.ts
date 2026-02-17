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
  template: `
    @if (computing()) {
      <div class="loading-section">
        <div class="progress-bar">
          <div class="progress-fill"></div>
        </div>
        <p class="loading-text">
          Computing visibility maps ({{ computingStep() }}/3)...
        </p>
      </div>
    }

    @if (notFound()) {
      <div class="not-found">
        <p>Month not found. Redirecting...</p>
      </div>
    }

    @if (visibilityGrids().length > 0) {
      <div class="container-fluid maps-section">
        @for (grid of visibilityGrids(); track grid.date.getTime(); let i = $index) {
          <div class="row g-4 map-row">
            <!-- Info column (first) -->
            <div class="col-lg-4 col-xl-3">
              <div class="info-card">
                <div class="info-header">
                  <span class="crescent-icon">🌙</span>
                  <h3 class="evening-title">{{ getEveningTitle(grid.date) }}</h3>
                </div>

                <div class="info-divider"></div>

                <div class="card-body">
                  <p class="sighting-line">If the moon is sighted on this evening:</p>
                  <p class="sighting-detail">
                    1st of <strong>{{ monthEntry()?.name }}</strong> begins the
                    <strong>night of {{ formatShortDate(grid.date) }}</strong>
                  </p>
                  <p class="sighting-action">{{ getActionLine(grid.date) }}</p>
                </div>

                <div class="info-divider"></div>

                <!-- Local visibility -->
                @if (locationService.location(); as loc) {
                  <div class="local-vis" [class]="'local-vis vis-' + getLocalCategory(grid)">
                    <span class="lv-icon">{{ getLocalIcon(grid) }}</span>
                    <div class="lv-text">
                      <span class="lv-label">{{ loc.displayName }}</span>
                      <span class="lv-result">{{ getLocalDescription(grid) }}</span>
                    </div>
                  </div>
                } @else {
                  <div class="local-vis vis-none">
                    <span class="lv-icon">📍</span>
                    <div class="lv-text">
                      <a class="lv-link" href="#sidebar-top">Set your location</a>
                      <span class="lv-sub">to see local visibility</span>
                    </div>
                  </div>
                }
              </div>
            </div>
            <!-- Map column -->
            <div class="col-lg-8 col-xl-9">
              <app-moon-map
                [visibilityGrid]="grid"
                [userLocation]="locationService.location()"
              />
            </div>
          </div>
        }
      </div>
    }
  `,
  styles: `
    .loading-section {
      max-width: 700px;
      margin: 40px auto;
      padding: 0 20px;
      text-align: center;
    }
    .progress-bar {
      height: 4px;
      background: rgba(255,255,255,0.1);
      border-radius: 2px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    .progress-fill {
      height: 100%;
      background: linear-gradient(90deg, #1976d2, #42a5f5);
      border-radius: 2px;
      animation: progress 2s ease-in-out infinite;
    }
    @keyframes progress {
      0% { width: 0%; }
      50% { width: 70%; }
      100% { width: 100%; }
    }
    .loading-text {
      color: #78909c;
      font-size: 0.9rem;
    }
    .not-found {
      text-align: center;
      padding: 60px 20px;
      color: #90a4ae;
    }

    /* ===== Maps section ===== */
    .maps-section {
      padding: 24px 0 60px;
    }

    .map-row {
      align-items: stretch;
      margin-bottom: 32px;
    }
    .map-row:last-child {
      margin-bottom: 0;
    }

    /* ---- Info card ---- */
    .info-card {
      background: linear-gradient(145deg, #0d1b2a, #142438);
      border: 1px solid rgba(255,255,255,0.08);
      border-radius: 14px;
      padding: 24px 20px 20px;
      height: 100%;
      display: flex;
      flex-direction: column;
      box-shadow: 0 4px 20px rgba(0,0,0,0.25);
    }

    .info-header {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .crescent-icon {
      font-size: 1.4rem;
    }
    .evening-title {
      margin: 0;
      font-size: 1.1rem;
      font-weight: 700;
      color: #fff;
    }

    .info-divider {
      height: 1px;
      background: linear-gradient(90deg, rgba(255,255,255,0.08), transparent);
      margin: 16px 0;
    }

    .card-body {
      display: flex;
      flex-direction: column;
      gap: 8px;
      flex: 1;
    }
    .sighting-line {
      margin: 0;
      font-size: 0.82rem;
      color: #607d8b;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .sighting-detail {
      margin: 0;
      font-size: 0.95rem;
      color: #b0bec5;
      line-height: 1.6;
    }
    .sighting-detail strong { color: #e0e0e0; }
    .sighting-action {
      margin: 6px 0 0;
      font-size: 0.95rem;
      font-weight: 600;
      color: #64b5f6;
    }

    /* ---- Local visibility ---- */
    .local-vis {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid rgba(255,255,255,0.06);
      margin-top: auto;
    }
    .lv-icon { font-size: 1.3rem; flex-shrink: 0; }
    .lv-text { display: flex; flex-direction: column; gap: 2px; }
    .lv-label { font-size: 0.78rem; color: #78909c; }
    .lv-result { font-size: 0.88rem; font-weight: 600; }
    .lv-link {
      font-size: 0.85rem;
      color: #42a5f5;
      text-decoration: none;
      &:hover { text-decoration: underline; }
    }
    .lv-sub { font-size: 0.72rem; color: #607d8b; }

    .vis-A { background: rgba(50,220,120,0.06); border-color: rgba(50,220,120,0.2); }
    .vis-A .lv-result { color: #69f0ae; }
    .vis-B { background: rgba(255,225,50,0.06); border-color: rgba(255,225,50,0.15); }
    .vis-B .lv-result { color: #ffee58; }
    .vis-C { background: rgba(255,165,50,0.06); border-color: rgba(255,165,50,0.15); }
    .vis-C .lv-result { color: #ffa726; }
    .vis-D { background: rgba(255,90,70,0.06); border-color: rgba(255,90,70,0.15); }
    .vis-D .lv-result { color: #ef5350; }
    .vis-E { background: rgba(255,255,255,0.02); }
    .vis-E .lv-result { color: #607d8b; }
    .vis-none { background: rgba(255,255,255,0.02); }

    /* ---- Mobile ---- */
    @media (max-width: 991px) {
      .maps-section {
        padding: 16px 0 40px;
      }
      .map-row {
        margin-bottom: 24px;
      }
      .info-card {
        margin-bottom: 12px;
      }
    }
  `,
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
    this.sub = this.route.params.subscribe(params => {
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

    const dayLabels = ['New Moon Day (Conjunction)', '+1 Day After New Moon', '+2 Days After New Moon'];
    const grids: VisibilityGrid[] = [];

    for (let i = 0; i < entry.mapDates.length; i++) {
      this.computingStep.set(i + 1);
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          const grid = this.moonService.calculateVisibilityGrid(
            entry.mapDates[i], 'waxing', 4
          );
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
    return 'Evening of ' + mapDate.toLocaleDateString('en-US', {
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
    const dayStr = dayAfter.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

    if (entry.name === 'Ramadan') {
      return `Fasting will begin on ${dayStr}`;
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
      if (d < minDist) { minDist = d; nearest = r; }
    }
    return nearest?.category ?? 'E';
  }

  getLocalIcon(grid: VisibilityGrid): string {
    const cat = this.getLocalCategory(grid);
    switch (cat) {
      case 'A': return '👁️';
      case 'B': return '👁️';
      case 'C': return '🔭';
      case 'D': return '🔭';
      default: return '🚫';
    }
  }

  getLocalDescription(grid: VisibilityGrid): string {
    const cat = this.getLocalCategory(grid);
    switch (cat) {
      case 'A': return 'Easily visible with the naked eye';
      case 'B': return 'Visible with the naked eye in perfect conditions';
      case 'C': return 'Need optical aid (binoculars) to find, then visible with naked eye';
      case 'D': return 'Only visible with optical aid (telescope / binoculars)';
      default: return 'Moon not expected to be visible';
    }
  }
}
