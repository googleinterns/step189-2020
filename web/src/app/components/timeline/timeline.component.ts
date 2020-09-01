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

import {formatDate} from '@angular/common';
import {AfterViewInit, Component, ElementRef, Input, ViewChild} from '@angular/core';
import * as d3 from 'd3';
import {HumanizeDuration, HumanizeDurationLanguage, HumanizeDurationOptions} from 'humanize-duration-ts';

import {step189_2020} from '../../../proto/step189_2020';

/**
 * Item holds all required data for one interval on the timeline.
 */
interface Item {
  pushID: string;     // Push ID
  state: number;      // Final state of push
  startTime: number;  // Start of push, in milliseconds
  endTime: number;    // End of push, in milliseconds
  row: number;        // Row number corresponds to y-position on timeline
}

type d3SVG = d3.Selection<SVGSVGElement, Item[], null, undefined>;

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})

export class TimelineComponent implements AfterViewInit {
  private static readonly LANG_SERVICE: HumanizeDurationLanguage =
      new HumanizeDurationLanguage();
  private static readonly HUMANIZER: HumanizeDuration =
      new HumanizeDuration(TimelineComponent.LANG_SERVICE);
  private static readonly COLOR_LIGHT_GRAY: string = '#d3d3d3';
  private static readonly MIN_INTERVAL_HEIGHT: number = 25;
  private static readonly MSEC_PER_MIN: number = 60 * (10 ** 3);
  private static readonly NSEC_PER_MSEC: number = 10 ** 6;
  private static readonly STATE_TO_COLOR: {[index: number]: string} = {
    1: '#eee',
    3: '#2196f3',
    4: '#d50000',
    5: '#34a853',
    6: '#d50000',
    7: '#2196f3',
    8: '#2196f3',
    9: '#d50000',
    10: '#2196f3',
    11: '#2196f3',
    12: '#d50000',
    13: '#2196f3',
    14: '#eee',
    15: '#2196f3',
    16: '#d50000',
    17: '#eee',
    18: '#34a853',
    19: '#eee'
  };

  // Note that we use the non-null assertion operator ('!') on `this.svg`
  // in order to reassure the compiler that it will never be null or undefined.
  @ViewChild('timeline') private timelineContainer!: ElementRef;
  @Input() private pushInfos!: step189_2020.IPushInfo[]|null;
  private data: Item[] = [];
  private svg!: d3SVG;
  private x: d3.ScaleTime<number, number> = d3.scaleTime();
  private height = 0;
  private width = 0;
  private numRows = 0;

  /**
   * Extracts the pushID, state, and start and end time for each push in
   * pushInfos and inserts them into Item interfaces, which are collectively
   * stored in an array.
   *
   * @param pushInfos Array of pushes for one push def
   */
  private static populateData(pushInfos: step189_2020.IPushInfo[]|
                              null): [Item[], number] {
    if (!pushInfos) {
      return [[], 0];
    }
    const data: Item[] = [];

    pushInfos.forEach(pushInfo => {
      if (!pushInfo) {
        return;
      }
      const states = pushInfo.stateInfo;
      if (!states) {
        return;
      }
      const statesStartTime = states[0].startTimeNsec;
      if (!statesStartTime) {
        return;
      }
      const statesEndTime = states[states.length - 1].startTimeNsec;
      if (!statesEndTime) {
        return;
      }
      const pushID = pushInfo.pushHandle;
      if (!pushID) {
        return;
      }
      const state = states[states.length - 1].state;
      if (!state) {
        return;
      }

      // Convert the start and end time values to seconds.
      // The unary operator coerces the value to number type.
      const startTime = +statesStartTime / TimelineComponent.NSEC_PER_MSEC;
      const endTime = +statesEndTime / TimelineComponent.NSEC_PER_MSEC;

      // Store data points as instances of Item interface.
      data.push({pushID, state, startTime, endTime, row: 0} as Item);
    });

    // Assign a row value to each push representing their horizontal placement
    // on the timeline. Each row index corresponds to one group.
    const rowIndex = this.divideIntoRows(data);
    return [data, rowIndex];
  }

