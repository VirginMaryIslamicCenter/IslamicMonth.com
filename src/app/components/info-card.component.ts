import { Component, input, inject, signal, computed, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { VisibilityGrid } from '../services/islamic-month.service';
import { LocationService, type UserLocation } from '../services/location.service';
import { LocationDialogService } from '../services/location-dialog.service';
import {
  Observer,
  Body,
  SearchRiseSet,
  Equator,
  Horizon,
  Illumination,
  MoonPhase,
  MakeTime,
} from 'astronomy-engine';

export interface MoonPositionData {
  azimuth: number;
  altitude: number;
  compassDirection: string;
  compassDegrees: string;
  illumination: number;
  phase: number;
  isAboveHorizon: boolean;
  moonrise: Date | null;
  moonset: Date | null;
  bestTime: Date | null;
  bestTimeAzimuth: number;
  bestTimeAltitude: number;
  bestTimeCompass: string;
}

@Component({
  selector: 'app-info-card',
  imports: [FormsModule],
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

  /** Short date for the sighting night (grid date) e.g. "FEB 18" */
  readonly sightingShortDate = computed(() => {
    const d = this.grid()?.date;
    if (!d) return '';
    const month = d.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    return `${month} ${d.getDate()}`;
  });

  /** Short date for the day after (fasting/eid/day start) e.g. "FEB 19" */
  readonly actionShortDate = computed(() => {
    const d = this.grid()?.date;
    if (!d) return '';
    const next = new Date(d);
    next.setDate(next.getDate() + 1);
    const month = next.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
    return `${month} ${next.getDate()}`;
  });

  /** Label for the action tile ("Fasting", "Eid Prayers", "1st Day") */
  readonly actionLabel = computed(() => {
    const line = this.actionLine();
    if (line.includes('Fasting')) return 'Fasting';
    if (line.includes('Eid')) return 'Eid Prayers';
    return '1st Day';
  });

  /** Icon for the action tile */
  readonly actionIcon = computed(() => {
    const line = this.actionLine();
    if (line.includes('Fasting')) return '🕌';
    if (line.includes('Eid')) return '🎉';
    return '📅';
  });

  /** Computed position for the altitude arc arrow (used by dialog SVG, center 100,100 r=85) */
  readonly altArcMoonPos = computed(() => {
    const mp = this.moonPosition();
    if (!mp || mp.altitude <= 0) return { x: 100, y: 100, angle: 0 };
    const angleRad = (mp.altitude * Math.PI) / 180;
    const radius = 85 * Math.cos(angleRad);
    const y = 100 - 85 * Math.sin(angleRad);
    const x = mp.azimuth > 180 ? 100 - radius : 100 + radius;
    const lineAngle = Math.atan2(100 - y, x - 100) * (180 / Math.PI);
    return { x, y, angle: -lineAngle };
  });

  /** Computed position for altitude thumbnail SVG (center 110,115 r=90) */
  readonly altThumbMoonPos = computed(() => {
    const mp = this.moonPosition();
    if (!mp || mp.altitude <= 0) return { x: 110, y: 115 };
    const angleRad = (mp.altitude * Math.PI) / 180;
    const r = 90;
    const cx = 110,
      cy = 115;
    const radius = r * Math.cos(angleRad);
    const y = cy - r * Math.sin(angleRad);
    const x = mp.azimuth > 180 ? cx - radius : cx + radius;
    return { x, y };
  });

  /** Moon finder state */
  readonly moreDetailsExpanded = signal(false);
  readonly altitudeDialogOpen = signal(false);
  readonly sliderMinutes = signal(0); // minutes since midnight (0–1439)
  readonly sunsetMinutes = signal(0); // sunset in minutes for reference

  /** Formatted time display from slider */
  readonly sliderTimeDisplay = computed(() => {
    const mins = this.sliderMinutes();
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const period = h >= 12 ? 'PM' : 'AM';
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    return `${h12}:${m.toString().padStart(2, '0')} ${period}`;
  });

  /** Whether the slider is at the sunset default */
  readonly isAtSunset = computed(() => {
    return this.sliderMinutes() === this.sunsetMinutes();
  });

  /** Compute moon position reactively */
  readonly moonPosition = computed<MoonPositionData | null>(() => {
    const loc = this.locationService.location();
    const grid = this.grid();
    if (!loc || !grid) return null;

    const mins = this.sliderMinutes();
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    const dateBase = grid.date;
    const observeDate = new Date(
      dateBase.getFullYear(),
      dateBase.getMonth(),
      dateBase.getDate(),
      h,
      m,
    );

    return this.calculateMoonPosition(loc, observeDate, grid.date);
  });

  /** Sync slider to sunset whenever location or grid changes */
  constructor() {
    effect(() => {
      const loc = this.locationService.location();
      const grid = this.grid();
      if (loc && grid) {
        const sunset = this.getSunsetTime(loc, grid.date);
        if (sunset) {
          const mins = sunset.getHours() * 60 + sunset.getMinutes();
          this.sunsetMinutes.set(mins);
          this.sliderMinutes.set(mins);
        }
      }
    });
  }

  toggleMoreDetails() {
    this.moreDetailsExpanded.update((v) => !v);
  }

  showAltitudeDialog() {
    this.altitudeDialogOpen.set(true);
  }

  closeAltitudeDialog() {
    this.altitudeDialogOpen.set(false);
  }

  onSliderChange(value: number) {
    this.sliderMinutes.set(value);
  }

  resetToSunset() {
    this.sliderMinutes.set(this.sunsetMinutes());
  }

  private getSunsetTime(loc: UserLocation, date: Date): Date | null {
    try {
      const observer = new Observer(loc.lat, loc.lng, 0);
      const localOffset = Math.round(loc.lng / 15);
      const noonUTC = new Date(
        Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), 12 - localOffset, 0, 0),
      );
      const sunset = SearchRiseSet(Body.Sun, observer, -1, noonUTC, 1);
      return sunset ? sunset.date : null;
    } catch {
      return null;
    }
  }

  private calculateMoonPosition(
    loc: UserLocation,
    observeDate: Date,
    gridDate: Date,
  ): MoonPositionData {
    const observer = new Observer(loc.lat, loc.lng, 0);
    const astroTime = MakeTime(observeDate);

    // Moon equatorial → horizontal coordinates
    const moonEq = Equator(Body.Moon, astroTime, observer, true, true);
    const moonHor = Horizon(astroTime, observer, moonEq.ra, moonEq.dec, 'normal');

    // Moon illumination & phase
    const illum = Illumination(Body.Moon, astroTime);
    const phase = MoonPhase(observeDate);

    // Moon rise/set for this date
    const localOffset = Math.round(loc.lng / 15);
    const noonUTC = new Date(
      Date.UTC(
        gridDate.getFullYear(),
        gridDate.getMonth(),
        gridDate.getDate(),
        12 - localOffset,
        0,
        0,
      ),
    );

    let moonrise: Date | null = null;
    let moonset: Date | null = null;
    try {
      const riseResult = SearchRiseSet(Body.Moon, observer, +1, noonUTC, 1);
      moonrise = riseResult ? riseResult.date : null;
    } catch {
      /* ignore */
    }
    try {
      const setResult = SearchRiseSet(Body.Moon, observer, -1, noonUTC, 1);
      moonset = setResult ? setResult.date : null;
    } catch {
      /* ignore */
    }

    // Best viewing time (sunset + 30 min for waxing)
    const sunset = this.getSunsetTime(loc, gridDate);
    const bestTime = sunset ? new Date(sunset.getTime() + 30 * 60 * 1000) : null;

    let bestTimeAzimuth = 0;
    let bestTimeAltitude = 0;
    let bestTimeCompass = '';
    if (bestTime) {
      const btAstro = MakeTime(bestTime);
      const btEq = Equator(Body.Moon, btAstro, observer, true, true);
      const btHor = Horizon(btAstro, observer, btEq.ra, btEq.dec, 'normal');
      bestTimeAzimuth = btHor.azimuth;
      bestTimeAltitude = btHor.altitude;
      bestTimeCompass = this.azimuthToCompass(btHor.azimuth);
    }

    return {
      azimuth: moonHor.azimuth,
      altitude: moonHor.altitude,
      compassDirection: this.azimuthToCompass(moonHor.azimuth),
      compassDegrees: moonHor.azimuth.toFixed(1) + '°',
      illumination: illum.phase_fraction * 100,
      phase,
      isAboveHorizon: moonHor.altitude > 0,
      moonrise,
      moonset,
      bestTime,
      bestTimeAzimuth,
      bestTimeAltitude,
      bestTimeCompass,
    };
  }

  private azimuthToCompass(az: number): string {
    const dirs = [
      'N',
      'NNE',
      'NE',
      'ENE',
      'E',
      'ESE',
      'SE',
      'SSE',
      'S',
      'SSW',
      'SW',
      'WSW',
      'W',
      'WNW',
      'NW',
      'NNW',
    ];
    const idx = Math.round(az / 22.5) % 16;
    return dirs[idx];
  }

  formatTime(date: Date | null): string {
    if (!date) return '—';
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  }

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
