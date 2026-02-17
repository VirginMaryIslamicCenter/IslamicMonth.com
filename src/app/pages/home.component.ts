import {
  Component,
  signal,
  inject,
  OnInit,
  ElementRef,
  viewChild,
  AfterViewInit,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { IslamicMonthService, IslamicMonthEntry } from '../services/islamic-month.service';
import { LocationService, type UserLocation } from '../services/location.service';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
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

    // Request browser geolocation if no location is saved
    if (!this.locationService.location()) {
      this.locationService.requestBrowserLocation();
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
