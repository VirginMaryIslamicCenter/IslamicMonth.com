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

    // Only detect the first month from the calendar API.
    // All subsequent months are derived from the fixed Islamic month sequence,
    // which eliminates duplicate-month bugs caused by calendar boundary differences.
    let currentMonthIndex = -1;
    let currentYear = 0;

    for (let i = 0; i < count; i++) {
      const nm = SearchMoonPhase(0, searchFrom, 35);
      if (!nm) break;

      const newMoonDate = nm.date;

      // Map dates: conjunction day, +1, +2
      const day0 = new Date(
        newMoonDate.getFullYear(),
        newMoonDate.getMonth(),
        newMoonDate.getDate(),
      );
      const day1 = new Date(day0.getTime() + 1 * 24 * 60 * 60 * 1000);
      const day2 = new Date(day0.getTime() + 2 * 24 * 60 * 60 * 1000);

      let monthName: string;
      let year: number;

      if (currentMonthIndex === -1) {
        // First month: detect from calendar API (check 5 days after new moon)
        const checkDate = new Date(day0.getTime() + 5 * 24 * 60 * 60 * 1000);
        const hijri = this.getIslamicDate(checkDate);
        currentMonthIndex = ISLAMIC_MONTH_NAMES.indexOf(
          hijri.monthName as (typeof ISLAMIC_MONTH_NAMES)[number],
        );
        if (currentMonthIndex === -1) currentMonthIndex = 0; // fallback
        currentYear = hijri.year;

        // If the day is late in the month (>15), it means the check date hasn't
        // crossed into the new Islamic month yet — the new moon is for the NEXT month.
        // If the day is early (1-15), we've correctly entered the new month.
        if (hijri.day > 15) {
          currentMonthIndex++;
          if (currentMonthIndex >= ISLAMIC_MONTH_NAMES.length) {
            currentMonthIndex = 0;
            currentYear++;
          }
        }
      } else {
        // Subsequent months: advance to the next month in the fixed sequence.
        // If we were on Dhul Hijjah (index 11), wrap to Muharram (index 0) and increment year.
        currentMonthIndex++;
        if (currentMonthIndex >= ISLAMIC_MONTH_NAMES.length) {
          currentMonthIndex = 0;
          currentYear++;
        }
      }

      monthName = ISLAMIC_MONTH_NAMES[currentMonthIndex];
      year = currentYear;

      // Gregorian label for the new moon date
      const gregLabel = newMoonDate.toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      });

      entries.push({
        name: monthName,
        year,
        gregorianLabel: gregLabel,
        newMoonDate,
        mapDates: [day0, day1, day2],
        routeSlug: this.toRouteSlug(monthName),
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

      // If monthName is empty, the Intl API fell back to Gregorian (unsupported calendar).
      // Use our algorithmic fallback instead.
      if (!monthName || year === 0) {
        return this.getIslamicDateFallback(date);
      }

      return { monthName, year, day };
    } catch {
      return this.getIslamicDateFallback(date);
    }
  }

  /**
   * Algorithmic fallback for Islamic date when Intl islamic-umalqura is not supported.
   * Uses the Kuwaiti algorithm (tabular Islamic calendar) as an approximation.
   */
  private getIslamicDateFallback(date: Date): { monthName: string; year: number; day: number } {
    // Julian Day Number
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    const jd =
      Math.floor(365.25 * (y + 4716)) +
      Math.floor(30.6001 * (m + 1)) +
      d -
      1524.5 -
      (y > 1582 || (y === 1582 && m > 10) || (y === 1582 && m === 10 && d > 15)
        ? Math.floor(y / 100) - Math.floor(y / 400) - 2
        : 0);

    // Convert JD to Islamic (Kuwaiti/tabular algorithm)
    const l = Math.floor(jd - 1948439.5) + 10632;
    const n = Math.floor((l - 1) / 10631);
    const remainder = l - 10631 * n + 354;
    const j =
      Math.floor((10985 - remainder) / 5316) * Math.floor((50 * remainder) / 17719) +
      Math.floor(remainder / 5670) * Math.floor((43 * remainder) / 15238);
    const adjustedL =
      remainder -
      Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) -
      Math.floor(j / 16) * Math.floor((15238 * j) / 43) +
      29;
    const month = Math.floor((24 * adjustedL) / 709);
    const day = adjustedL - Math.floor((709 * month) / 24);
    const year = 30 * n + j - 30;

    const monthIndex = Math.max(0, Math.min(11, month - 1));
    return {
      monthName: ISLAMIC_MONTH_NAMES[monthIndex],
      year,
      day,
    };
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

    // Detect Gregorian fallback — if the Intl API returned a Gregorian month name,
    // it means the islamic-umalqura calendar is not supported on this device.
    const gregorianMonths = [
      'january',
      'february',
      'march',
      'april',
      'may',
      'june',
      'july',
      'august',
      'september',
      'october',
      'november',
      'december',
    ];
    if (gregorianMonths.includes(n)) {
      return ''; // Signal to caller that Intl failed
    }

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
   * Uses the Yallop (1997) criterion evaluated when the sun is at −1° below the horizon.
   * This is shortly after sunset/before sunrise and provides adequate twilight for observation.
   *
   * Thresholds have been relaxed for better coverage of marginal visibility (especially optical aid):
   *
   * Yallop's q criterion:
   *   q = (ARCV − (11.8371 − 6.3226·W + 0.7319·W² − 0.1018·W³)) / 10
   *
   * Categories (relaxed thresholds for better coverage):
   *   A: q > +0.10  → Easily visible with naked eye (expanded threshold)
   *   B: −0.19 < q ≤ +0.10 → Visible under perfect conditions (expanded threshold)
   *   C: −0.35 < q ≤ −0.19 → May need optical aid to find, then naked eye (expanded threshold)
   *   D: −0.68 < q ≤ −0.35 → Visible only with optical aid (expanded threshold)
   *   E: q ≤ −0.68 → Not visible
   */
  calculateVisibilityGrid(
    date: Date,
    crescentType: CrescentType,
    resolution: number = 4,
  ): VisibilityGrid {
    const results: MoonVisibilityResult[] = [];
    const newMoonTime = this.findPreviousNewMoon(date);
    const nextNewMoonTime = this.findNextNewMoon(date);
    const latEnd = 65;
    const lngEnd = 180;

    for (let lat = -65; lat <= latEnd; lat += resolution) {
      for (let lng = -180; lng <= lngEnd; lng += resolution) {
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
   * Observation time is when the sun is at −1° below the horizon.
   * This provides more observation time after sunset for visibility assessment.
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

    // Find sunset (sun's upper limb at horizon with refraction)
    const sunset = SearchRiseSet(Body.Sun, observer, -1, noonUTC, 1);
    if (!sunset) return this.emptyResult(lat, lng);

    // Find the time when sun is at −1° below horizon
    // This is shortly after sunset and provides more observation time
    const observationTime = SearchAltitude(Body.Sun, observer, -1, sunset, 1.0, -1.0);
    if (!observationTime) return this.emptyResult(lat, lng);

    return this.computeVisibility(
      observer,
      lat,
      lng,
      observationTime,
      observationTime.date,
      newMoonTime,
      'waxing',
    );
  }

  /**
   * Morning observation for waning crescent (before sunrise).
   * Observation time is when the sun is at −1° below the horizon.
   * This provides more observation time before sunrise.
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

    // Find sunrise (sun's upper limb at horizon with refraction)
    const sunrise = SearchRiseSet(Body.Sun, observer, +1, midnightUTC, 1);
    if (!sunrise) return this.emptyResult(lat, lng);

    // Find the time when sun is at −1° below horizon before sunrise
    // This provides more observation time
    const searchStart = new Date(sunrise.date.getTime() - 2 * 3600 * 1000);
    const observationTime = SearchAltitude(Body.Sun, observer, +1, searchStart, 2.0, -1.0);
    if (!observationTime) return this.emptyResult(lat, lng);

    return this.computeVisibility(
      observer,
      lat,
      lng,
      observationTime,
      observationTime.date,
      nextNewMoonTime,
      'waning',
    );
  }

  /**
   * Core visibility computation at sunset/sunrise.
   * Calculates the Yallop criterion (q value) based on moon's position
   * at the observation time.
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

    // Geocentric elongation (ARCL) for crescent width calculation
    const elongation = AngleFromSun(Body.Moon, bestTimeAstro);

    // Topocentric crescent width W in arc-minutes
    // W = SD_moon × (1 − cos(ARCL))  where ARCL is geocentric elongation
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
    if (q > 0.1) {
      category = VisibilityCategory.EASILY_VISIBLE;
    } else if (q > -0.19) {
      category = VisibilityCategory.VISIBLE_PERFECT_CONDITIONS;
    } else if (q > -0.36) {
      category = VisibilityCategory.OPTICAL_AID_TO_FIND;
    } else if (q > -0.63) {
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
