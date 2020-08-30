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
