import {HttpClientTestingModule} from '@angular/common/http/testing';
import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {EMPTY} from 'rxjs';

import {AllPushesComponent} from './all-pushes.component';

describe('AllPushesComponent', () => {
  let component: AllPushesComponent;
  let fixture: ComponentFixture<AllPushesComponent>;

  beforeEach(async(() => {
    TestBed
        .configureTestingModule({
          declarations: [AllPushesComponent],
          imports: [HttpClientTestingModule],
          providers: [
            {
              provide: ActivatedRoute,
              useValue: {url: EMPTY},
            },
          ],
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
