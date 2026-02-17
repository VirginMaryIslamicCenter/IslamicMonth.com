import { Routes, type CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { HomeComponent } from './pages/home.component';
import { MonthDetailComponent } from './pages/month-detail.component';
import { IslamicMonthService } from './services/islamic-month.service';

/**
 * Guard that redirects the root path to the nearest upcoming new moon month.
 */
const redirectToCurrentMonth: CanActivateFn = () => {
  const moonService = inject(IslamicMonthService);
  const router = inject(Router);
  const months = moonService.getUpcomingIslamicMonths(new Date(), 12);
  const route = moonService.getNearestMonthRoute(months);
  router.navigateByUrl(route, { replaceUrl: true });
  return false;
};

export const routes: Routes = [
  {
    path: '',
    component: HomeComponent,
    children: [
      {
        path: ':year/:month',
        component: MonthDetailComponent,
      },
    ],
  },
  {
    path: '**',
    canActivate: [redirectToCurrentMonth],
    component: HomeComponent, // never actually shown
  },
];
