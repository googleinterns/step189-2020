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
import {DARK_GRAY, LIGHT_GRAY, MED_GRAY, STATE_TO_COLOR} from '../colors';

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

/**
 * Selection types. The first item in the d3.Selection<...> is the element
 * type, which varies depending on what we are selecting for, and the second
 * element represents the Datum, which in our case is an Item.
 */
type d3SVGGElement = d3.Selection<SVGGElement, Item[], null, undefined>;
type d3SVGSVGElement = d3.Selection<SVGSVGElement, Item[], null, undefined>;
type d3SVGLineElement = d3.Selection<SVGLineElement, Item[], null, undefined>;
type d3SVGTextElement = d3.Selection<SVGTextElement, Item[], null, undefined>;

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
  private static readonly MIN_VISIBLE_DURATION: number = 5 * 60 * 60 * 1000;
  private static readonly HALF_LABEL_WIDTH: number = 50;
  private static readonly MIN_INTERVAL_HEIGHT: number = 25;
  private static readonly MSEC_PER_MIN: number = 60 * 1000;
  private static readonly NSEC_PER_MSEC: number = 10 ** 6;

  // Note that we use the non-null assertion operator ('!') in order to reassure
  // the compiler that our variables will never be null or undefined.
  @ViewChild('timeline') private timelineContainer!: ElementRef;
  @Input() private pushInfos!: step189_2020.IPushInfo[]|null;
  private data: Item[] = [];
  private svg!: d3SVGSVGElement;
  private line!: d3SVGLineElement;
  private lineLabel!: d3SVGTextElement;
  private x: d3.ScaleTime<number, number> = d3.scaleTime();
  private newX = d3.scaleTime();
  private isZoomed = false;
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
   * @param el Encasing element that holds the tooltip.
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
   * Move the line and its corresponding line marker below the x-axis so that
   * it stays wherever the mouse is, even during drag.
   *
   * @param x The x-coordinate of the mouse relative to the encasing SVG.
   */
  private moveLine =
      (x: number) => {
        this.line.attr('transform', `translate(${x} 0)`);

        let diff = 0;
        if (x > this.width - TimelineComponent.HALF_LABEL_WIDTH) {
          diff = this.width - x - TimelineComponent.HALF_LABEL_WIDTH;
        } else if (x < TimelineComponent.HALF_LABEL_WIDTH) {
          diff = TimelineComponent.HALF_LABEL_WIDTH - x;
        }

        const xScale =
            this.isZoomed ? this.newX : this.x;  // New axis if scaled
        this.lineLabel.attr('transform', `translate(${x + diff} 0)`)
            .text(formatDate(xScale.invert(x), 'yyyy-MM-dd HH:mm:ss', 'en-US'))
            .style('font-size', '10px')
            .attr('class', 'b system-sans-serif');
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
   *       <defs/> // Holds filter for drop-shadows
   *       <rect class=’chart-bounds’/> // Defines where zoom is possible
   *       <line class=’group-section’/> // Horizontal rows
   *         [...]
   *       <line class=’group-section’/>
   *       <g/>
   *         [...] // Rects for intervals
   *       <g/>
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

    const margin = {top: 0, right: 0, bottom: 45, left: 0};

    if (elementHeight > TimelineComponent.MIN_INTERVAL_HEIGHT * this.numRows) {
      // Resize height if the current allocated interval height is too small
      // to see clearly and comfortably.
      element.style.height =
          (TimelineComponent.MIN_INTERVAL_HEIGHT * this.numRows +
           margin.bottom) +
          'px';
      elementHeight = element.clientHeight;
    }

    this.width = elementWidth - margin.left - margin.right;
    this.height = elementHeight - margin.top - margin.bottom;

    // Establish the timeline's bottom axis.
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
            .scaleExtent([1, maxZoomIn])  // Limit zoom out.
            .translateExtent([[0, 0], [this.width, this.height]])
            .extent([[0, 0], [this.width, this.height]])
            .on('zoom', () => {
              this.isZoomed = true;
              const transform = d3.event.transform;
              const updatedScale = transform.rescaleX(this.x);
              this.newX = updatedScale;

              // Redraw the x-axis on every zoom action.
              const newXAxis = d3.axisBottom(updatedScale)
                                   .tickSize(-this.height - 6)
                                   .tickPadding(10);

              (this.svg.select('.x-axis') as d3SVGGElement)
                  .call(newXAxis)
                  .selectAll('line')
                  .style('stroke', MED_GRAY);

              this.svg.select('path.domain').remove();  // Remove axes borders

              (this.svg.selectAll('rect.interval') as
               d3.Selection<SVGRectElement, Item, SVGSVGElement, Item[]>)
                  .attr('x', (d: Item) => updatedScale(d.startTime))
                  .attr(
                      'width',
                      (d: Item) =>
                          updatedScale(d.endTime) - updatedScale(d.startTime));

              // Move line and line marker on zoom.
              const mouseCoords =
                  d3.mouse(this.svg.node() as d3.ContainerElement);
              const x = mouseCoords[0];
              const y = mouseCoords[1];
              this.moveLine(x);

              // Move the tooltip on zoom.
              const lineY = (y < this.height / 2) ? y + 125 : y + 10;
              const lineX = (x > this.height / 2) ? x - 100 : x;

              tooltip.style('left', lineX + 'px').style('top', lineY + 'px');
            });

    // Set up timeline chart components. The structure of the SVG tree
    // will contain a row with the x-axis on the bottom and rectangles
    // for each interval, the width of which is determined by its
    // respective start and end time.
    this.svg =
        (d3.select(element).append('svg') as d3SVGSVGElement)
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
        .style('stroke', MED_GRAY);

    this.svg.select('path.domain').remove();  // Remove axes borders

    const defs =
        this.svg.append('defs');  // Holds special definitions (e.g. filter)

    this.svg.append('rect')
        .attr('class', 'chart-bounds o-0')
        .attr('x', 0)
        .attr('y', 0)
        .attr('height', this.height)
        .attr('width', this.width);

    // Define filter to create shadow around each interval, to be set visible
    // only on hover.
    const filter = defs.append('filter')
                       .attr('id', 'drop-shadow')
                       .attr('filterUnits', 'userSpaceOnUse');

    filter.append('feGaussianBlur')
        .attr('in', 'SourceAlpha')
        .attr('stdDeviation', 1)
        .attr('result', 'coloredBlur');

    const feComponentTransfer = filter.append('feComponentTransfer');
    feComponentTransfer.append('feFuncA')
        .attr('type', 'linear')
        .attr('slope', 100);

    const feMerge = filter.append('feMerge');
    feMerge.append('feMergeNode');
    feMerge.append('feMergeNode').attr('in', 'SourceGraphic');

    // Insert timeline interval bars with their y-position determined by their
    // row index. In this case, `selectAll()` returns an empty selection since
    // the class does not yet exist in the page. `data(this.data)` and `enter()`
    // subsequently attaches data to the selection, with the first item in
    // data corresponding to the first slot in the selection, and so on.
    const groupHeight = this.height / this.numRows;
    const intervalBarHeight = 0.8 * groupHeight;  // Space between each interval
    const intervalBarMargin = (groupHeight - intervalBarHeight) / 2;
    const intervals =
        this.svg.selectAll('.interval-item')
            .data(this.data)
            .enter()
            .append('rect')
            .attr('class', 'interval pointer')
            .attr('width', (d: Item) => this.x(d.endTime) - this.x(d.startTime))
            .attr('height', intervalBarHeight)
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('y', intervalBarMargin)
            .attr('x', (d: Item) => this.x(d.startTime))
            .attr(
                'transform',
                (d: Item) => `translate(0, ${groupHeight * d.row})`)
            .attr('style', (d: Item) => `fill: ${STATE_TO_COLOR[d.state]}`)
            .attr(
                'stroke',
                (d: Item) => {
                  // If state color is light gray and has a duration less than
                  // five minutes, set border to a dark gray for visibility.
                  const color = STATE_TO_COLOR[d.state];
                  const duration = d.endTime - d.startTime;
                  return (color === LIGHT_GRAY &&
                          duration < TimelineComponent.MIN_VISIBLE_DURATION) ?
                      DARK_GRAY :
                      color;
                })
            .attr('stroke-width', '0.025em');

    // Create the tooltip and set its opacity to 0 when not hovering over a
    // set of data, such that it only appears when the cursor is directly on top
    // of an interval.
    const tooltipDiv = document.createElement('div');
    const tooltip = d3.select(tooltipDiv).call(this.styleTooltip);
    element.appendChild(tooltipDiv);

    intervals
        .on('mouseover',
            (d: Item) => {
              d3.select(d3.event.currentTarget)
                  .raise()
                  .attr('opacity', 0.7)
                  .attr('filter', 'url(#drop-shadow)');

              tooltip.html(this.getTooltipContent(d)).style('opacity', 1);
            })
        .on('mouseleave', () => {
          d3.select(d3.event.currentTarget)
              .attr('filter', 'none')
              .attr('opacity', 1);
          this.line.raise();  // Ensure that line will always be on top
          tooltip.style('opacity', '0');  // Hide tooltip
        });

    // Add vertical line to track mouse movement.
    this.line = this.svg.append('line')
                    .attr('class', 'line-marker')
                    .attr('y2', this.height + 25)
                    .attr('stroke', 'rgba(0,0,0,0.2)')
                    .style('pointer-events', 'none')
                    .style('opacity', 0);

    this.lineLabel = this.svg.append('text')
                         .attr('class', 'line-marker')
                         .attr('y', this.height + 40)
                         .attr('text-anchor', 'middle')
                         .style('opacity', 0);

    this.svg.on('mouseover', () => {
      this.line.style('opacity', 1);
      this.lineLabel.style('opacity', 1);
    });

    this.svg.on(
        'mouseleave', () => {  // Hide line marker when cursor is off SVG
          this.line.style('opacity', 0);
          this.lineLabel.style('opacity', 0);
        });

    this.svg.on('mousemove', () => {
      const [x, y] = d3.mouse(d3.event.currentTarget);
      this.moveLine(x);

      // Move the tooltip above cursor if we near the x-axis and to the left
      // of the cursor if we near the right edge of the timeline.
      const lineY = (y < this.height / 2) ? y + 125 : y + 10;
      const lineX = (x > this.height / 2) ? x - 100 : x;

      tooltip.style('left', lineX + 'px').style('top', lineY + 'px');
    });
  }
}
