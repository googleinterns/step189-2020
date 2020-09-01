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

import {Component, OnInit} from '@angular/core';

interface PushDef {
  name: string;
  notes: string;
}

@Component({
  selector: 'app-my-pushes',
  templateUrl: './my-pushes.component.html',
  styleUrls: ['./my-pushes.component.scss']
})
export class MyPushesComponent {
  // These push names need corresponding .pb files in the src/assets/ dir.
  readonly pushDefs: PushDef[] = [
    {name: '28a1555e453f', notes: '11K pushes'},
    {name: '34c2a696eb6b', notes: '500 pushes'},
    {name: '4089ddf3a6d4', notes: '458 pushes'},
    {name: '42465163e7e9', notes: '14K pushes'},
    {name: '50974993f48e', notes: '171 pushes'},
    {name: '7f4535707267', notes: '83 pushes'},
    {name: 'c65c37c6e1fb', notes: '1.7K pushes'},
  ];
}
