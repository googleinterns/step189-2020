/**
 * Copyright 2020 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {AfterViewChecked, AfterViewInit, Component, ElementRef, Input, ViewChild} from '@angular/core';
import * as d3 from 'd3';

import {step189_2020} from '../../../proto/step189_2020';
import {findDurationUnit} from '../duration-utils';

import {addCurrentPushLine, generateQuantiles, generateYPosition, getProbabilityForDuration, populateData} from './cdf.utils';
import {COMPLETED_BLUE, d3SVG, Item, STROKE_COLOR} from './cdf.utils';

@Component({
  selector: 'app-cdf',
  templateUrl: './cdf.component.html',
  styleUrls: ['./cdf.component.scss']
})

export class CDFComponent implements AfterViewChecked, AfterViewInit {
  @ViewChild('cdf') private CDFContainer!: ElementRef;
  @Input() pushInfos!: step189_2020.IPushInfo[]|null;
  @Input() currentPush!: step189_2020.IPushInfo|null;
  @Input() showDots!: boolean;

  private data: Item[] = [];
  private svg: d3SVG|undefined;
  private durationUnit = '';
  private showDotsBoolean = false;

  ngAfterViewChecked(): void {
    if (this.showDotsBoolean === this.showDots) {
      return;
    }
    if (!this.svg) {
      return;
    }
    this.showDotsBoolean = this.showDots;
    if (!this.showDotsBoolean) {
      this.svg.select('#cdf-chart').selectAll('.dots').attr('opacity', 0);
    } else {
      this.svg.select('#cdf-chart').selectAll('.dots').attr('opacity', 1);
    }
  }
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
   *     <path id='cdf-area'></path>
   *     <path id='cdf-stroke'></path>
   *     <clipPath id='area-clip'></clipPath>
   *     <path class='cdf-clipped'></path>
   *     <circle class='dots'></circle> [...]
   *     <line class='click-line-y'></line>
   *     <line class='click-line-x'></line>
   *     <text class='click-line-y-text'></text>
   *     <text class='click-line-x-text'></text>
   *     <rect class='hover x-label-bg'></rect>
   *     <text class='hover x-label'></text>
   *     <rect class='hover y-label-bg'></rect>
   *     <text class='hover y-label'></text>
   *     <line class='hover v-ruler'></line>
   *     <line class='hover h-ruler'></line>
   *     <circle class='hover marker'></circle>
   *     <g id='x-axis'></g>
   *     <text id='x-axis-label'></text>
   *   </g>
   *   <text id='graph-title'></text>
   *   <g id='percentile-lines'>
   *     <line class='percentile-line'></line>
   *     <text class='percentile-text'></text>
   *   </g>
   *   <g id='current-push-line'> (Only if the visited push is completed)
   *     <defs>
   *       <marker id='arrow'></marker>
   *     </defs>
   *     <line id='current-push-line'></line>
   *     <line id='current-push-text-line'></line>
   *     <line id='current-push-text-line-arrow'></line>
   *     <text id='current-push-text'></text>
   *   </g>
   * </svg>
   */
  ngAfterViewInit(): void {
    if (!this.pushInfos) {
      return;
    }
    if (!this.currentPush) {
      return;
    }
    this.showDotsBoolean = this.showDots;
    this.durationUnit = findDurationUnit(this.pushInfos);
    this.data = populateData(this.pushInfos);

    const element = this.CDFContainer.nativeElement;
    const elementWidth = element.clientWidth;
    const elementHeight = element.clientHeight;

    const margin = {top: 50, right: 50, bottom: 50, left: 50};

    const width = elementWidth - margin.left - margin.right;
    const height = elementHeight - margin.top - margin.bottom;

    const maxDuration = d3.max(this.data, d => d.duration);
    if (!maxDuration) {
      return;
    }

    const minDuration = d3.min(this.data, d => d.duration);
    if (!minDuration) {
      return;
    }

    const xScale = d3.scaleLinear()
                       .domain([0, maxDuration + 1])
                       .rangeRound([0, width])
                       .nice();

    const yScale = d3.scaleLinear().domain([0, 100]).rangeRound([height, 0]);

    const extendedData = Array.from(this.data);
    extendedData.push({
      duration: xScale.ticks()[xScale.ticks().length - 1],
      probability: 1,
      endState: 5
    });

    const maxExtendedDuration = d3.max(extendedData, d => d.duration);
    if (!maxExtendedDuration) {
      return;
    }

    this.svg = (d3.select(element).append('svg') as d3SVG)
                   .attr('width', elementWidth)
                   .attr('height', elementHeight);

    const cdfChart =
        this.svg.append('g')
            .attr('id', 'cdf-chart')
            .attr('transform', `translate(${margin.left}, ${margin.top})`)
            .datum(extendedData);

    const yAxisLeft =
        cdfChart.append('g')
            .attr('id', 'y-axis-left')
            .call(d3.axisLeft(yScale).ticks(10).tickFormat(d3.format(',.0f')));

    // Remove axis' vertical line and keep the tick marks
    yAxisLeft.select('.domain').remove();

    cdfChart.append('text')
        .attr('id', 'y-axis-left-label')
        .attr('transform', 'rotate(-90)')
        .attr('y', -margin.left)
        .attr('x', -height / 2)
        .attr('dy', '1em')
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text('Percentage (%)');

    const yAxisRight =
        cdfChart.append('g')
            .attr('id', 'y-axis-right')
            .attr('transform', `translate(${width}, 0)`)
            .call(d3.axisRight(yScale).ticks(10).tickFormat(d3.format(',.0f')));

    // Remove axis' vertical line and keep the tick marks
    yAxisRight.select('.domain').remove();

    const xAxis = cdfChart.append('g')
                      .attr('id', 'x-axis')
                      .attr('transform', `translate(0, ${height})`)
                      .call(d3.axisBottom(xScale));

    cdfChart.append('text')
        .attr('id', 'x-axis-label')
        .attr(
            'transform',
            `translate(${width / 2}, ${height + margin.left / 1.5})`)
        .style('text-anchor', 'middle')
        .style('font-size', '12px')
        .text(`Duration (${this.durationUnit})`);

    this.svg.append('text')
        .attr('id', 'graph-title')
        .attr('x', elementWidth / 2)
        .attr('y', margin.top / 2)
        .attr('text-anchor', 'middle')
        .style('font-size', '16px')
        .text('CDF of completed push durations');

    cdfChart.append('path')
        .attr('id', 'cdf-area')
        .attr('fill', COMPLETED_BLUE)
        .attr(
            'd',
            d3.area<Item>()
                .x(d => xScale(d.duration))
                .y1(d => yScale(d.probability))
                .y0(yScale(0))
                .curve(d3.curveStepAfter));

    cdfChart.append('path')
        .attr('fill', 'none')
        .attr(
            'd',
            d3.line<Item>()
                .x(d => xScale(d.duration))
                .y(d => yScale(d.probability))
                .curve(d3.curveStepAfter))
        .attr('id', 'cdf-stroke')
        .attr('stroke', STROKE_COLOR)
        .attr('stroke-width', 2);

    const percentileLines =
        this.svg.append('g')
            .attr('id', 'percentile-lines')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

    const percentiles = generateQuantiles(this.data, [10, 50, 90], xScale);

    percentileLines.selectAll('.percentile-lines')
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

    percentileLines.selectAll('.percentile-lines')
        .data(percentiles)
        .enter()
        .append('text')
        .attr('text-anchor', 'middle')
        .attr('x', (d: Item) => xScale(d.duration))
        .attr('y', -10)
        .attr('class', 'percentile-text')
        .attr('font-size', '10px')
        .text((d: Item) => `${d.probability}%`);

    let radius = 2.5;
    const xVals = this.data.map(d => d.duration);
    let yPosition = generateYPosition(radius * 2 + 0.1, xScale, xVals);

    const maxYPosition = d3.max(yPosition);
    if (!maxYPosition) {
      return;
    }

    if (maxYPosition > height) {
      radius = 1.4;
      yPosition = generateYPosition(radius * 2 + 0.1, xScale, xVals);
    }

    const currentPushLine =
        this.svg.append('g')
            .attr('id', 'current-push-line')
            .attr('transform', `translate(${margin.left}, ${margin.top})`);

    addCurrentPushLine(
        this.durationUnit, this.currentPush, currentPushLine, this.data, height,
        xScale, yScale);

    // Sets up and handles mouse click. The vertical and horizontal lines and
    // the percentages are placed on the graph where the mouse clicked. The area
    // of the graph to the left of the click becomes a lighter color and the
    // dots to the left of the click become grey.
    let startValue = minDuration + 1e-6;

    const clipRect = cdfChart.append('clipPath')
                         .attr('id', 'area-clip')
                         .append('rect')
                         .attr('class', 'area-clip-rect')
                         .attr('x', 0)
                         .attr('y', 0)
                         .attr('width', xScale(startValue))
                         .attr('height', height);

    cdfChart.append('path')
        .attr('class', 'cdf-clipped')
        .attr(
            'd',
            d3.area<Item>()
                .x(d => xScale(d.duration))
                .y1(d => yScale(d.probability))
                .y0(yScale(0))
                .curve(d3.curveStepAfter))
        .attr('fill-opacity', '0.6')
        .attr('fill', 'white')
        .attr('clip-path', 'url(#area-clip)');

    for (let i = 0; i < this.data.length; i++) {
      const cx = xScale(this.data[i].duration);
      const cy = height - yPosition[i] - radius;
      cdfChart.append('circle')
          .attr('class', 'dots')
          .attr('cx', cx)
          .attr('r', radius)
          .attr('cy', cy)
          .attr('fill', 'black');
    }

    const lineY =
        cdfChart.append('line')
            .attr('class', 'click-line-y')
            .attr('x1', xScale(startValue))
            .attr('x2', xScale(startValue))
            .attr(
                'y1', yScale(getProbabilityForDuration(this.data, startValue)))
            .attr('y2', height)
            .attr('stroke', 'black')
            .attr('stroke-width', '1px')
            .attr('opacity', 0);

    const lineX =
        cdfChart.append('line')
            .attr('class', 'click-line-x')
            .attr('x1', 0)
            .attr('x2', xScale(startValue))
            .attr(
                'y1', yScale(getProbabilityForDuration(this.data, startValue)))
            .attr(
                'y2', yScale(getProbabilityForDuration(this.data, startValue)))
            .attr('stroke', 'black')
            .attr('stroke-width', '1px')
            .attr('opacity', 0);

    cdfChart.append('text')
        .attr('x', xScale(startValue) - 35)
        .attr(
            'y',
            yScale(getProbabilityForDuration(this.data, startValue) / 100) + 30)
        .attr('class', 'click-line-y-text')
        .attr('font-size', '10px')
        .text(`${this.data.filter(c => c.duration <= startValue).length}/${
            this.data.length}`)
        .attr('opacity', 0);

    cdfChart.append('text')
        .attr('x', xScale(startValue) / 2)
        .attr(
            'y',
            yScale(getProbabilityForDuration(this.data, startValue) / 100) + 10)
        .attr('class', 'click-line-x-text')
        .attr('font-size', '10px')
        .text(`${getProbabilityForDuration(this.data, startValue).toFixed(2)}%`)
        .attr('opacity', 0);

    cdfChart.on('click', (d: Item[], i: number): void => {
      if (!d) {
        return;
      }
      const coordinates = d3.mouse(d3.event.currentTarget);
      const xValue = xScale.invert(coordinates[0]);
      if (xValue > minDuration) {
        startValue = xValue;
        const yValue = getProbabilityForDuration(d, startValue);
        d3.select(d3.event.currentTarget)
            .select('.area-clip-rect')
            .attr('width', xScale(startValue));
        d3.select(d3.event.currentTarget)
            .select('.click-line-y')
            .attr('y1', yScale(yValue))
            .attr('x1', xScale(startValue))
            .attr('x2', xScale(startValue))
            .attr('opacity', 1);
        d3.select(d3.event.currentTarget)
            .select('.click-line-x')
            .attr('y1', yScale(yValue))
            .attr('y2', yScale(yValue))
            .attr('x2', xScale(startValue))
            .attr('opacity', 1);
        d3.select(d3.event.currentTarget)
            .select('.click-line-y-text')
            .attr('x', xScale(startValue) - 40)
            .attr('y', yScale(yValue) + 20)
            .text(`${this.data.filter(c => c.duration <= startValue).length}/${
                this.data.length}`)
            .attr('opacity', 1);
        d3.select(d3.event.currentTarget)
            .select('.click-line-x-text')
            .attr('x', xScale(startValue) / 2)
            .attr('y', yScale(yValue) + 10)
            .text(`${
                (getProbabilityForDuration(this.data, startValue))
                    .toFixed(1)}%`)
            .attr('opacity', 1);
        d3.select(d3.event.currentTarget)
            .selectAll('.dots')
            .data(this.data)
            .attr(
                'fill',
                (dp: Item) => dp.duration <= startValue ? 'grey' : 'black');
      }
    });

    // Sets up and handles mouse hovering. The vertical and horizontal rulers, x
    // and y labels and backgrounds are placed in the correct position when the
    // mouse is over the graph
    const highlightColor = '#b9edc4';
    const strokeColor = '#167364';
    const circleColor = '#a0aade';
    const labelWidth = 40;
    const labelHeight = 25;
    const labelFontSize = labelHeight / 2;

    cdfChart.append('rect')
        .attr('class', 'hover x-label-bg')
        .attr('x', 0)
        .attr('y', height)
        .attr('height', labelHeight)
        .attr('width', labelWidth)
        .attr('fill', highlightColor)
        .attr('opacity', 0);

    cdfChart.append('text')
        .attr('text-anchor', 'middle')
        .attr('class', 'hover x-label')
        .attr('x', 0)
        .attr('y', height + 5 + labelFontSize)
        .attr('opacity', 0)
        .style('font-size', `${labelFontSize}px`)
        .style('font-weight', 'bold')
        .attr('fill', 'black');

    cdfChart.append('rect')
        .attr('class', 'hover y-label-bg')
        .attr('x', -labelWidth)
        .attr('y', 0)
        .attr('height', labelHeight)
        .attr('width', labelWidth)
        .attr('fill', highlightColor)
        .attr('opacity', 0);

    cdfChart.append('text')
        .attr('text-anchor', 'middle')
        .attr('class', 'hover y-label')
        .attr('x', -labelWidth / 2)
        .attr('y', 0)
        .attr('opacity', 0)
        .style('font-weight', 'bold')
        .attr('fill', 'black')
        .style('font-size', `${labelFontSize}px`);

    cdfChart.append('line')
        .attr('x1', 0)
        .attr('x2', 0)
        .attr('y1', height)
        .attr('y2', 0)
        .attr('class', 'hover v-ruler')
        .attr('stroke', 'grey')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,2')
        .attr('opacity', 0);

    cdfChart.append('line')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('class', 'hover h-ruler')
        .attr('stroke', 'grey')
        .attr('stroke-width', 2)
        .attr('stroke-dasharray', '5,2')
        .attr('opacity', 0);

    cdfChart.append('circle')
        .attr('class', 'hover marker')
        .attr('cx', 0)
        .attr('cy', 0)
        .attr('r', 5)
        .attr('stroke', strokeColor)
        .attr('stroke-width', 2)
        .attr('fill', circleColor)
        .style('opacity', 0);

    cdfChart.on('mousemove', (d: Item[], i: number): void => {
      const mouseX = xScale.invert(d3.mouse(d3.event.currentTarget)[0]);

      if (mouseX >= minDuration && mouseX <= maxExtendedDuration) {
        const xVal = d3.mouse(d3.event.currentTarget)[0];
        const xInverted = xScale.invert(xVal);
        const yVal = yScale(getProbabilityForDuration(d, xInverted));

        d3.select('.marker').attr('cx', xVal).attr('cy', yVal);
        d3.select('.h-ruler').attr('y1', yVal).attr('y2', yVal);
        d3.select('.v-ruler').attr('x1', xVal).attr('x2', xVal);

        const xText = d3.format(',.1f')(xInverted);
        const yText = d3.format(',.0f')(yScale.invert(yVal));
        d3.select('.x-label').attr('x', xVal).text(xText);
        d3.select('.x-label-bg').attr('x', xVal - labelWidth / 2);
        d3.select('.y-label')
            .attr('y', yVal + labelHeight / 5)
            .text(`${yText}%`);
        d3.select('.y-label-bg').attr('y', yVal - labelHeight / 2);

        d3.selectAll('.hover').style('opacity', 1);
      } else {
        d3.selectAll('.hover').style('opacity', 0);
      }
    });

    cdfChart.on('mouseleave', () => {
      d3.selectAll('.hover').style('opacity', 0);
    });
  }
}
