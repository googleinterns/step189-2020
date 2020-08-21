import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';
import * as d3 from 'd3';

import { step189_2020 } from '../../../proto/step189_2020';
import { generate } from 'rxjs';

interface Item {
  duration: number; // Minutes between completed stage and first non-empty stage
  probability: number; // Rank of the duration divided by number of points
}

/**
 * Defines the type of the d3 SVG. The d3.Selection has a generic type
 * Selection<GElement, Datum, PElement, PDatum>. We want our svg element to have
 * the interface SVGSVGElement. Datum, PElement, and PDatum are unused and thus,
 * assigned to undefined or null.
 */
type d3SVG = d3.Selection<SVGSVGElement, undefined, null, undefined>;

@Component({
  selector: 'app-cdf',
  templateUrl: './cdf.component.html',
  styleUrls: ['./cdf.component.scss']
})

export class CDFComponent implements AfterViewInit {
  private static readonly NANO_TO_MINUTES: number = (10 ** 9) * 60;
  private static readonly COMPLETED_BLUE: string = '#00bfa5';
  private static readonly COMPLETED_STATE_TAG: number = 5;

  @ViewChild('cdf') private CDFContainer!: ElementRef;
  @Input() pushInfos!: step189_2020.IPushInfo[] | null;
  @Input() currentPush!: step189_2020.IPushInfo | null;

  private data: Item[] = [];
  private graphData: Item[] = [];
  private svg: d3SVG | undefined;

  /**
   * Calculates the duration between the completed stage and the first non-empty
   * stage. Assigns the probability as the rank of the duration value over the
   * total number of points. The duration and probability are defined in an
   * interface and all points stored as an array of CdfData interfaces.
   *
   * @param pushInfos Array of pushes for a single push def
   * @return Array of Items sorted by increasing duration
   */
  private static populateData(pushInfos: step189_2020.IPushInfo[]): Item[] {
    const durations: number[] = [];
    pushInfos.forEach(pushInfo => {
      if (!pushInfo) { return; }
      const states = pushInfo.stateInfo;
      if (!states) { return; }
      const pushEndTime = states[states.length - 1].startTimeNsec;
      if (!pushEndTime) { return; }
      const finalState = states[states.length - 1].state;
      if (!finalState) { return; }

      if (finalState === CDFComponent.COMPLETED_STATE_TAG) {
        // Find the start time of the first non-empty stage.
        let firstStateStart: number | Long = -1;
        for (const state of states) {
          if (state.stage && state.startTimeNsec) {
            firstStateStart = state.startTimeNsec;
            break;
          }
        }
        if (firstStateStart !== -1) {
          const duration = (+pushEndTime - +firstStateStart) / CDFComponent.NANO_TO_MINUTES;
          durations.push(duration);
        }
      }
    });

    const sortedArray: number[] = durations.sort((n1, n2) => n1 - n2);

    const data: Item[] = [];
    const durationLength = sortedArray.length;
    for (let i = 0; i < durationLength; i++) {
      const duration = sortedArray[i];
      const probability = (i + 1) / durationLength;
      data.push({
        duration,
        probability
      } as Item);
    }

    return data;
  }

