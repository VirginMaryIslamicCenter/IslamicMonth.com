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
import { LocationDialogService } from '../services/location-dialog.service';
import { LocationDialogComponent } from '../components/location-dialog.component';

@Component({
  selector: 'app-home',
  imports: [CommonModule, RouterModule, FormsModule, LocationDialogComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit, AfterViewInit {
  private readonly moonService = inject(IslamicMonthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly locationService = inject(LocationService);
  readonly locationDialogService = inject(LocationDialogService);
  readonly islamicMonths = signal<IslamicMonthEntry[]>([]);

  private readonly monthTrackRef = viewChild<ElementRef<HTMLDivElement>>('monthTrack');

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
      // Don't await - let it happen in background
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

  openLocationDialog() {
    this.locationDialogService.open();
  }

  closeLocationDialog() {
    this.locationDialogService.close();
  }
}
