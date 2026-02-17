import { Component, inject } from '@angular/core';
import { LocationService } from '../services/location.service';
import { LocationDialogService } from '../services/location-dialog.service';

@Component({
  selector: 'app-topbar',
  templateUrl: './topbar.component.html',
  styleUrl: './topbar.component.scss',
})
export class TopbarComponent {
  readonly locationService = inject(LocationService);
  private readonly locationDialogService = inject(LocationDialogService);

  openLocationDialog() {
    this.locationDialogService.open();
  }
}
