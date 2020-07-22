import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { MyPushesComponent } from './my-pushes.component';

describe('MyPushesComponent', () => {
  let component: MyPushesComponent;
  let fixture: ComponentFixture<MyPushesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ MyPushesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(MyPushesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
