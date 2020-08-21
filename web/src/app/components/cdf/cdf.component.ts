import { Component, OnInit, OnChanges, Input, ViewChild, ElementRef, SimpleChanges } from '@angular/core';
import * as d3 from 'd3';

import { step189_2020 } from '../../../proto/step189_2020';

interface cdfData {
  duration: number;
  probability: number;
}

@Component({
  selector: 'app-cdf',
  templateUrl: './cdf.component.html',
  styleUrls: ['./cdf.component.scss']
})
export class CdfComponent implements OnInit, OnChanges {
  @ViewChild('cdf') private cdfContainer!: ElementRef;
  @Input() pushInfos!: step189_2020.IPushInfo[];
  @Input() currentPush!: step189_2020.IPushInfo;

  private data: cdfData[] = [];
  private svg!: any;
  private height!: number;
  private width!: number;
  private xScale!: d3.ScaleLinear<number, number>;
  private yScale!: d3.ScaleLinear<number, number>;


  private readonly NANO_TO_MINUTES: number = 10**9 * 60;

  private parseData(pushInfos: step189_2020.IPushInfo[]): void {
    if (!pushInfos) { return; }

    let durations: number[] = [];
    pushInfos.forEach(pushInfo => {
      if (!pushInfo) { return; }
      const pushes = pushInfo.stateInfo;
      if (!pushes) { return; }
      const pushesStartTime = pushes[0].startTimeNsec;
      if (!pushesStartTime) { return; }
      const pushesEndTime = pushes[pushes.length-1].startTimeNsec;
      if (!pushesEndTime) { return; }
      const pushID = pushInfo.pushHandle;
      if (!pushID) { return; }
      const state = pushes[pushes.length-1].state;
      if (!state) { return; }
      
      if (state == 5) {
        // Convert the duration into minutes
        // The unary operator coerces the value to number type.
        let firstStateStart: number | Long = -1
        for (let i = 0; i < pushes.length; i++) {
          let stateInfo = pushes[i];
          if (stateInfo.stage) {
            firstStateStart = stateInfo.startTimeNsec;
            break;
          }
        }
        const duration = (+pushesEndTime - +firstStateStart) / this.NANO_TO_MINUTES;
        durations.push(duration)
      }
    })
    durations.sort();
    const durationLength = durations.length;
    for (let i = 0; i < durationLength; i++) {
      const duration = durations[i];
      const probability = (i+1) / durationLength;
      const cdfDatum: cdfData = {
        duration,
        probability
      };
      this.data.push(cdfDatum);
    }
  }

  ngOnInit(): void {}

  ngOnChanges(changes: SimpleChanges): void {
    // Since ngOnChanges() runs before the view can be initialized, any
    // attempts to access our @ViewChild will result in null. Thus, we
    // bypass the first change that occurs in order to first render the view.
    if (!changes['pushInfos'].isFirstChange()) {
      this.updateChart(changes.pushInfos.currentValue, changes.currentPush.currentValue);
    }
  }

  private createChart(pushInfos: step189_2020.IPushInfo[]): void {

    this.parseData(pushInfos);
    // CHANGE
    const startValue = 100;
    const element = this.cdfContainer.nativeElement;
    element.classList.add('cdf-chart');
    const elementWidth = element.clientWidth;
    const elementHeight = element.clientHeight;

    const margin = { top: 50, right: 50, bottom: 50, left: 50 };

    this.width = elementWidth - margin.left - margin.right;
    this.height = elementHeight - margin.top - margin.bottom;

    
    // Establish the x-axis
    this.xScale = d3
      .scaleLinear()
      .domain([0, d3.max(this.data, d => d.duration)+1])
      .rangeRound([0, this.width])
      .nice()

    this.yScale = d3
      .scaleLinear()
      .domain(d3.extent(this.data, d => d.probability))
      .rangeRound([this.height, 0])

    this.svg = d3
      .select(element)
      .append('svg')
      .attr('width', elementWidth)
      .attr('height', elementHeight);
      //.on('mousemove', moveRuler);
    
    const defs = this.svg.append('defs');

    const clipRect = defs
      .append('clipPath')
      .attr('id', 'area-clip')
      .append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", this.xScale(startValue))
      .attr("height", this.height);
    
    const cdfChart = this.svg
      .append('g')
      .attr('id', 'chart')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);
  
    const yAxisLeft = cdfChart
      .append('g')
      .attr('class', 'y-axis-left')
      .call(
        d3
          .axisLeft(this.yScale)
          .ticks(10)
          .tickFormat(d3.format(",.1f"))
      )
      .call(g => g.select(".domain")
          .remove());
    
        
  const yAxisRight = cdfChart
    .append('g')
    .attr('class', 'axis axis_y_right')
    .attr("transform", "translate(" + (this.width) + ",0)")
    .call(
      d3
        .axisRight(this.yScale)
        .ticks(10)
        .tickFormat(d3.format(",.1f"))
    )
    .call(g => g.select(".domain")
        .remove());

  const xAxis = cdfChart
    .append('g')
    .attr('class', 'x-axis')
    .attr('transform', `translate(0, ${this.height})`)
    .call(d3.axisBottom(this.xScale));

  }

  private updateChart(pushInfos: step189_2020.IPushInfo[], currentPush: step189_2020.IPushInfo): void{
    if (!this.svg) {
      //console.log(pushInfos);
      console.log(currentPush);
      this.createChart(pushInfos);
      //console.log(this.data)
      return;
    }
  }

}
