import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CDFComponent } from './cdf.component';

describe('CDFComponent', () => {
  let component: CDFComponent;
  let fixture: ComponentFixture<CDFComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CDFComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CDFComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
