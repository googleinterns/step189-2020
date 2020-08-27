import { AfterViewInit, Component, ElementRef, Input, ViewChild } from '@angular/core';
import * as d3 from 'd3';
import { addCurrentPushLine, generateQuantiles, generateYPosition, populateData } from './cdf.utils';
import { COMPLETED_BLUE, d3SVG, Item, STROKE_COLOR } from './cdf.utils';

import { step189_2020 } from '../../../proto/step189_2020';

@Component({
  selector: 'app-cdf',
  templateUrl: './cdf.component.html',
  styleUrls: ['./cdf.component.scss']
})

export class CDFComponent implements AfterViewInit {

  @ViewChild('cdf') private CDFContainer!: ElementRef;
  @Input() pushInfos!: step189_2020.IPushInfo[] | null;
  @Input() currentPush!: step189_2020.IPushInfo | null;

  private data: Item[] = [];
  private svg: d3SVG | undefined;

  /**
   * Creates a CDF chart by plotting the duration of completed pushes against
   * the probability of a push taking less time than that duration. Adds lines
   * at the 10%, 50%, and 90% percentiles if possible. For pushes that are
   * completed, a black line appears on the chart to visualize how this push
   * compares to all other pushes in the push def.
   *
   * Structure of the SVG:
   * <svg>
   *   <g id='cdf-chart'>
   *     <g id='y-axis-left'></g>
   *     <text id='y-axis-left-label'></text>
   *     <g id='y-axis-right'></g>
   *     <path id='CDF-area'></path>
   *     <path id='CDF-stroke'></path>
   *   </g>
   *   <g id='x-axis'></g>
   *   <text id='x-axis-label'></text>
   *   <text id='graph-title'></text>
   *   <g id='percentile-lines'></g>
   *     <line class='percentile-line'></line>
   *     <text class='percentile-text'></text>
   *   <g id='dotplot-container'></g>
   *   <g id='current-push-line'> (Only if the visited push is completed)
   *     <defs>
   *       <marker id='arrow'></marker>
   *     </defs>
   *     <line id='current-push-line'></line>
   *     <text id='current-push-text'></text>
   *   </g>
   * </svg>
   */
  ngAfterViewInit(): void {
    if (!this.pushInfos) { return; }
    if (!this.currentPush) { return; }
    this.data = populateData(this.pushInfos);

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

    const extendedData = Array.from(this.data);
    extendedData.push({
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
      .attr('id', 'cdf-chart')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const yAxisLeft = cdfChart
      .append('g')
      .attr('id', 'y-axis-left')
      .call(d3
        .axisLeft(yScale)
        .ticks(10)
        .tickFormat(d3.format(',.1f'))
      );

    yAxisLeft.select('.domain').remove();

    cdfChart.append('text')
      .attr('id', 'y-axis-left-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left)
      .attr('x', -height / 2)
      .attr('dy', '1em')
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Probability');

    const yAxisRight = cdfChart
      .append('g')
      .attr('id', 'y-axis-right')
      .attr('transform', `translate(${width}, 0)`)
      .call(d3
        .axisRight(yScale)
        .ticks(10)
        .tickFormat(d3.format(',.1f'))
      );

    yAxisRight.select('.domain').remove();

    const xAxis = this.svg
      .append('g')
      .attr('id', 'x-axis')
      .attr('transform', `translate(${margin.left}, ${elementHeight - margin.bottom})`)
      .call(d3.axisBottom(xScale));

    this.svg.append('text')
      .attr('id', 'x-axis-label')
      .attr('transform',
            `translate(${width / 2}, ${elementHeight - margin.left / 3})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Duration (minutes)');

    this.svg.append('text')
      .attr('id', 'graph-title')
      .attr('x', elementWidth / 2)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text('CDF of completed push durations');

    cdfChart
      .datum(extendedData)
      .append('path')
      .attr('id', 'CDF-area')
      .attr('fill', COMPLETED_BLUE)
      .attr('d', d3.area<Item>()
        .x(d => xScale(d.duration))
        .y1(d => yScale(d.probability))
        .y0(yScale(0))
        .curve(d3.curveStepAfter)
      );

    cdfChart
      .datum(extendedData)
      .append('path')
      .attr('fill', 'none')
      .attr('d', d3.line<Item>()
        .x(d => xScale(d.duration))
        .y(d => yScale(d.probability))
        .curve(d3.curveStepAfter)
      )
      .attr('id', 'CDF-stroke')
      .attr('stroke', STROKE_COLOR)
      .attr('stroke-width', 2);

    const percentileLines = this.svg
      .append('g')
      .attr('id', 'percentile-lines')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const percentiles = generateQuantiles(this.data, [0.1, 0.5, 0.9], xScale);

    percentileLines
      .selectAll('.percentile-lines')
      .data(percentiles)
      .enter()
      .append('line')
      .attr('class', 'percentile-line')
      .attr('stroke', 'lightgrey')
      .attr('stroke-dasharray', '5,2')
      .attr('x1', (d: Item) => xScale(d.duration))
      .attr('y1', height)
      .attr('x2', (d: Item) => xScale(d.duration))
      .attr('y2', 0);

    percentileLines
      .selectAll('.percentile-lines')
      .data(percentiles)
      .enter()
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('x', (d: Item) => xScale(d.duration))
      .attr('y', -10)
      .attr('class', 'percentile-text')
      .attr('font-size', '10px')
      .text((d: Item) => `${d.probability * 100}%`);

    const dotplotContainer = this.svg
      .append('g')
      .attr('id', 'dotplot-container')
      .attr('transform', `translate(${margin.left}, ${margin.top})`);

    let radius = 2.5;
    const xVals = this.data.map(d => d.duration);
    let yPosition = generateYPosition(radius * 2 + 0.1, xScale, xVals);

    const maxYPosition = d3.max(yPosition);
    if (!maxYPosition) { return; }

    if (maxYPosition > height) {
      radius = 1.4;
      yPosition = generateYPosition(radius * 2 + 0.1, xScale, xVals);
    }

    for (let i = 0; i < this.data.length; i++) {
      const cx = xScale(this.data[i].duration);
      const cy = height - yPosition[i] - radius;
      dotplotContainer.append('circle')
          .attr('cx', cx)
          .attr('r', radius)
          .attr('cy', cy)
          .attr('fill', 'black');
    }

    const currentPushLine = this.svg
    .append('g')
    .attr('id', 'current-push-line')
    .attr('transform', `translate(${margin.left}, ${margin.top})`);

    addCurrentPushLine(this.currentPush, currentPushLine, this.data, xScale, height, yScale);
  }
}
