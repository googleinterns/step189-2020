import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { MyPushesComponent } from './pages/my-pushes/my-pushes.component';
import { AllPushesComponent } from './pages/all-pushes/all-pushes.component';
import { OnePushComponent } from './pages/one-push/one-push.component';

@NgModule({
  declarations: [
    AppComponent,
    MyPushesComponent,
    AllPushesComponent,
    OnePushComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
