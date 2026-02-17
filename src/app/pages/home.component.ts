import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterModule, Router, ActivatedRoute } from '@angular/router';
import { IslamicMonthService, IslamicMonthEntry } from '../services/islamic-month.service';
import { LocationService } from '../services/location.service';
import { LocationDialogService } from '../services/location-dialog.service';
import { LocationDialogComponent } from '../components/location-dialog.component';
import { TopbarComponent } from '../components/topbar.component';
import { HeaderMessageComponent } from '../components/header-message.component';
import { MonthStripComponent } from '../components/month-strip.component';
import { FooterComponent } from '../components/footer.component';

@Component({
  selector: 'app-home',
  imports: [
    RouterModule,
    LocationDialogComponent,
    TopbarComponent,
    HeaderMessageComponent,
    MonthStripComponent,
    FooterComponent,
  ],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss',
})
export class HomeComponent implements OnInit {
  private readonly moonService = inject(IslamicMonthService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly locationService = inject(LocationService);
  readonly locationDialogService = inject(LocationDialogService);
  readonly islamicMonths = signal<IslamicMonthEntry[]>([]);

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

  closeLocationDialog() {
    this.locationDialogService.close();
  }
}
