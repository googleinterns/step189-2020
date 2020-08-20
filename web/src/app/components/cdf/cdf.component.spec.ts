import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { CdfComponent } from './cdf.component';

describe('CdfComponent', () => {
  let component: CdfComponent;
  let fixture: ComponentFixture<CdfComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ CdfComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(CdfComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