  /**
   * Divides the data into row by assigning a row index (corresponding
   * to their row placement on the timeline) such that all intervals within a
   * row do not overlap. The algorithm takes a greedy approach by sorting
   * the row by increasing start time, sequentially picking the next interval,
   * and removing all intervals it overlaps with. It thus fits as many intervals
   * as possible in the first row, does so for each row until there are
   * no more intervals left. The runtime is O(n * log(n)), which results in
   * the case that all intervals are overlapping.
   */
  private static divideIntoRows(data: Item[]): number {
    data.sort((a, b) => a.startTime - b.startTime);

    // Initialized to arbitrary value to avoid premature return.
    let overlappingIntervals = [data[0]];
    let rowIndex = 0;
    while (overlappingIntervals.length !== 0) {
      let lastEndTime = 0;
      overlappingIntervals = [];
      for (const interval of data) {
        // To check for interval overlap with the already determined set of
        // non-overlapping intervals, we simply need to check if the start time
        // of the current interval is earlier than the last added end time.
        // This is a consequence of all events being sorted by start time.
        if (interval.startTime >= lastEndTime) {
          const intervalInData =
              data.find(({pushID}) => pushID === interval.pushID);
          if (intervalInData) {
            intervalInData.row = rowIndex;
          }
          lastEndTime = interval.endTime;
        } else {
          overlappingIntervals.push(interval);
        }
      }
      rowIndex++;
      lastEndTime = 0;
      data = overlappingIntervals;
    }
    return rowIndex;
  }

  /**
   * Composes content of the tooltip that will appear on hover.
   *
   * @param d Holds one interval's data on the timeline.
   */
  private getTooltipContent =
      (d: Item) => {
        const duration = d.endTime - d.startTime;

        // Convert the duration, currently in milliseconds, to a human readable
        // format with the largest unit in days and the smallest in seconds
        // (e.g. passing in the value 361000 returns "6 minutes, 1 second")
        const options = ({
          round: true  // Get rid of decimal places
        } as HumanizeDurationOptions);
        const output = TimelineComponent.HUMANIZER.humanize(duration, options);

        // Return HTML representation of all required data.
        return `<b>Push ID: ${d.pushID.slice(d.pushID.indexOf('@') + 1)}</b>
      <br/>
      <b>Final State: ${d.state}</b>
      <br/>
      <b>
        Start Time: ${formatDate(d.startTime, 'yyyy-MM-dd HH:mm:ss', 'en-US')}
      </b>
      <br/>
      <b>
        End Time: ${formatDate(d.endTime, 'yyyy-MM-dd HH:mm:ss', 'en-US')}
      </b>
      <br/>
      <b>Duration: ${output}</b>
      `;
      }

  /**
   * Create tooltip to display each interval's content.
   *
   * @param el Encasing element that holds the tooltip
   */
  private styleTooltip =
      (el: d3.Selection<HTMLDivElement, unknown, null, undefined>) => {
        el.style('position', 'absolute')
            .style('pointer-events', 'none')
            .style('top', 0)
            .style('opacity', 0)
            .style('background', 'white')
            .style('border-radius', '5px')
            .style('box-shadow', '0 0 10px rgba(0,0,0,.25)')
            .style('padding', '10px')
            .style('line-height', '1.3')
            .style('font', '11px sans-serif');
      }

