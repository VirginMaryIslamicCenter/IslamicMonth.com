import { Injectable } from '@angular/core';
import {
  Observer,
  Body,
  SearchRiseSet,
  SearchAltitude,
  Equator,
  Horizon,
  MoonPhase,
  Illumination,
  SearchMoonPhase,
  AngleFromSun,
  MakeTime,
  type AstroTime,
} from 'astronomy-engine';

export type CrescentType = 'waxing' | 'waning';

export interface MoonVisibilityResult {
  lat: number;
  lng: number;
  category: VisibilityCategory;
  arcv: number;
  w: number;
  q: number;
  observationTime: Date | null;
  moonAlt: number;
  moonAge: number;
}

export enum VisibilityCategory {
  EASILY_VISIBLE = 'A',
  VISIBLE_PERFECT_CONDITIONS = 'B',
  OPTICAL_AID_TO_FIND = 'C',
  OPTICAL_AID_ONLY = 'D',
  NOT_VISIBLE = 'E',
}

export interface VisibilityGrid {
  results: MoonVisibilityResult[];
  date: Date;
  newMoonTime: Date | null;
  nextNewMoonTime: Date | null;
  gridResolution: number;
  crescentType: CrescentType;
  /** Label to display on the map, e.g. "New Moon Day", "+1 Day", "+2 Days" */
  dayLabel?: string;
  /** Islamic month info for display */
  islamicMonthLabel?: string;
}

export const ISLAMIC_MONTH_NAMES = [
  'Muharram',
  'Safar',
  "Rabi' al-Awwal",
  "Rabi' al-Thani",
  'Jumada al-Ula',
  'Jumada al-Thani',
  'Rajab',
  "Sha'ban",
  'Ramadan',
  'Shawwal',
  "Dhul Qi'dah",
  'Dhul Hijjah',
] as const;

export interface IslamicMonthEntry {
  /** Islamic month name */
  name: string;
  /** Islamic year (e.g. 1447) */
  year: number;
  /** Gregorian month/year label (e.g. "March 2026") */
  gregorianLabel: string;
  /** Scientific new moon (conjunction) date */
  newMoonDate: Date;
  /** The 3 dates to generate maps for: new moon day, +1, +2 */
  mapDates: Date[];
  /** URL-safe slug for the month name, e.g. "Ramadan" */
  routeSlug: string;
}

@Injectable({
  providedIn: 'root',
})
export class IslamicMonthService {
  /**
   * Generate a list of upcoming Islamic months based on scientific new moons.
   * Uses Intl.DateTimeFormat with islamic-umalqura calendar to get Hijri dates.
   */
  getUpcomingIslamicMonths(fromDate: Date, count: number = 12): IslamicMonthEntry[] {
    const entries: IslamicMonthEntry[] = [];
    // Start search from 30 days before fromDate to include the current month
    let searchFrom = new Date(fromDate.getTime() - 30 * 24 * 60 * 60 * 1000);

    for (let i = 0; i < count; i++) {
      const nm = SearchMoonPhase(0, searchFrom, 35);
      if (!nm) break;

      const newMoonDate = nm.date;

      // Map dates: conjuction day, +1, +2
      const day0 = new Date(
        newMoonDate.getFullYear(),
        newMoonDate.getMonth(),
        newMoonDate.getDate(),
      );
      const day1 = new Date(day0.getTime() + 1 * 24 * 60 * 60 * 1000);
      const day2 = new Date(day0.getTime() + 2 * 24 * 60 * 60 * 1000);

      // Get Islamic month/year — check a few days after new moon when the new month has started
      const checkDate = new Date(day0.getTime() + 3 * 24 * 60 * 60 * 1000);
      const hijri = this.getIslamicDate(checkDate);

      // Gregorian label for the new moon date
      const gregLabel = newMoonDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      entries.push({
        name: hijri.monthName,
        year: hijri.year,
        gregorianLabel: gregLabel,
        newMoonDate,
        mapDates: [day0, day1, day2],
        routeSlug: this.toRouteSlug(hijri.monthName),
      });

      // Move search forward past this new moon
      searchFrom = new Date(nm.date.getTime() + 2 * 24 * 60 * 60 * 1000);
    }

    return entries;
  }

