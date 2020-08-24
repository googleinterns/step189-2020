import { Component, ElementRef, Input, ViewChild, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';

import { step189_2020 } from '../../../proto/step189_2020';

interface CdfData {
  duration: number; // Minutes between completed stage and first non-empty stage
  probability: number; // Rank of the duration divided by number of points
}

type d3SVG = d3.Selection<SVGSVGElement, undefined, null, undefined>;

@Component({
  selector: 'app-cdf',
  templateUrl: './cdf.component.html',
  styleUrls: ['./cdf.component.scss']
})

export class CdfComponent implements AfterViewInit {
  private static readonly NANO_TO_MINUTES: number = (10 ** 9) * 60;
  private static readonly COMPLETED_BLUE: string = '#00bfa5';
  private static readonly COMPLETED_STATE_TAG: number = 5;

  @ViewChild('cdf') private cdfContainer!: ElementRef;
  @Input() pushInfos!: step189_2020.IPushInfo[] | null;
  @Input() currentPush!: step189_2020.IPushInfo | null;

  /*
   * The non-null assertion operator (!) indicates to the compiler that the
   * variables will always be declared and will never be null or undefined.
   */
  private data: CdfData[] = [];
  private graphData: CdfData[] = [];
  private svg!: d3SVG;
  private height!: number;
  private width!: number;
  private xScale!: d3.ScaleLinear<number, number>;
  private yScale!: d3.ScaleLinear<number, number>;

  /*
   * Calculates the duration between the completed stage and the first non-empty
   * stage. Assigns the probability as the rank of the duration value over the
   * total number of points. The duration and probability are defined in an
   * interface and all points stored as an array of CdfData interfaces.
   */
  private populateData(pushInfos: step189_2020.IPushInfo[] | null): void {
    if (!pushInfos) { return; }

    const durations: number[] = [];
    pushInfos.forEach(pushInfo => {
      if (!pushInfo) { return; }
      const states = pushInfo.stateInfo;
      if (!states) { return; }
      const pushEndTime = states[states.length - 1].startTimeNsec;
      if (!pushEndTime) { return; }
      const finalState = states[states.length - 1].state;
      if (!finalState) { return; }

      if (finalState === CdfComponent.COMPLETED_STATE_TAG) {
        // Find the start time of the first non-empty stage
        let firstStateStart: number | Long = -1;
        for (const state of states) {
          if (state.stage && state.startTimeNsec) {
            firstStateStart = state.startTimeNsec;
            break;
          }
        }
        if (firstStateStart !== -1) {
          const duration = (+pushEndTime - +firstStateStart) / CdfComponent.NANO_TO_MINUTES;
          durations.push(duration);
        }
      }
    });

    const sortedArray: number[] = durations.sort((n1, n2) => n1 - n2);

    const durationLength = sortedArray.length;
    for (let i = 0; i < durationLength; i++) {
      const duration = sortedArray[i];
      const probability = (i + 1) / durationLength;
      this.data.push({
        duration,
        probability
      } as CdfData);
    }
  }

  /*
   * Structure of the SVG:
   * CdfChart:
   *     - yAxisLeft, yAxisRight, xAxis
   *     - Axis labels and title
   *     - Step function CDF plot
   */
  private createChart(): void {
    this.populateData(this.pushInfos);

    const element = this.cdfContainer.nativeElement;
    const elementWidth = element.clientWidth;
    const elementHeight = element.clientHeight;

    const margin = { top: 50, right: 50, bottom: 50, left: 50 };

    this.width = elementWidth - margin.left - margin.right;
    this.height = elementHeight - margin.top - margin.bottom;

    const maxDuration = d3.max(this.data, d => d.duration);
    if (!maxDuration) { return; }

    this.xScale = d3
      .scaleLinear()
      .domain([0, maxDuration + 1])
      .rangeRound([0, this.width])
      .nice();

    this.yScale = d3
      .scaleLinear()
      .domain([0, 1])
      .rangeRound([this.height, 0]);

    this.graphData = Array.from(this.data);
    this.graphData.push({
      duration: this.xScale.ticks()[this.xScale.ticks().length - 1],
      probability: 1
    });

    this.svg = (d3
      .select(element)
      .append('svg') as d3SVG)
      .attr('width', elementWidth)
      .attr('height', elementHeight);

    const cdfChart = this.svg
      .append('g')
      .attr('id', 'chart')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const yAxisLeft = cdfChart
      .append('g')
      .attr('class', 'y-axis-left')
      .call(d3
        .axisLeft(this.yScale)
        .ticks(10)
        .tickFormat(d3.format(',.1f'))
      );

    // Removes axis's vertical line and keeps the tick marks
    yAxisLeft.select('.domain').remove();

    cdfChart.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left)
      .attr('x', -this.height / 2)
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Probability');

    const yAxisRight = cdfChart
      .append('g')
      .attr('class', 'y-axis-right')
      .attr('transform', `translate(${this.width}, 0)`)
      .call(d3
        .axisRight(this.yScale)
        .ticks(10)
        .tickFormat(d3.format(',.1f'))
      );

    // Removes axis's vertical line and keeps the tick marks
    yAxisRight.select('.domain').remove();

    const xAxis = cdfChart
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${this.height})`)
      .call(d3.axisBottom(this.xScale));

    cdfChart.append('text')
      .attr('transform',
            `translate(${this.width / 2}, ${this.height + margin.bottom / 2})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Duration (minutes)');

    cdfChart.append('text')
      .attr('x', this.width / 2)
      .attr('y', -margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text('CDF');

    cdfChart
      .datum(this.graphData)
      .append('path')
      .attr('fill', CdfComponent.COMPLETED_BLUE)
      .attr('d', d3.area<CdfData>()
        .x(d => this.xScale(d.duration))
        .y1(d => this.yScale(d.probability))
        .y0(this.yScale(0))
        .curve(d3.curveStepAfter)
      );
  }

  /*
   * After the component's view has been fully initialized, the chart can be
   * created. Since the pushInfos are static, we do not need to create the chart
   * at every change.
   */
  ngAfterViewInit(): void {
    this.createChart();
  }
}