  /**
   * Creates a scrollable timeline with bars representing the duration of
   * pushes. Every time this function is called, the previous timeline SVG is
   * removed and a new one propagated to the screen. Timeline features include
   * scrolling horizontally on the x-axis, zooming in and out along the x-axis,
   * and a tooltip display when hovering over intervals. Each interval is
   * color-coded according to its final state.
   *
   * The structure of the component is shown below:
   * <div>
   *   <svg>
   *     <g>
   *       <g class='x-axis'>
   *          <g class='tick' .../>
   *            [...]
   *          <g class='tick' .../>
   *       <defs/> // clipPath defining how much of timeline is visible
   *       <rect class=’chart-bounds’/> // Defines where zoom is possible
   *       <line class=’group-section’/> // Horizontal rows
   *         [...]
   *       <line class=’group-section’/>
   *       <g clip-path=’url(#chart-content)/>
   *         [...] // clipPaths defining how much of lines can be seen
   *       <g clip-path=’url(#chart-content)/>
   *     </g>
   *   </svg>
   *   <div/> // tooltip content. Opacity is 0 when not hovering over interval
   * </div>
   *
   * @param pushInfos Holds all pushes for one push def.
   */
  ngAfterViewInit(): void {
    if (!this.pushInfos) {
      return;
    }

    // Filter the data by first adding protocol buffer data into Item and
    // then seperating them into rows by giving them an individual row index.
    const res = TimelineComponent.populateData(this.pushInfos);
    this.data = res[0];
    this.numRows = res[1];

    const element = this.timelineContainer.nativeElement;

    // Determine the sizes of the timeline, including domain and range.
    const elementWidth = element.clientWidth;
    let elementHeight = element.clientHeight;

    if (elementHeight > TimelineComponent.MIN_INTERVAL_HEIGHT * this.numRows) {
      // Resize height if the current allocated interval height is too small
      // to see clearly and comfortably.
      element.style.height =
          (TimelineComponent.MIN_INTERVAL_HEIGHT * this.numRows) + 'px';
      elementHeight = element.clientHeight;
    }

    const minTimePoint =
        this.data
            .reduce((prev, cur) => {
              return (prev.startTime < cur.startTime) ? prev : cur;
            })
            .startTime;

    const maxTimePoint = this.data
                             .reduce((prev, cur) => {
                               return (prev.endTime > cur.endTime) ? prev : cur;
                             })
                             .endTime;

    const margin = {top: 0, right: 0, bottom: 20, left: 0};

    this.width = elementWidth - margin.left - margin.right;
    this.height = elementHeight - margin.top - margin.bottom;

    // Establish the timeline's bottom axis.
    this.x = d3.scaleTime()
                 .domain([new Date(minTimePoint), new Date(maxTimePoint)])
                 .range([0, this.width]);

    const xAxis =
        d3.axisBottom(this.x).tickSize(-this.height - 6).tickPadding(10);

    // Define the zoom behavior, limiting the scale with which we can zoom in
    // and out and restricting zoom to the x-axis only. Upon zoom, the x-axis
    // will rescale, as will the timeline intervals. The maxZoomIn value
    // restricts the zoom in to at most 5 second increments for any size data
    // set.
    const maxZoomIn =
        (maxTimePoint - minTimePoint) / TimelineComponent.MSEC_PER_MIN;
    const zoom =
        d3.zoom<SVGSVGElement, Item[]>()
            .scaleExtent([0.75, maxZoomIn])  // Limit zoom out.
            .translateExtent(
                [[-100000, 0], [100000, 0]])  // Avoid scrolling too far.
            .on('zoom', () => {
              const transform = d3.event.transform;
              const updatedScale = transform.rescaleX(this.x);

              // Redraw the x-axis on every zoom action.
              const newXAxis = d3.axisBottom(updatedScale)
                                   .tickSize(-this.height - 6)
                                   .tickPadding(10);

              (this.svg.select('.x-axis') as
               d3.Selection<SVGGElement, Item[], null, undefined>)
                  .call(newXAxis)
                  .selectAll('line')
                  .style('stroke', TimelineComponent.COLOR_LIGHT_GRAY);

              (this.svg.selectAll('rect.interval') as
               d3.Selection<SVGRectElement, Item, SVGSVGElement, Item[]>)
                  .attr('x', (d: Item) => updatedScale(d.startTime))
                  .attr(
                      'width',
                      (d: Item) =>
                          updatedScale(d.endTime) - updatedScale(d.startTime));
            });

    // Set up timeline chart components. The structure of the SVG tree
    // will contain a row with the x-axis on the bottom and rectangles
    // for each interval, the width of which is determined by its
    // respective start and end time.
    this.svg =
        (d3.select(element).append('svg') as d3SVG)
            .attr('width', this.width + margin.left + margin.right)
            .attr('height', this.height + margin.top + margin.bottom)
            .attr('viewBox', `0 0 ${this.width} ${this.height}`)
            .attr(
                'preserveAspectRatio',
                'xMinYMin')  // Keep aspect ratio on resize
            .attr('transform', `translate(${margin.left} ${margin.top})`);

    this.svg.call(zoom);

    this.svg.append('g')
        .attr('class', 'x-axis')
        .attr('transform', `translate(0 ${this.height})`)
        .call(xAxis)
        .selectAll('line')
        .style('stroke', TimelineComponent.COLOR_LIGHT_GRAY);

    this.svg
        .append('defs')  // Determine what can be seen of the component
        .append('clipPath')
        .attr('id', 'chart-content')
        .append('rect')
        .attr('x', 0)
        .attr('y', 0)
        .attr('height', this.height)
        .attr('width', this.width);

    this.svg.append('rect')
        .attr('class', 'chart-bounds o-025')
        .attr('x', 0)
        .attr('y', 0)
        .attr('height', this.height)
        .attr('width', this.width);

    // Insert timeline interval bars with their y-position determined by their
    // row index. In this case, `selectAll()` returns an empty selection since
    // the class does not yet exist in the page. `data(this.data)` and `enter()`
    // subsequently attaches data to the selection, with the first item in
    // data corresponding to the first slot in the selection, and so on.
    const groupHeight = this.height / this.numRows;
    const groupIntervalItems =
        this.svg.selectAll('.group-interval-item')
            .data(this.data)
            .enter()
            .append('g')
            .attr('clip-path', 'url(#chart-content)')
            .attr(
                'transform',
                (d: Item) => `translate(0, ${groupHeight * d.row})`)
            .attr(
                'style',
                (d: Item) =>
                    `fill: ${TimelineComponent.STATE_TO_COLOR[d.state]}`);

    const intervalBarHeight = 0.8 * groupHeight;  // Space between each interval
    const intervalBarMargin = (groupHeight - intervalBarHeight) / 2;
    groupIntervalItems.append('rect')
        .attr('class', 'interval pointer')
        .attr('width', (d: Item) => this.x(d.endTime) - this.x(d.startTime))
        .attr('height', intervalBarHeight)
        .attr('rx', 2)
        .attr('ry', 2)
        .attr('y', intervalBarMargin)
        .attr('x', (d: Item) => this.x(d.startTime));

    // Create the tooltip and set its opacity to 0 when not hovering over a
    // set of data, such that it only appears when the cursor is directly on top
    // of an interval.
    const tooltipDiv = document.createElement('div');
    const tooltip = d3.select(tooltipDiv).call(this.styleTooltip);
    element.appendChild(tooltipDiv);

    groupIntervalItems
        .on('mouseover',
            (d: Item) => {
              d3.select(d3.event.currentTarget)
                  .select('rect')
                  .attr('fill-opacity', 0.50);
              tooltip.html(this.getTooltipContent(d)).style('opacity', 1);
            })
        .on('mouseleave', () => {
          d3.select(d3.event.currentTarget)
              .select('rect')
              .attr('fill-opacity', 1);
          tooltip.style('opacity', 0);  // Hide tooltip
        });

    this.svg.on('mousemove', () => {
      let [x, y] = d3.mouse(d3.event.currentTarget);
      y += 120;  // Set how much below cursor the tooltip will appear
      if (x > +d3.event.currentTarget.width / 2) {
        x -= 100;
      }

      tooltip.style('left', x + 'px').style('top', y + 'px');
    });
  }
}