  /**
   * Convert Islamic month name to a URL-safe slug.
   */
  toRouteSlug(name: string): string {
    return name.replace(/[' ]/g, '-').replace(/--+/g, '-');
  }

  /**
   * Find the month entry matching a route year+slug.
   */
  findMonthByRoute(
    yearStr: string,
    slug: string,
    months: IslamicMonthEntry[],
  ): IslamicMonthEntry | undefined {
    const year = parseInt(yearStr.replace('AH', ''), 10);
    return months.find((m) => m.year === year && m.routeSlug.toLowerCase() === slug.toLowerCase());
  }

  /**
   * Get the route path for the nearest upcoming (or most recent) new moon.
   * Picks the month whose new moon is closest to now (past or future).
   */
  getNearestMonthRoute(months: IslamicMonthEntry[]): string {
    const now = Date.now();
    let best = months[0];
    let bestDist = Infinity;

    for (const m of months) {
      const dist = Math.abs(m.newMoonDate.getTime() - now);
      if (dist < bestDist) {
        bestDist = dist;
        best = m;
      }
    }

    return `/${best.year}AH/${best.routeSlug}`;
  }

  /**
   * Get Islamic (Hijri) date info using the browser's Intl API.
   */
  private getIslamicDate(date: Date): { monthName: string; year: number; day: number } {
    try {
      const formatter = new Intl.DateTimeFormat('en-US-u-ca-islamic-umalqura', {
        month: 'long',
        year: 'numeric',
        day: 'numeric',
      });
      const parts = formatter.formatToParts(date);
      const monthPart = parts.find((p) => p.type === 'month');
      const yearPart = parts.find((p) => p.type === 'year');
      const dayPart = parts.find((p) => p.type === 'day');

      // The Intl API gives month names in Arabic-origin English names.
      // Map them to common transliterations.
      const intlMonth = monthPart?.value ?? '';
      const monthName = this.mapIntlIslamicMonth(intlMonth);
      const year = parseInt(yearPart?.value ?? '0', 10);
      const day = parseInt(dayPart?.value ?? '1', 10);

      return { monthName, year, day };
    } catch {
      return { monthName: 'Unknown', year: 0, day: 1 };
    }
  }

  /**
   * Map the Intl API Islamic month name to standard transliteration.
   */
  private mapIntlIslamicMonth(intlName: string): string {
    // Normalize: strip diacritics, ʻ glyphs, hyphens, and lowercase
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f\u02BB\u02BC\u2018\u2019]/g, '')
        .replace(/[-]/g, ' ')
        .toLowerCase()
        .trim();

    const n = norm(intlName);

    // Order matters: check specific patterns first
    if (n.includes('muharram')) return 'Muharram';
    if (n.includes('safar')) return 'Safar';
    // "rabi" must distinguish I/II before a generic match
    if (/rabi.*ii|rabi.*2|rabi.*thani|rabi.*akhir/i.test(n)) return "Rabi' al-Thani";
    if (/rabi/i.test(n)) return "Rabi' al-Awwal";
    // "jumad" must distinguish I/II
    if (/jumad.*ii|jumad.*2|jumad.*thani|jumad.*akhir/i.test(n)) return 'Jumada al-Thani';
    if (/jumad/i.test(n)) return 'Jumada al-Ula';
    if (n.includes('rajab')) return 'Rajab';
    if (n.includes('shab') || n.includes("sha'b")) return "Sha'ban";
    if (n.includes('ramad')) return 'Ramadan';
    if (n.includes('shaww')) return 'Shawwal';
    if (/dhu.*hijj/i.test(n)) return 'Dhul Hijjah';
    if (/dhu.*q/i.test(n)) return "Dhul Qi'dah";

    return intlName;
  }

