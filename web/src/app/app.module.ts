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

import {HttpClientModule} from '@angular/common/http';
import {NgModule} from '@angular/core';
import {FormsModule} from '@angular/forms';
import {MatSlideToggleModule} from '@angular/material/slide-toggle';
import {BrowserModule} from '@angular/platform-browser';
import {BrowserAnimationsModule} from '@angular/platform-browser/animations';

import {AppRoutingModule} from './app-routing.module';
import {AppComponent} from './app.component';
import {BarChartComponent} from './components/bar-chart/bar-chart.component';
import {ButtonRowComponent} from './components/button-row/button-row.component';
import {ButtonComponent} from './components/button/button.component';
import {CDFComponent} from './components/cdf/cdf.component';
import {PageNameComponent} from './components/page-name/page-name.component';
import {TimelineComponent} from './components/timeline/timeline.component';
import {AllPushesComponent} from './pages/all-pushes/all-pushes.component';
import {MyPushesComponent} from './pages/my-pushes/my-pushes.component';
import {OnePushComponent} from './pages/one-push/one-push.component';
import {DateNsecPipe} from './pipes/date-nsec.pipe';

@NgModule({
  declarations: [
    AllPushesComponent,
    AppComponent,
    BarChartComponent,
    ButtonComponent,
    ButtonRowComponent,
    CDFComponent,
    DateNsecPipe,
    MyPushesComponent,
    OnePushComponent,
    PageNameComponent,
    TimelineComponent,
  ],
  imports: [
    AppRoutingModule,
    BrowserModule,
    BrowserAnimationsModule,
    FormsModule,
    HttpClientModule,
    MatSlideToggleModule,
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}
