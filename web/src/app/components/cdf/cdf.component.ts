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

export class CDFComponent implements AfterViewInit {
  private static readonly NANO_TO_MINUTES: number = (10 ** 9) * 60;
  private static readonly STATE_TO_COLOR: {[index: number]: string} = {
    1: '#eee',
    3: '#ba68c8',
    4: '#ff6e40',
    5: '#00bfa5',
    6: '#ff6e40',
    7: '#ba68c8',
    8: '#ba68c8',
    9: '#ff6e40',
    10: '#ba68c8',
    12: '#ff6e40',
    13: '#ba68c8',
    15: '#ba68c8',
    16: '#ff6e40'
  };

  @ViewChild('cdf') private CDFContainer!: ElementRef;
  @Input() pushInfos!: step189_2020.IPushInfo[]|null;
  @Input() currentPush!: step189_2020.IPushInfo|null;
  @Input() showDots!: boolean;

  private data: Item[] = [];
  private svg: d3SVG|undefined;
  private durationUnit = '';
  private showDotsBoolean = false;

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
    this.data = populateData(this.pushInfos, false);

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
        .text('CDF of push durations');

    const rectHeight = Math.floor(height / this.data.length) + 1;
    for (let i = this.data.length - 1; i >= 0; i--) {
      const elem = this.data[i];
      cdfChart.append('rect')
          .attr('class', 'rect-area')
          .attr('fill', CDFComponent.STATE_TO_COLOR[elem.endState])
          .attr('x', xScale(elem.duration))
          .attr('y', yScale(elem.probability))
          .attr('height', rectHeight)
          .attr('width', width - xScale(elem.duration))
          .attr('opacity', 1);
    }
  }
}