  /**
   * Determine whether to show waxing or waning crescent based on moon phase.
   * Phase 0°=new moon, 180°=full moon, 360°=next new moon.
   */
  determineCrescentType(date: Date): CrescentType {
    const phase = MoonPhase(date);
    return phase < 180 ? 'waxing' : 'waning';
  }

  /**
   * Calculate moon visibility across the globe for a given date.
   *
   * Uses the Yallop (1997) criterion with proper "best time" calculation.
   * Best time is determined using the 4/9 lag rule:
   *   - Waxing: t_best = t_sunset + (4/9) × (t_moonset − t_sunset)
   *   - Waning: t_best = t_sunrise − (4/9) × (t_sunrise − t_moonrise)
   * Fallback: SearchAltitude for sun at −4° depression angle.
   *
   * Yallop's q criterion:
   *   q = (ARCV − (11.8371 − 6.3226·W + 0.7319·W² − 0.1018·W³)) / 10
   *
   * Categories:
   *   A: q > +0.216  → Easily visible with naked eye
   *   B: −0.014 < q ≤ +0.216 → Visible under perfect conditions
   *   C: −0.160 < q ≤ −0.014 → May need optical aid to find, then naked eye
   *   D: −0.232 < q ≤ −0.160 → Visible only with optical aid
   *   E: q ≤ −0.232 → Not visible
   */
  calculateVisibilityGrid(
    date: Date,
    crescentType: CrescentType,
    resolution: number = 4,
  ): VisibilityGrid {
    const results: MoonVisibilityResult[] = [];
    const newMoonTime = this.findPreviousNewMoon(date);
    const nextNewMoonTime = this.findNextNewMoon(date);

    for (let lat = -65; lat <= 65; lat += resolution) {
      for (let lng = -180; lng <= 180; lng += resolution) {
        const result = this.calculateVisibilityAtPoint(
          lat,
          lng,
          date,
          crescentType,
          newMoonTime,
          nextNewMoonTime,
        );
        results.push(result);
      }
    }

    return {
      results,
      date,
      newMoonTime,
      nextNewMoonTime,
      gridResolution: resolution,
      crescentType,
    };
  }

  private calculateVisibilityAtPoint(
    lat: number,
    lng: number,
    date: Date,
    crescentType: CrescentType,
    newMoonTime: Date | null,
    nextNewMoonTime: Date | null,
  ): MoonVisibilityResult {
    const observer = new Observer(lat, lng, 0);
    const localOffset = Math.round(lng / 15);
    const year = date.getFullYear();
    const month = date.getMonth();
    const day = date.getDate();

    try {
      if (crescentType === 'waxing') {
        return this.calculateWaxingVisibility(
          observer,
          lat,
          lng,
          year,
          month,
          day,
          localOffset,
          newMoonTime,
        );
      } else {
        return this.calculateWaningVisibility(
          observer,
          lat,
          lng,
          year,
          month,
          day,
          localOffset,
          nextNewMoonTime,
        );
      }
    } catch {
      return this.emptyResult(lat, lng);
    }
  }

