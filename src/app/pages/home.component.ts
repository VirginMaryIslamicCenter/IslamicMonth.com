import { Component, signal, inject, OnInit, OnDestroy } from '@angular/core';
import { RouterModule, Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { IslamicMonthService, IslamicMonthEntry } from '../services/islamic-month.service';
import { LocationService } from '../services/location.service';
import { LocationDialogService } from '../services/location-dialog.service';
import { LocationDialogComponent } from '../components/location-dialog.component';
import { TopbarComponent } from '../components/topbar.component';
import { HeaderMessageComponent } from '../components/header-message.component';
import { MonthStripComponent } from '../components/month-strip.component';
import { YearStripComponent, YearEntry } from '../components/year-strip.component';
import { FooterComponent } from '../components/footer.component';

@Component({
  selector: 'app-home',
  imports: [
    RouterModule,
    LocationDialogComponent,
    TopbarComponent,
    HeaderMessageComponent,
    MonthStripComponent,
    YearStripComponent,
    FooterComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, OnDestroy {
  private readonly moonService = inject(IslamicMonthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly locationService = inject(LocationService);
  readonly locationDialogService = inject(LocationDialogService);
  readonly islamicMonths = signal<IslamicMonthEntry[]>([]);
  readonly yearEntries = signal<YearEntry[]>([]);
  readonly activeGregorianYear = signal(new Date().getFullYear());

  /** Cache of months per Gregorian year to avoid re-computation */
  private yearMonthsCache = new Map<number, IslamicMonthEntry[]>();
  private routerSub!: Subscription;

  constructor() {
    this.initYears();
  }

  ngOnInit() {
    // Detect active year from initial route
    this.syncActiveYearFromRoute();

    // Listen to route changes to update active year
    this.routerSub = this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe(() => this.syncActiveYearFromRoute());

    if (!this.route.firstChild) {
      const defaultRoute = this.moonService.getNearestMonthRoute(this.islamicMonths());
      this.router.navigateByUrl(defaultRoute, { replaceUrl: true });
    }

    // Request browser geolocation if no location is saved
    if (!this.locationService.location()) {
      this.locationService.requestBrowserLocation();
    }
  }

  ngOnDestroy() {
    this.routerSub?.unsubscribe();
  }

  private initYears() {
    const currentYear = new Date().getFullYear();
    const years: YearEntry[] = [];

    for (let y = currentYear - 5; y <= currentYear + 5; y++) {
      const months = this.getMonthsForYear(y);
      if (months.length === 0) continue;
      const uniqueIslamic = [...new Set(months.map((m) => m.year))].sort();
      const islamicYearLabel =
        uniqueIslamic.length > 1
          ? `${uniqueIslamic[0]}–${uniqueIslamic[uniqueIslamic.length - 1]} AH`
          : `${uniqueIslamic[0]} AH`;
      years.push({
        gregorianYear: y,
        islamicYearLabel,
        firstMonthRoute: `/${months[0].year}AH/${months[0].routeSlug}`,
      });
    }

    this.yearEntries.set(years);
    // Default: load months for current Gregorian year
    this.islamicMonths.set(this.getMonthsForYear(currentYear));
  }

  private getMonthsForYear(year: number): IslamicMonthEntry[] {
    if (!this.yearMonthsCache.has(year)) {
      this.yearMonthsCache.set(year, this.moonService.getIslamicMonthsForGregorianYear(year));
    }
    return this.yearMonthsCache.get(year)!;
  }

  private syncActiveYearFromRoute() {
    const child = this.route.firstChild;
    if (!child) return;
    const yearStr = child.snapshot.params['year'];
    const monthSlug = child.snapshot.params['month'];
    if (!yearStr || !monthSlug) return;

    // Find which Gregorian year contains this Islamic month
    for (const ye of this.yearEntries()) {
      const months = this.getMonthsForYear(ye.gregorianYear);
      const match = months.find(
        (m) =>
          `${m.year}AH` === yearStr && m.routeSlug.toLowerCase() === monthSlug.toLowerCase(),
      );
      if (match) {
        this.activeGregorianYear.set(ye.gregorianYear);
        this.islamicMonths.set(months);
        return;
      }
    }
  }

  closeLocationDialog() {
    this.locationDialogService.close();
  }
}