  /**
   * Creates a CDF chart by plotting the duration of completed pushes against
   * the probability of a push taking less time than that duration.
   *
   * Structure of the SVG:
   * <svg>
   *   <g id='chart'>
   *     <g class='y-axis-left'></g>
   *     <text class='y-axis-left-label'></text>
   *     <g class='y-axis-right'></g>
   *     <path class='cdf-curve'></path>
   *   </g>
   *   <g class='x-axis'></g>
   *   <text class='x-axis-label'></text>
   *   <text class='graph-title'></text>
   * </svg>
   */
  ngAfterViewInit(): void {
    if (!this.pushInfos) { return; }
    this.data = CDFComponent.populateData(this.pushInfos);

    const element = this.CDFContainer.nativeElement;
    const elementWidth = element.clientWidth;
    const elementHeight = element.clientHeight;

    const margin = { top: 50, right: 50, bottom: 50, left: 50 };

    const width = elementWidth - margin.left - margin.right;
    const height = elementHeight - margin.top - margin.bottom;

    const maxDuration = d3.max(this.data, d => d.duration);
    if (!maxDuration) { return; }

    const minDuration = d3.min(this.data, d => d.duration);
    if (!minDuration) { return; }

    const xScale = d3
      .scaleLinear()
      .domain([0, maxDuration + 1])
      .rangeRound([0, width])
      .nice();

    const yScale = d3
      .scaleLinear()
      .domain([0, 1])
      .rangeRound([height, 0]);

    this.graphData = Array.from(this.data);
    this.graphData.push({
      duration: xScale.ticks()[xScale.ticks().length - 1],
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
        .axisLeft(yScale)
        .ticks(10)
        .tickFormat(d3.format(',.1f'))
      );

    yAxisLeft.select('.domain').remove();

    this.svg.append('text')
      .attr('transform', 'rotate(-90)')
      .attr('y', 0)
      .attr('x', -elementHeight / 2)
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Probability');

    const yAxisRight = cdfChart
      .append('g')
      .attr('class', 'y-axis-right')
      .attr('transform', `translate(${width}, 0)`)
      .call(d3
        .axisRight(yScale)
        .ticks(10)
        .tickFormat(d3.format(',.1f'))
      );

    yAxisRight.select('.domain').remove();

    const xAxis = cdfChart
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(0, ${height})`)
      .call(d3.axisBottom(xScale));

    this.svg.append('text')
      .attr('transform',
            `translate(${width / 2}, ${elementHeight - margin.left / 3})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Duration (minutes)');

    cdfChart
      .datum(this.graphData)
      .append('path')
      .attr('fill', CDFComponent.COMPLETED_BLUE)
      .attr('d', d3.area<Item>()
        .x(d => xScale(d.duration))
        .y1(d => yScale(d.probability))
        .y0(yScale(0))
        .curve(d3.curveStepAfter)
      );

    const quantileLines = this.svg
      .append('g')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const percentileLines = [0.1, 0.5, 0.9];
    const quantiles =  this.generateQuantiles(percentileLines, xScale);

    quantileLines
      .selectAll('.quantile-lines')
      .data(quantiles)
      .enter()
      .append('line')
      .attr('class', 'y-guideline')
      .attr('stroke', 'lightgrey')
      .attr('stroke-dasharray', '5,2')
      .attr('x1', (d: Item) => xScale(d.duration))
      .attr('y1', height)
      .attr('x2', (d: Item) => xScale(d.duration))
      .attr('y2', 0);

    quantileLines
      .selectAll('.quantile-lines')
      .data(quantiles)
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('x', (d: Item) => xScale(d.duration))
      .attr('y', 0)
      .attr('id', 'quantile-text')
      .attr('font-size', '10px')
      .text((d: Item) => `${d.probability * 100}%`);

    const dotplotContainer = this.svg
      .append('g')
      .attr('id', 'dotplot-container')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    let radius = 2.5;
    let yPosition = this.generateYPosition(radius * 2 + 0.1, xScale);
    if (d3.max(yPosition, d => d.y) > height) {
      radius = 1.4;
      yPosition = this.generateYPosition(radius * 2 + 0.1, xScale);
    }
    for (let i = 0; i < this.data.length; i++) {
      const cx = xScale(this.data[i].duration);
      const cy = height - yPosition[i].y - radius;
      dotplotContainer.append('circle')
          .attr('cx', cx)
          .attr('r', radius)
          .attr('cy', cy)
          .attr('fill', 'black');
    }
  }

  private getXforPercentage(prob): number {
    const yVals = this.data.map(d => d.probability);
    const left = this.data[d3.bisectLeft(yVals, prob) - 1];
    const right = this.data[d3.bisectRight(yVals, prob)];
    return ((prob - left.probability) * (right.duration - left.duration) /
      (right.probability - left.probability)) + left.duration;
  }

  private generateQuantiles(percentileLines, xScale): Item[] {
    if (percentileLines[0] < 0.01 || percentileLines[2] > .99) {
      return [percentileLines[1]].map(d => ({
        duration: this.getXforPercentage(d),
        probability: d} as Item));
    }
    let quantiles = percentileLines.map(d => ({
      duration: this.getXforPercentage(d),
      probability: d} as Item));

    const differences = [xScale(quantiles[1].duration - quantiles[0].duration), xScale(quantiles[2].duration - quantiles[1].duration)];
    if (differences[0] < 15 || differences[1] < 15) {
      quantiles = this.generateQuantiles([percentileLines[0] - .01, percentileLines[1], percentileLines[2] + .01], xScale);
    }
    return quantiles;
  }

  private generateYPosition(radius, xScale): Object[] {
    const radius2 = radius ** 2;
    const bisect = d3.bisector((d: Item) => d.duration);
    const yPosition = [];
    const xVals = this.data.map(d => d.duration);
    for (const val of xVals) {
      const x = xScale(val);
      const left = bisect.left(yPosition, x - radius);
      const right = bisect.right(yPosition, x + radius, left);
      let y = 0;
      for (let i = left; i < right; ++i) {
        const { x: xi, y: yi } = yPosition[i];
        const x2 = (xi - x) ** 2;
        const y2 = (yi - y) ** 2;
        if (radius2 > x2 + y2) {
          y = yi + Math.sqrt(radius2 - x2) + 1e-6;
          i = left - 1;
          continue;
        }
      }
      yPosition.splice(bisect.left(yPosition, x, left, right), 0, { x, y });
    }
    // Values are added to the front of the array, making the array in a
    // backwards order. We need to reverse it to maintain the correct indices.
    return yPosition.reverse();
  }
}
