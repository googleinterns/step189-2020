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
