import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MyPushesComponent } from './pages/my-pushes/my-pushes.component';
import { AllPushesComponent } from './pages/all-pushes/all-pushes.component';
import { OnePushComponent } from './pages/one-push/one-push.component';
import { ButtonRowComponent } from './components/button-row/button-row.component';
import { ButtonComponent } from './components/button/button.component';
import { PageNameComponent } from './components/page-name/page-name.component';
import { DateNsecPipe } from './pipes/date-nsec.pipe';
import { CDFComponent } from './components/cdf/cdf.component';

@NgModule({
  declarations: [
    AppComponent,
    MyPushesComponent,
    AllPushesComponent,
    OnePushComponent,
    ButtonRowComponent,
    ButtonComponent,
    PageNameComponent,
    DateNsecPipe,
    CDFComponent
  ],
  imports: [
    BrowserModule,
    HttpClientModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
