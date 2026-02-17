import { Component, ElementRef, input, effect, viewChild, signal, output } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  VisibilityGrid,
  VisibilityCategory,
  type CrescentType,
} from '../services/islamic-month.service';
import { type UserLocation } from '../services/location.service';
import * as d3 from 'd3';
import * as topojson from 'topojson-client';

@Component({
  selector: 'app-moon-map',
  imports: [CommonModule],
  templateUrl: './moon-map.component.html',
  styleUrl: './moon-map.component.scss',
})
export class MoonMapComponent {
  readonly visibilityGrid = input.required<VisibilityGrid>();
  readonly userLocation = input<UserLocation | null>(null);
  readonly mapReady = output<void>();

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('mapCanvas');
  private readonly wrapperRef = viewChild.required<ElementRef<HTMLDivElement>>('mapWrapper');

  private worldData: any = null;
  readonly loading = signal(true);

  private readonly CANVAS_WIDTH = 1600;
  private readonly CANVAS_HEIGHT = 900;

  private readonly COLORS: Record<VisibilityCategory, string> = {
    [VisibilityCategory.EASILY_VISIBLE]: 'rgba(50, 220, 120, 0.38)',
    [VisibilityCategory.VISIBLE_PERFECT_CONDITIONS]: 'rgba(255, 225, 50, 0.35)',
    [VisibilityCategory.OPTICAL_AID_TO_FIND]: 'rgba(255, 165, 50, 0.35)',
    [VisibilityCategory.OPTICAL_AID_ONLY]: 'rgba(255, 90, 70, 0.32)',
    [VisibilityCategory.NOT_VISIBLE]: 'rgba(0, 0, 0, 0)',
  };

  constructor() {
    effect(() => {
      const grid = this.visibilityGrid();
      if (grid) {
        this.loadAndRender(grid);
      }
    });
  }

  private async loadAndRender(grid: VisibilityGrid) {
    this.loading.set(true);
    if (!this.worldData) {
      try {
        const resp = await fetch('/world-110m.json');
        this.worldData = await resp.json();
      } catch (e) {
        console.error('Failed to load world map data:', e);
        this.loading.set(false);
        return;
      }
    }
    this.renderMap(grid);
    this.loading.set(false);
    this.mapReady.emit();
  }

  private renderMap(grid: VisibilityGrid) {
    const canvas = this.canvasRef().nativeElement;
    const ctx = canvas.getContext('2d')!;

    canvas.width = this.CANVAS_WIDTH;
    canvas.height = this.CANVAS_HEIGHT;

    const projection = d3
      .geoNaturalEarth1()
      .fitSize([this.CANVAS_WIDTH, this.CANVAS_HEIGHT], { type: 'Sphere' } as any);

    const path = d3.geoPath(projection, ctx);

    // Background color (ocean)
    ctx.fillStyle = '#0d1b2a';
    ctx.fillRect(0, 0, this.CANVAS_WIDTH, this.CANVAS_HEIGHT);

    // Draw graticule
    const graticule = d3.geoGraticule10();
    ctx.beginPath();
    path(graticule);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.07)';
    ctx.lineWidth = 0.5;
    ctx.stroke();

    // Draw sphere outline
    ctx.beginPath();
    path({ type: 'Sphere' } as any);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Draw land
    const countries = topojson.feature(this.worldData, this.worldData.objects.countries) as any;
    ctx.beginPath();
    path(countries);
    ctx.fillStyle = '#1b2838';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 0.3;
    ctx.stroke();

    // Draw visibility overlay on top of everything
    this.drawVisibilityOverlay(ctx, projection, grid);

    // Draw land borders on top of the overlay for definition
    ctx.beginPath();
    path(countries);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 0.8;
    ctx.stroke();

    // Draw title and date
    this.drawTitleAndDate(ctx, grid);

    // Draw legend
    this.drawLegend(ctx);

