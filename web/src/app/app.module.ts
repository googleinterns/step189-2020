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
import {AllPushesComponent} from './pages/all-pushes/all-pushes.component';
import {MyPushesComponent} from './pages/my-pushes/my-pushes.component';
import {OnePushComponent} from './pages/one-push/one-push.component';
import {DateNsecPipe} from './pipes/date-nsec.pipe';

@NgModule({
  declarations: [
    AppComponent, AllPushesComponent, BarChartComponent, ButtonComponent,
    ButtonRowComponent, CDFComponent, DateNsecPipe, MyPushesComponent,
    OnePushComponent, PageNameComponent
  ],
  imports: [
    AppRoutingModule, BrowserModule, HttpClientModule, BrowserAnimationsModule,
    MatSlideToggleModule, FormsModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule {
}