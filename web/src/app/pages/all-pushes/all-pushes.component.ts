import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { flatMap, map, shareReplay } from 'rxjs/operators';

import { step189_2020 } from '../../../proto/step189_2020';

@Component({
  selector: 'app-all-pushes',
  templateUrl: './all-pushes.component.html',
  styleUrls: ['./all-pushes.component.scss']
})
export class AllPushesComponent {
  readonly pushDefName: Observable<string>;
  readonly pushInfos: Observable<step189_2020.IPushInfo[]>;

  constructor(
    private readonly route: ActivatedRoute,
    private readonly http: HttpClient) {
      this.pushDefName = this.route.url.pipe(
        map((urlSegments) => {
          return urlSegments.map(urlSegment => urlSegment.path).join('/');
        }),
        shareReplay(1));

      this.pushInfos = this.pushDefName.pipe(flatMap(pushDefName => {
        return this.http.get(`assets/${pushDefName}.pb`, {responseType: 'arraybuffer'})
          .pipe(map((data: Uint8Array) => {
            const pushInfos = step189_2020.PushInfos.decode(new Uint8Array(data));
            console.log(pushInfos);
            return pushInfos.pushInfo;
          }));
      }),
      shareReplay(1));
    }
}
