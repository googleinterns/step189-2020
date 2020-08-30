import {HttpClientTestingModule} from '@angular/common/http/testing';
import {async, ComponentFixture, TestBed} from '@angular/core/testing';
import {ActivatedRoute} from '@angular/router';
import {EMPTY} from 'rxjs';

import {OnePushComponent} from './one-push.component';

describe('OnePushComponent', () => {
  let component: OnePushComponent;
  let fixture: ComponentFixture<OnePushComponent>;

  beforeEach(async(() => {
    TestBed
        .configureTestingModule({
          declarations: [OnePushComponent],
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
    fixture = TestBed.createComponent(OnePushComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
