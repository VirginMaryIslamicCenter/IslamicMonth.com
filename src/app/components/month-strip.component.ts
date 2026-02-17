import {
  Component,
  input,
  viewChild,
  ElementRef,
  AfterViewInit,
  OnDestroy,
} from '@angular/core';
import { RouterModule } from '@angular/router';
import { IslamicMonthEntry } from '../services/islamic-month.service';

@Component({
  selector: 'app-month-strip',
  imports: [RouterModule],
  templateUrl: './month-strip.component.html',
  styleUrl: './month-strip.component.scss',
})
export class MonthStripComponent implements AfterViewInit, OnDestroy {
  readonly months = input.required<IslamicMonthEntry[]>();

  private readonly monthTrackRef = viewChild<ElementRef<HTMLDivElement>>('monthTrack');

  // Drag state
  private dragging = false;
  private dragStartX = 0;
  private dragScrollLeft = 0;
  private hasDragged = false;

  ngAfterViewInit() {
    setTimeout(() => {
      const track = this.monthTrackRef()?.nativeElement;
      const active = track?.querySelector('.active') as HTMLElement | null;
      if (active && track) {
        active.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }, 100);

    document.addEventListener('mousemove', this.onDragMove);
    document.addEventListener('mouseup', this.onDragEnd);
    document.addEventListener('touchmove', this.onDragMove, { passive: false });
    document.addEventListener('touchend', this.onDragEnd);
  }

  ngOnDestroy() {
    document.removeEventListener('mousemove', this.onDragMove);
    document.removeEventListener('mouseup', this.onDragEnd);
    document.removeEventListener('touchmove', this.onDragMove);
    document.removeEventListener('touchend', this.onDragEnd);
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
}