    // Draw user location pin
    const loc = this.userLocation();
    if (loc) {
      this.drawUserPin(ctx, projection, loc);
    }
  }

  private drawVisibilityOverlay(
    ctx: CanvasRenderingContext2D,
    projection: d3.GeoProjection,
    grid: VisibilityGrid,
  ) {
    const res = grid.gridResolution;

    for (const point of grid.results) {
      if (point.category === VisibilityCategory.NOT_VISIBLE) continue;

      const color = this.COLORS[point.category];

      // Create a GeoJSON polygon for this grid cell
      const halfRes = res / 2;
      const minLat = Math.max(-90, point.lat - halfRes);
      const maxLat = Math.min(90, point.lat + halfRes);
      const minLng = Math.max(-180, point.lng - halfRes);
      const maxLng = Math.min(180, point.lng + halfRes);

      const geoCell: GeoJSON.Feature = {
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'Polygon',
          // GeoJSON requires counterclockwise winding for exterior rings
          coordinates: [
            [
              [minLng, minLat],
              [minLng, maxLat],
              [maxLng, maxLat],
              [maxLng, minLat],
              [minLng, minLat],
            ],
          ],
        },
      };

      const path = d3.geoPath(projection, ctx);
      ctx.beginPath();
      path(geoCell);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }

  private drawTitleAndDate(ctx: CanvasRenderingContext2D, grid: VisibilityGrid) {
    const dateStr = grid.date.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    // Build title from Islamic month label or fallback
    const titleText = grid.islamicMonthLabel
      ? `🌙 ${grid.islamicMonthLabel}`
      : '🌒 Evening Crescent Visibility';

    const dayLabel = grid.dayLabel ?? 'Observation: After Sunset';

    // Draw dark overlay header band
    const gradient = ctx.createLinearGradient(0, 0, 0, 140);
    gradient.addColorStop(0, 'rgba(0, 0, 0, 0.75)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, this.CANVAS_WIDTH, 140);

    // Title (Islamic month)
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 39px "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(titleText, 30, 14);

    // Date + day label
    ctx.font = '36px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#b0bec5';
    ctx.fillText(`Evening of ${dateStr}`, 30, 60);

    // Moon age info (right side)
    ctx.textAlign = 'right';
    ctx.font = '17px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#90a4ae';

    if (grid.newMoonTime) {
      const ageHours = (grid.date.getTime() - grid.newMoonTime.getTime()) / (3600 * 1000);
      let ageText: string;
      if (ageHours >= 0) {
        const ageDays = Math.floor(ageHours / 24);
        const ageRemainingHours = Math.floor(ageHours % 24);
        ageText = `Moon Age: ${ageDays}d ${ageRemainingHours}h since New Moon`;
      } else {
        const absHours = Math.abs(ageHours);
        const h = Math.floor(absHours);
        ageText = `New Moon occurs in ~${h}h (today)`;
      }
      ctx.fillText(ageText, this.CANVAS_WIDTH - 30, 16);
      ctx.fillText(
        `New Moon: ${grid.newMoonTime.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })} ${grid.newMoonTime.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short',
        })}`,
        this.CANVAS_WIDTH - 30,
        40,
      );
    }

    // Attribution
    ctx.textAlign = 'right';
    ctx.font = 'bold 28px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillText(
      'IslamicMonth.com',
      this.CANVAS_WIDTH - 25,
      this.CANVAS_HEIGHT - 60,
    );
  }

  private drawLegend(ctx: CanvasRenderingContext2D) {
    const legendItems = [
      {
        label: 'A - Easily visible (naked eye)',
        color: this.COLORS[VisibilityCategory.EASILY_VISIBLE],
      },
      {
        label: 'B - Visible (perfect conditions)',
        color: this.COLORS[VisibilityCategory.VISIBLE_PERFECT_CONDITIONS],
      },
      {
        label: 'C - Optical aid to find moon',
        color: this.COLORS[VisibilityCategory.OPTICAL_AID_TO_FIND],
      },
      {
        label: 'D - Visible with optical aid only',
        color: this.COLORS[VisibilityCategory.OPTICAL_AID_ONLY],
      },
    ];

    const legendX = 20;
    const legendY = this.CANVAS_HEIGHT - 260;
    const boxWidth = 520;
    const boxHeight = 240;

    // Semi-transparent background
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.beginPath();
    ctx.roundRect(legendX, legendY, boxWidth, boxHeight, 12);
    ctx.fill();

    ctx.font = 'bold 24px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Visibility Legend', legendX + 20, legendY + 32);

    legendItems.forEach((item, i) => {
      const y = legendY + 72 + i * 44;

      // Color swatch
      ctx.fillStyle = item.color;
      ctx.fillRect(legendX + 20, y - 14, 36, 28);
      ctx.strokeStyle = 'rgba(255,255,255,0.3)';
      ctx.lineWidth = 1;
      ctx.strokeRect(legendX + 20, y - 14, 36, 28);

      // Label
      ctx.fillStyle = '#e0e0e0';
      ctx.font = '22px "Segoe UI", system-ui, sans-serif';
      ctx.fillText(item.label, legendX + 68, y);
    });
  }

  private drawUserPin(
    ctx: CanvasRenderingContext2D,
    projection: d3.GeoProjection,
    loc: UserLocation,
  ) {
    const coords = projection([loc.lng, loc.lat]);
    if (!coords) return;

    const [x, y] = coords;
    const pinHeight = 52;
    const pinRadius = 18;

    // Drop shadow
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;

    // Pin body (teardrop)
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.bezierCurveTo(
      x - pinRadius,
      y - pinHeight * 0.55,
      x - pinRadius,
      y - pinHeight + pinRadius * 0.3,
      x,
      y - pinHeight,
    );
    ctx.bezierCurveTo(
      x + pinRadius,
      y - pinHeight + pinRadius * 0.3,
      x + pinRadius,
      y - pinHeight * 0.55,
      x,
      y,
    );
    ctx.fillStyle = '#e53935';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Inner circle
    ctx.beginPath();
    ctx.arc(x, y - pinHeight + pinRadius * 1.1, pinRadius * 0.45, 0, Math.PI * 2);
    ctx.fillStyle = '#fff';
    ctx.fill();

    ctx.restore();

    // Label
    ctx.font = 'bold 18px "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Draw a background behind the label
    const labelText = loc.displayName.split(',')[0]; // Just city name
    const metrics = ctx.measureText(labelText);
    const lblX = x;
    const lblY = y - pinHeight - 8;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.beginPath();
    ctx.roundRect(lblX - metrics.width / 2 - 8, lblY - 20, metrics.width + 16, 26, 6);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(labelText, lblX, lblY);
  }

  getCanvasDataURL(): string {
    const canvas = this.canvasRef().nativeElement;
    return canvas.toDataURL('image/png');
  }
}
