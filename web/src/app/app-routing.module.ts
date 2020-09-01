/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {NgModule} from '@angular/core';
import {RouterModule, Routes, UrlMatchResult, UrlSegment} from '@angular/router';

import {AllPushesComponent} from './pages/all-pushes/all-pushes.component';
import {MyPushesComponent} from './pages/my-pushes/my-pushes.component';
import {OnePushComponent} from './pages/one-push/one-push.component';

/**
 * Matcher for the URLs for individual pushes.
 *
 * Example: /test/razvanm/helloworld/@20180503-163004.520847
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

@NgModule({imports: [RouterModule.forRoot(routes)], exports: [RouterModule]})
export class AppRoutingModule {
}
