import { ActivatedRoute } from '@angular/router';
import { Component } from '@angular/core';
import { flatMap, map, shareReplay } from 'rxjs/operators';
import { HttpClient } from '@angular/common/http';
import { Observable, combineLatest } from 'rxjs';

import { step189_2020 } from '../../../proto/step189_2020';

@Component({
  selector: 'app-one-push',
  templateUrl: './one-push.component.html',
  styleUrls: ['./one-push.component.scss']
})
export class OnePushComponent {
  readonly pushHandle: Observable<string>;
  readonly pushDefName: Observable<string>;
  readonly pushInfos: Observable<step189_2020.IPushInfo[]>;
  readonly pushInfo: Observable<step189_2020.IPushInfo>;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly http: HttpClient) {
      this.pushHandle = this.route.url.pipe(
        map((urlSegments) => {
          return urlSegments.map(urlSegment => urlSegment.path).join('/');
        }),
        shareReplay(1));

      this.pushDefName = this.pushHandle.pipe(
        map(pushHandle => pushHandle.split('/@')[0]),
        shareReplay(1));

      this.pushInfos = this.pushDefName.pipe(flatMap(pushDefName => {
        return this.http.get(`assets/${pushDefName}.pb`, {responseType: 'arraybuffer'})
          .pipe(map((data: ArrayBuffer) => {
            const pushInfos = step189_2020.PushInfos.decode(new Uint8Array(data));
            console.log(pushInfos);
            return pushInfos.pushInfo;
          }));
        }),
        shareReplay(1));

      this.pushInfo = combineLatest([this.pushHandle, this.pushInfos]).pipe(
        map(([pushHandle, pushInfos]) => {
          return pushInfos.filter(pushInfo => pushInfo.pushHandle === pushHandle)[0];
        }),
        shareReplay(1));
  }
}
