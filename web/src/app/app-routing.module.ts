import { NgModule } from '@angular/core';
import { Routes, RouterModule, UrlSegment, UrlMatchResult } from '@angular/router';

import { AllPushesComponent } from './pages/all-pushes/all-pushes.component';
import { MyPushesComponent } from './pages/my-pushes/my-pushes.component';
import { OnePushComponent } from './pages/one-push/one-push.component';

/**
 * Matcher for the URLs for individual pushes.
 *
 * EXample: /test/razvanm/helloworld/@20180503-163004.520847
 */
export function onePushMatcher(segments: UrlSegment[]): UrlMatchResult {
  const noMatch = {consumed: []};
  if (!segments[segments.length - 1].path.startsWith('@')) {
    return noMatch;
  }
  return {consumed: segments};
}

const routes: Routes = [
  {
    path: '',
    component: MyPushesComponent,
    pathMatch: 'full',
  },
  {
    component: OnePushComponent,
    matcher: onePushMatcher,
  },
  {
    path: '**',
    component: AllPushesComponent,
  },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