  /**
   * Evening observation for waxing crescent (after sunset).
   * Best time = sunset + 4/9 × (moonset − sunset).
   */
  private calculateWaxingVisibility(
    observer: Observer,
    lat: number,
    lng: number,
    year: number,
    month: number,
    day: number,
    localOffset: number,
    newMoonTime: Date | null,
  ): MoonVisibilityResult {
    const noonUTC = new Date(Date.UTC(year, month, day, 12 - localOffset, 0, 0));

    // Find sunset
    const sunset = SearchRiseSet(Body.Sun, observer, -1, noonUTC, 1);
    if (!sunset) return this.emptyResult(lat, lng);

    // Find moonset after sunset for the 4/9 lag rule
    const moonset = SearchRiseSet(Body.Moon, observer, -1, sunset, 0.5);

    let bestTimeAstro: AstroTime;
    if (moonset && moonset.date.getTime() > sunset.date.getTime()) {
      const lag = moonset.date.getTime() - sunset.date.getTime();
      // If lag is unreasonably large (>6 hours), clamp it
      const effectiveLag = Math.min(lag, 6 * 3600 * 1000);
      const bestMs = sunset.date.getTime() + (4 / 9) * effectiveLag;
      bestTimeAstro = MakeTime(new Date(bestMs));
    } else {
      // Moon already set before sunset or no moonset found → not visible
      // But try fallback: sun at −4° depression
      const fallback = SearchAltitude(Body.Sun, observer, -1, sunset, 0.1, -4.0);
      if (fallback) {
        bestTimeAstro = fallback;
      } else {
        return this.emptyResult(lat, lng);
      }
    }

    return this.computeVisibility(
      observer,
      lat,
      lng,
      bestTimeAstro,
      sunset.date,
      newMoonTime,
      'waxing',
    );
  }

  /**
   * Morning observation for waning crescent (before sunrise).
   * Best time = sunrise − 4/9 × (sunrise − moonrise).
   */
  private calculateWaningVisibility(
    observer: Observer,
    lat: number,
    lng: number,
    year: number,
    month: number,
    day: number,
    localOffset: number,
    nextNewMoonTime: Date | null,
  ): MoonVisibilityResult {
    const midnightUTC = new Date(Date.UTC(year, month, day, 0 - localOffset, 0, 0));

    // Find sunrise
    const sunrise = SearchRiseSet(Body.Sun, observer, +1, midnightUTC, 1);
    if (!sunrise) return this.emptyResult(lat, lng);

    // Find moonrise before sunrise for the 4/9 lag rule
    // Search from several hours before sunrise
    const searchStart = new Date(sunrise.date.getTime() - 12 * 3600 * 1000);
    const moonrise = SearchRiseSet(Body.Moon, observer, +1, searchStart, 0.75);

    let bestTimeAstro: AstroTime;
    if (moonrise && moonrise.date.getTime() < sunrise.date.getTime()) {
      const lag = sunrise.date.getTime() - moonrise.date.getTime();
      const effectiveLag = Math.min(lag, 6 * 3600 * 1000);
      const bestMs = sunrise.date.getTime() - (4 / 9) * effectiveLag;
      bestTimeAstro = MakeTime(new Date(bestMs));
    } else {
      // Moon rises after sunrise or no moonrise found → try fallback
      const searchFallbackStart = new Date(sunrise.date.getTime() - 2 * 3600 * 1000);
      const fallback = SearchAltitude(Body.Sun, observer, +1, searchFallbackStart, 0.2, -4.0);
      if (fallback) {
        bestTimeAstro = fallback;
      } else {
        return this.emptyResult(lat, lng);
      }
    }

    return this.computeVisibility(
      observer,
      lat,
      lng,
      bestTimeAstro,
      sunrise.date,
      nextNewMoonTime,
      'waning',
    );
  }

