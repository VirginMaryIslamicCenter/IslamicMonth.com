import {
  Component, signal, inject, OnInit, ElementRef, viewChild, AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import {
  IslamicMonthService,
  IslamicMonthEntry,
} from '../services/islamic-month.service';
import { LocationService, type UserLocation } from '../services/location.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="shell">
      <!-- Top header bar -->
      <header class="top-bar">
        <div class="top-left">
          <h1 class="brand"><span class="moon-icon">🌙</span> IslamicMonth</h1>
          <span class="tagline">Yallop criterion · Crescent visibility worldwide</span>
        </div>
        <div class="top-right" id="sidebar-top">
          <label class="loc-label">📍</label>
          @if (locationService.location(); as loc) {
            <div class="location-display">
              <span class="location-name">{{ loc.displayName }}</span>
              <button class="location-clear" (click)="clearLocation()" title="Remove location">✕</button>
            </div>
          } @else {
            <form class="location-form" (ngSubmit)="searchLocation()">
              <input
                type="text"
                class="location-input"
                placeholder="City, state, country…"
                [(ngModel)]="locationQuery"
                name="locationQuery"
              />
              <button type="submit" class="location-search-btn" [disabled]="searching()">
                {{ searching() ? '…' : '→' }}
              </button>
            </form>
          }
          @if (locationError()) {
            <span class="location-error">{{ locationError() }}</span>
          }
        </div>
      </header>

      <!-- Horizontal scrollable month strip -->
      <nav class="month-strip">
        <button class="strip-arrow left" (click)="scrollMonths(-1)" aria-label="Scroll left">‹</button>
        <div class="strip-track" #monthTrack
          (mousedown)="onDragStart($event)"
          (touchstart)="onDragStart($event)">
          @for (month of islamicMonths(); track month.newMoonDate.getTime()) {
            <a
              class="month-box"
              [routerLink]="['/', month.year + 'AH', month.routeSlug]"
              routerLinkActive="active"
            >
              <span class="mb-name">{{ month.name }}</span>
              <span class="mb-meta">{{ month.year }} AH</span>
              <span class="mb-greg">{{ month.gregorianLabel }}</span>
            </a>
          }
        </div>
        <button class="strip-arrow right" (click)="scrollMonths(1)" aria-label="Scroll right">›</button>
      </nav>

      <!-- Main content area -->
      <main class="content">
        <router-outlet />
      </main>
    </div>
  `,
  styles: `
    /* ---------- shell ---------- */
    .shell {
      display: flex;
      flex-direction: column;
      min-height: 100vh;
      background: #0d1b2a;
      color: #fff;
    }

    /* ---------- top bar ---------- */
    .top-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 14px 24px;
      background: #101c2c;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      flex-wrap: wrap;
    }
    .top-left {
      display: flex;
      align-items: baseline;
      gap: 12px;
      flex-shrink: 0;
    }
    .brand {
      font-size: 1.2rem;
      font-weight: 700;
      margin: 0;
      white-space: nowrap;
    }
    .moon-icon { margin-right: 4px; }
    .tagline {
      font-size: 0.75rem;
      color: #607d8b;
      white-space: nowrap;
    }
    .top-right {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-shrink: 1;
      min-width: 0;
    }
    .loc-label {
      font-size: 0.95rem;
      flex-shrink: 0;
    }

    /* location */
    .location-form {
      display: flex;
      gap: 5px;
    }
    .location-input {
      width: 200px;
      box-sizing: border-box;
      padding: 7px 10px;
      font-size: 0.84rem;
      border-radius: 7px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.05);
      color: #fff;
      outline: none;
      transition: border-color 0.2s;
      &:focus { border-color: rgba(25,118,210,0.6); }
      &::placeholder { color: #607d8b; }
    }
    .location-search-btn {
      padding: 7px 12px;
      border-radius: 7px;
      border: 1px solid rgba(25,118,210,0.4);
      background: rgba(25,118,210,0.2);
      color: #90caf9;
      font-size: 0.95rem;
      cursor: pointer;
      &:hover { background: rgba(25,118,210,0.35); }
      &:disabled { opacity: 0.5; cursor: not-allowed; }
    }
    .location-display {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 10px;
      background: rgba(25,118,210,0.12);
      border: 1px solid rgba(25,118,210,0.25);
      border-radius: 7px;
      max-width: 300px;
    }
    .location-name {
      font-size: 0.84rem;
      color: #e0e0e0;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .location-clear {
      background: none;
      border: none;
      color: #78909c;
      cursor: pointer;
      font-size: 0.85rem;
      padding: 0 2px;
      &:hover { color: #ef5350; }
    }
    .location-error {
      font-size: 0.75rem;
      color: #ef9a9a;
    }

    /* ---------- month strip ---------- */
    .month-strip {
      display: flex;
      align-items: stretch;
      background: #0f1923;
      border-bottom: 1px solid rgba(255,255,255,0.06);
      position: relative;
    }
    .strip-arrow {
      flex-shrink: 0;
      width: 36px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: rgba(255,255,255,0.03);
      border: none;
      color: #90a4ae;
      font-size: 1.6rem;
      cursor: pointer;
      transition: background 0.15s;
      &:hover { background: rgba(255,255,255,0.08); color: #fff; }
    }
    .strip-track {
      flex: 1;
      display: flex;
      gap: 6px;
      overflow-x: auto;
      scroll-behavior: smooth;
      padding: 8px 6px;
      cursor: grab;
      -ms-overflow-style: none;
      scrollbar-width: none;
      &::-webkit-scrollbar { display: none; }
      &:active { cursor: grabbing; }
    }
    .month-box {
      flex-shrink: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 2px;
      padding: 10px 18px;
      border-radius: 10px;
      text-decoration: none;
      color: #b0bec5;
      background: rgba(255,255,255,0.03);
      border: 1px solid transparent;
      transition: background 0.15s, border-color 0.15s;
      user-select: none;
      &:hover { background: rgba(255,255,255,0.07); }
      &.active {
        background: rgba(25,118,210,0.18);
        border-color: #42a5f5;
      }
    }
    .mb-name { font-size: 0.88rem; font-weight: 700; color: #fff; }
    .mb-meta { font-size: 0.7rem; color: #78909c; }
    .mb-greg { font-size: 0.68rem; color: #607d8b; }

    /* ---------- content ---------- */
    .content {
      flex: 1;
      min-width: 0;
    }

    /* ---------- mobile ---------- */
    @media (max-width: 700px) {
      .top-bar {
        flex-direction: column;
        align-items: flex-start;
        gap: 10px;
        padding: 12px 14px;
      }
      .top-right { width: 100%; }
      .location-input { flex: 1; width: auto; }
      .location-display { max-width: unset; flex: 1; }
      .month-box { padding: 8px 14px; }
      .mb-name { font-size: 0.82rem; }
    }
  `,
})
export class HomeComponent implements OnInit, AfterViewInit {
  private readonly moonService = inject(IslamicMonthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly locationService = inject(LocationService);
  readonly islamicMonths = signal<IslamicMonthEntry[]>([]);

  private readonly monthTrackRef = viewChild<ElementRef<HTMLDivElement>>('monthTrack');

  locationQuery = '';
  readonly searching = signal(false);
  readonly locationError = signal<string | null>(null);

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragScrollLeft = 0;
  private hasDragged = false;

  constructor() {
    this.islamicMonths.set(this.moonService.getUpcomingIslamicMonths(new Date(), 12));
  }

  ngOnInit() {
    if (!this.route.firstChild) {
      const defaultRoute = this.moonService.getNearestMonthRoute(this.islamicMonths());
      this.router.navigateByUrl(defaultRoute, { replaceUrl: true });
    }
  }

  ngAfterViewInit() {
    // Scroll active month into view
    setTimeout(() => {
      const track = this.monthTrackRef()?.nativeElement;
      const active = track?.querySelector('.active') as HTMLElement | null;
      if (active && track) {
        active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 100);

    // Global mouse/touch events for drag
    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
    document.addEventListener('touchmove', this.onDragMove, { passive: false });
    document.addEventListener('touchend', this.onDragEnd);
  }

  scrollMonths(dir: number) {
    const track = this.monthTrackRef()?.nativeElement;
    if (!track) return;
    track.scrollBy({ left: dir * 260, behavior: 'smooth' });
  }

  onDragStart = (e: MouseEvent | TouchEvent) => {
    const track = this.monthTrackRef()?.nativeElement;
    if (!track) return;
    this.dragging = true;
    this.hasDragged = false;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    this.dragStartX = clientX;
    this.dragScrollLeft = track.scrollLeft;
  };

  private onDragMove = (e: MouseEvent | TouchEvent) => {
    if (!this.dragging) return;
    const track = this.monthTrackRef()?.nativeElement;
    if (!track) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const dx = clientX - this.dragStartX;
    if (Math.abs(dx) > 4) this.hasDragged = true;
    track.scrollLeft = this.dragScrollLeft - dx;
    if (this.hasDragged) e.preventDefault();
  };

  private onDragEnd = () => {
    this.dragging = false;
  };

  clearLocation() {
    this.locationService.clearLocation();
    this.locationQuery = '';
    this.locationError.set(null);
  }

  async searchLocation() {
    const query = this.locationQuery.trim();
    if (!query) return;

    this.searching.set(true);
    this.locationError.set(null);

    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json' },
      });
      const data = await res.json();

      if (data?.length > 0) {
        const result = data[0];
        const loc: UserLocation = {
          lat: parseFloat(result.lat),
          lng: parseFloat(result.lon),
          displayName: result.display_name?.split(',').slice(0, 3).join(',') || query,
        };
        this.locationService.setLocation(loc);
        this.locationQuery = '';
      } else {
        this.locationError.set('Location not found. Try a different search.');
      }
    } catch {
      this.locationError.set('Network error. Please try again.');
    } finally {
      this.searching.set(false);
    }
  }
}
