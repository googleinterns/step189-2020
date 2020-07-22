import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { AllPushesComponent } from './all-pushes.component';

describe('AllPushesComponent', () => {
  let component: AllPushesComponent;
  let fixture: ComponentFixture<AllPushesComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ AllPushesComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(AllPushesComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
