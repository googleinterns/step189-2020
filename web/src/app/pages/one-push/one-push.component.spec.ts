import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { OnePushComponent } from './one-push.component';

describe('OnePushComponent', () => {
  let component: OnePushComponent;
  let fixture: ComponentFixture<OnePushComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ OnePushComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(OnePushComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
