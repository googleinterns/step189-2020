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

import {HttpClient} from '@angular/common/http';
import {Component} from '@angular/core';
import {ActivatedRoute} from '@angular/router';
import {Observable} from 'rxjs';
import {flatMap, map, shareReplay} from 'rxjs/operators';

import {step189_2020} from '../../../proto/step189_2020';

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

    this.pushInfos = this.pushDefName.pipe(
        flatMap(pushDefName => {
          return this.http
              .get(`assets/${pushDefName}.pb`, {responseType: 'arraybuffer'})
              .pipe(map((data: ArrayBuffer) => {
                const pushInfos =
                    step189_2020.PushInfos.decode(new Uint8Array(data));
                console.log(pushInfos);
                return pushInfos.pushInfo;
              }));
        }),
        shareReplay(1));
  }
}
