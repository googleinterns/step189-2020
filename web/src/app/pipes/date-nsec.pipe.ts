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

import {formatDate} from '@angular/common';
import {Pipe, PipeTransform} from '@angular/core';

@Pipe({name: 'dateNsec'})
export class DateNsecPipe implements PipeTransform {
  transform(value: number|Long|null|undefined): string {
    if (typeof value === 'number') {
      return formatDate(
          value / 1000 / 1000, 'yyyy-MM-dd HH:mm:ss.SSS zzzz', 'en-US');
    }
    return '';
  }
}