  /**
   * Core visibility computation at the determined "best time".
   */
  private computeVisibility(
    observer: Observer,
    lat: number,
    lng: number,
    bestTimeAstro: AstroTime,
    refTime: Date,
    moonRefTime: Date | null,
    crescentType: CrescentType,
  ): MoonVisibilityResult {
    // Topocentric equatorial coordinates at best time
    const moonEq = Equator(Body.Moon, bestTimeAstro, observer, true, true);
    const sunEq = Equator(Body.Sun, bestTimeAstro, observer, true, true);

    // Horizontal coordinates with standard atmospheric refraction
    const moonHor = Horizon(bestTimeAstro, observer, moonEq.ra, moonEq.dec, 'normal');
    const sunHor = Horizon(bestTimeAstro, observer, sunEq.ra, sunEq.dec, 'normal');

    // ARCV: arc of vision (altitude difference)
    const arcv = moonHor.altitude - sunHor.altitude;

    // Moon below horizon → not visible
    if (moonHor.altitude < 0) {
      return {
        lat,
        lng,
        category: VisibilityCategory.NOT_VISIBLE,
        arcv,
        w: 0,
        q: -999,
        observationTime: refTime,
        moonAlt: moonHor.altitude,
        moonAge: this.computeMoonAge(crescentType, refTime, moonRefTime),
      };
    }

    // Geocentric elongation (ARCL)
    const elongation = AngleFromSun(Body.Moon, bestTimeAstro);

    // Topocentric crescent width W in arc-minutes
    // W = SD_moon × (1 − cos(ARCL))
    const moonIllum = Illumination(Body.Moon, bestTimeAstro);
    const moonDistAU = moonIllum.geo_dist;
    const moonRadiusAU = 1737.4 / 149597870.7;
    const sdRad = Math.asin(moonRadiusAU / moonDistAU);
    const sdArcMin = ((sdRad * 180) / Math.PI) * 60;
    const elongRad = (elongation * Math.PI) / 180;
    const wArcMin = sdArcMin * (1 - Math.cos(elongRad));

    // Yallop's q criterion
    const q =
      (arcv -
        (11.8371 -
          6.3226 * wArcMin +
          0.7319 * wArcMin * wArcMin -
          0.1018 * wArcMin * wArcMin * wArcMin)) /
      10;

    let category: VisibilityCategory;
    if (q > 0.216) {
      category = VisibilityCategory.EASILY_VISIBLE;
    } else if (q > -0.014) {
      category = VisibilityCategory.VISIBLE_PERFECT_CONDITIONS;
    } else if (q > -0.16) {
      category = VisibilityCategory.OPTICAL_AID_TO_FIND;
    } else if (q > -0.232) {
      category = VisibilityCategory.OPTICAL_AID_ONLY;
    } else {
      category = VisibilityCategory.NOT_VISIBLE;
    }

    return {
      lat,
      lng,
      category,
      arcv,
      w: wArcMin,
      q,
      observationTime: refTime,
      moonAlt: moonHor.altitude,
      moonAge: this.computeMoonAge(crescentType, refTime, moonRefTime),
    };
  }

  private computeMoonAge(
    crescentType: CrescentType,
    refTime: Date,
    moonRefTime: Date | null,
  ): number {
    if (!moonRefTime) return 0;
    if (crescentType === 'waxing') {
      // Hours since previous new moon
      return (refTime.getTime() - moonRefTime.getTime()) / (3600 * 1000);
    } else {
      // Hours until next new moon
      return (moonRefTime.getTime() - refTime.getTime()) / (3600 * 1000);
    }
  }

  private findPreviousNewMoon(date: Date): Date | null {
    try {
      // Use end of day to catch new moons that occur during the observation day
      // (sunset observations happen in the evening, so a noon new moon is "previous")
      const endOfDay = new Date(date.getTime() + 24 * 60 * 60 * 1000);
      const searchStart = new Date(endOfDay.getTime() - 45 * 24 * 60 * 60 * 1000);
      const first = SearchMoonPhase(0, searchStart, 46);
      if (!first || first.date > endOfDay) return null;

      // Check if there's a more recent new moon between the first and end of day
      const secondStart = new Date(first.date.getTime() + 2 * 24 * 60 * 60 * 1000);
      const second = SearchMoonPhase(0, secondStart, 30);
      if (second && second.date <= endOfDay) {
        return second.date;
      }

      return first.date;
    } catch {
      return null;
    }
  }

  private findNextNewMoon(date: Date): Date | null {
    try {
      const result = SearchMoonPhase(0, date, 35);
      return result ? result.date : null;
    } catch {
      return null;
    }
  }

  private emptyResult(lat: number, lng: number): MoonVisibilityResult {
    return {
      lat,
      lng,
      category: VisibilityCategory.NOT_VISIBLE,
      arcv: 0,
      w: 0,
      q: -999,
      observationTime: null,
      moonAlt: 0,
      moonAge: 0,
    };
  }
}
