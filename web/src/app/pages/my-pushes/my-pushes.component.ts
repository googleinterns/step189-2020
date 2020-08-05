import { Component, OnInit } from '@angular/core';

@Component({
  selector: 'app-my-pushes',
  templateUrl: './my-pushes.component.html',
  styleUrls: ['./my-pushes.component.scss']
})
export class MyPushesComponent {
  // These push names need corresponding .pb files in the src/assets/ dir.
  readonly pushDefsNames = [
    '28a1555e453f',
    '34c2a696eb6b',
    '4089ddf3a6d4',
    '42465163e7e9',
    '50974993f48e',
    '7f4535707267',
    'c65c37c6e1fb',
  ];
}
