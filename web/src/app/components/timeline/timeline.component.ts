import { Component, ElementRef, Input, OnChanges, OnInit, SimpleChanges, ViewChild } from '@angular/core';
import * as d3 from 'd3';

import { step189_2020 } from '../../../proto/step189_2020';
import { ScaleLinear } from 'd3';

/**
 * TimelineData holds all required data for one interval on the timeline.
 */
interface TimelineData {
  pushID: string;     // Push ID number
  state: number;      // Final state of push
  startTime: number;  // Start of push, in milliseconds
  endTime: number;    // End of push, in milliseconds
  group: number;      // Group number corresponding to a row on timeline 
}

@Component({
  selector: 'app-timeline',
  templateUrl: './timeline.component.html',
  styleUrls: ['./timeline.component.scss']
})
export class TimelineComponent implements OnInit, OnChanges {
  /**
   * Private data variables. 
   * 
   * Note that we use the non-null assertion operator
   * ('!') to indicate to the compiler that variables will always be 
   * declared and thus to not issue errors about possibilities of them being
   * `null` or `undefined`.
   */
  @ViewChild('timeline') private timelineContainer!: ElementRef;
  @Input() private pushInfos!: step189_2020.IPushInfo[] | null;
  private data: TimelineData[] = [];
  private svg!: any;
  private x!: ScaleLinear<number, number>;
  private xAxis!: Function;
  private height!: number;
  private width!: number;
  private numGroups!: number;

  /**
   * Constants.
   */
  private static readonly COLOR_LIGHT_GRAY: string = '#d3d3d3';
  private static readonly PUSH_INFOS: string = 'pushInfos'
  private static readonly MIN_INTERVAL_HEIGHT: number = 25;
  private static readonly MSEC_PER_SEC: number = 10 ** 3;
  private static readonly NSEC_PER_MSEC: number = 10 ** 6;
  private static readonly SEC_PER_MIN: number = 60;
  private static readonly SEC_PER_HOUR: number = 60 * 60;
  private static readonly SEC_PER_DAY: number = 60 * 60 * 24;
  private static readonly MIN_PER_HOUR: number = 60;
  private static readonly HOUR_PER_DAY: number = 24;
  private static readonly STATE_TO_COLOR: { [index: number]: string } = {
    5: '#34a853',
    6: '#d50000',
    10: '#2196f3',
    12: '#d50000',
    13: '#2196f3',
    14: '#eee',
    15: '#2196f3',
    16: '#d50000',
    17: '#eee',
    18: '#34a853',
    19: '#eee'
  };

  ngOnInit(): void { }

  /**
   * Draws the initial timeline and updates it on any change.
   * @param changes Hashtable of changes
   */
  ngOnChanges(changes: SimpleChanges): void {
    // Since ngOnChanges() runs before the view can be initialized, any
    // attempts to access our @ViewChild will result in null. Thus, we
    // bypass the first change that occurs in order to first render the view.
    if (!changes[TimelineComponent.PUSH_INFOS].isFirstChange() && !this.svg) {
      this.updateTimeline(changes.pushInfos.currentValue);
    }
  }

  /**
   * Extracts the pushID, state, and start and end time for each push
   * in pushInfos and inserts them into TimelineData interfaces, which
   * are collectively stored in an array.
   * @param pushInfos Array of pushes for one push def
   */
  private populateData(pushInfos: step189_2020.IPushInfo[]): void {
    if (pushInfos == null) { return; }

    pushInfos.forEach(pushInfo => {
      if (!pushInfo) { return; }
      const pushes = pushInfo.stateInfo;
      if (!pushes) { return; }
      const pushesStartTime = pushes[0].startTimeNsec;
      if (!pushesStartTime) { return; }
      const pushesEndTime = pushes[pushes.length - 1].startTimeNsec;
      if (!pushesEndTime) { return; }
      const pushID = pushInfo.pushHandle;
      if (!pushID) { return; }
      const state = pushes[pushes.length - 1].state;
      if (!state) { return; }

      // Convert the start and end time values to seconds
      // The unary operator coerces the value to number type
      const startTime = +pushesStartTime / TimelineComponent.NSEC_PER_MSEC;
      const endTime = +pushesEndTime / TimelineComponent.NSEC_PER_MSEC;

      // Store data points as instances of TimelineBar interface
      this.data.push({
        pushID,
        state,
        startTime,
        endTime,
        group: 0
      } as TimelineData);
    });

    // Assign a group value to each push representing their horizontal placement
    // on the timeline. Each group index corresponds to one row
    this.divideIntoGroups();
  }

  /**
   * Divides the data into groups by assigning a group index (corresponding
   * to their row placement on the timeline) such that all intervals within a
   * group do not overlap. The algorithm takes a greedy approach by sorting
   * the group by increasing start time, sequentially picking the next interval,
   * and removing all intervals it overlaps with. It thus fits as many intervals
   * as possible in the first group, does so for each group until there are
   * no more intervals left. The runtime is O(n^2 * log(n)), which results in
   * the case that all intervals are overlapping.
   */
  private divideIntoGroups(): void {
    let data: TimelineData[] = [...this.data]; // Creates copy of this.data

    data.sort((a, b) => {
      return a.startTime - b.startTime;
    });

    let groupIndex = 0;
    let overlappingIntervals = [this.data[0]]; // Initialized to arbitrary value to avoid premature return
    while (overlappingIntervals.length !== 0) {
      let lastEndTime = 0;
      overlappingIntervals = [];
      for (const interval of data) {
        /**
         * To check for interval overlap with the already determined set of
         * non-overlapping intervals, we simply need to check if the start time
         * of the current interval is earlier than the last added end time.
         * This is a consequence of all events being sorted by start time.
         */
        if (interval.startTime >= lastEndTime) {
          const intervalInData = this.data.find(({ pushID }) => pushID === interval.pushID);
          if (intervalInData) {
            intervalInData.group = groupIndex;
          }
          lastEndTime = interval.endTime;
        }
        else {
          overlappingIntervals.push(interval);
        }
      }
      groupIndex++;
      lastEndTime = 0;
      data = overlappingIntervals;
    }
    this.numGroups = groupIndex;
  }

  /**
   * Creates a scrollable timeline with bars representing the duration of
   * pushes. Every time this function is called, the previous timeline SVG is
   * removed and a new one propagated to the screen. Timeline features include 
   * scrolling horizontally on the x-axis, zooming in and out along the x-axis,
   * and a tooltip display when hovering over intervals. Each interval is 
   * color-coded according to its final state.
   * @param pushInfos Holds all pushes for one push def.
   */
  private updateTimeline(pushInfos: step189_2020.IPushInfo[]): void {
    /**
     * Timeline functions
     */

    // Converts the date (in milliseconds) to a datetime string. The returned
    // date will have a format of YYYY-MM-DD hh-mm, with single digits padded
    // with a leading zero.
    const formatDate = (d: any) => {
      const date = new Date(d);
      const dateTimeFormat = new Intl.DateTimeFormat('en', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
      const [{ value: month }, , { value: day }, , { value: year }, , { value: hour }, , { value: minute }] = dateTimeFormat['formatToParts'](date);
      return `${year}-${month}-${day} ${hour}:${minute}`;
    };

    // Defines the zoom behavior, limiting the scale with which we can zoom in and out
    // and restricting zoom to the x-axis only. Upon zoom, the x-axis will rescale,
    // as will the timeline intervals.
    const zoom = d3.zoom()
      .scaleExtent([0.75, 1000]) // Limit zoom out.
      .translateExtent([[-100000, 0], [100000, 0]]) // Avoid scrolling too far.
      .on('zoom', () => {
        const transform = d3.event.transform;

        const updatedScale = transform.rescaleX(this.x);

        // Redraw the x-axis
        this.xAxis = d3
          .axisBottom(updatedScale)
          .tickSize(-this.height - 6)
          .tickPadding(10)
          .tickFormat(formatDate);

        this.svg.select('.x.axis')
          .call(this.xAxis)
          .selectAll('line')
          .style('stroke', TimelineComponent.COLOR_LIGHT_GRAY);

        this.svg.selectAll('rect.interval')
          .attr('x', (d: TimelineData) => updatedScale(d.startTime))
          .attr('width', (d: TimelineData) => updatedScale(d.endTime) - updatedScale(d.startTime));
      });

    // Create tooltip to display each interval's content.
    const createTooltip = (el: any) => { // TODO: tachyons?
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
    };

    // Sets the tooltip display that contains all the information that
    // should appear on hover.
    const getTooltipContent = (d: TimelineData) => {
      let duration = (d.endTime - d.startTime) / TimelineComponent.MSEC_PER_SEC;
      let output = Math.round(duration) + ' seconds';

      // Display duration in seconds, minutes, hours, or days, depending on
      // relative length of time
      const durationSeconds = duration * TimelineComponent.MSEC_PER_SEC;
      if (durationSeconds > TimelineComponent.SEC_PER_DAY) {
        duration = duration / TimelineComponent.SEC_PER_DAY;
        const truncated = Math.trunc(duration);
        output = truncated + ' days, ' + ((duration - truncated) * TimelineComponent.HOUR_PER_DAY).toFixed(2) + ' hours';
      } else if (durationSeconds > TimelineComponent.SEC_PER_HOUR) {
        duration = duration / TimelineComponent.SEC_PER_HOUR;
        const truncated = Math.trunc(duration);
        output = truncated + ' hours, ' + ((duration - truncated) * TimelineComponent.MIN_PER_HOUR).toFixed(2) + ' minutes';
      } else if (durationSeconds > TimelineComponent.SEC_PER_MIN) {
        duration = duration / TimelineComponent.SEC_PER_MIN;
        const truncated = Math.trunc(duration);
        output = truncated + ' minutes, ' + ((duration - truncated) * TimelineComponent.SEC_PER_MIN).toFixed(2) + ' seconds';
      }

      // HTML representation of all required data
      return `<b>Push ID: ${d.pushID.slice(d.pushID.indexOf('@') + 1)}</b>
        <br/>
        <b>Final State: ${d.state}</b>
        <br/>
        <b>Start Time: ${formatDate(d.startTime)}</b>
        <br/>
        <b> End Time: ${formatDate(d.endTime)}</b>
        <br/>
        <b>Duration: ${output}</b>
        `
    };


    /**
     * Building timeline components
     */

    // Filter the data by adding raw protocol buffer data into TimelineData
    // and seperating them into rows by giving them an individual group index
    this.populateData(pushInfos);

    const element = this.timelineContainer.nativeElement;

    // Clear out previous SVG element
    if (!this.svg) {
      d3.select('svg').remove();
    }

    // Determine the sizes of the timeline, including domain and range
    const elementWidth = element.clientWidth;
    let elementHeight = element.clientHeight;

    if (elementHeight > TimelineComponent.MIN_INTERVAL_HEIGHT * this.numGroups) {
      // Resive height if the current allocated interval height is too small
      // to see clearly and comfortably
      element.style.height = (TimelineComponent.MIN_INTERVAL_HEIGHT * this.numGroups) + 'px';
      elementHeight = element.clientHeight;
    }

    const minTimePoint = this.data.reduce((prev, cur) => {
      return (prev.startTime < cur.startTime) ? prev : cur;
    }).startTime;

    const maxTimePoint = this.data.reduce((prev, cur) => {
      return (prev.endTime > cur.endTime) ? prev : cur;
    }).endTime;

    const margin = { top: 0, right: 0, bottom: 20, left: 0 };

    this.width = elementWidth - margin.left - margin.right;
    this.height = elementHeight - margin.top - margin.bottom;

    // Establish the timeline's bottom axis
    this.x = d3.scaleLinear()
      .domain([minTimePoint, maxTimePoint])
      .range([0, this.width]);

    this.xAxis = d3
      .axisBottom(this.x)
      .tickSize(-this.height)
      .tickPadding(10)
      .tickFormat(formatDate);

    // Set up timeline chart components. The structure of the SVG tree
    // will contain a group with the x-axis on the bottom and rectangles
    // for each interval, the width of which is determined by its 
    // respective start and end time.
    this.svg = d3.select(element).append('svg')
      .attr('width', this.width + margin.left + margin.right)
      .attr('height', this.height + margin.top + margin.bottom)
      .attr('viewBox', `0 0 ${this.width} ${this.height}`)
      .attr('preserveAspectRatio', 'xMinYMin') // Preserve aspect ratio on window resize
      .append('g')
      .attr('transform', `translate(${margin.left} ${margin.top})`);

    this.svg.call(zoom);

    this.svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0 ${this.height})`)
      .call(this.xAxis)
      .selectAll('line')
      .style('stroke', TimelineComponent.COLOR_LIGHT_GRAY);

    this.svg.append('defs') // Determine what can be seen of the component
      .append('clipPath')
      .attr('id', 'chart-content')
      .append('rect')
      .attr('x', 1) // Prevent overlapping on x-axis
      .attr('y', 0)
      .attr('height', this.height)
      .attr('width', this.width);

    this.svg.append('rect')
      .attr('class', 'chart-bounds o-025')
      .attr('x', 0)
      .attr('y', 0)
      .attr('height', this.height)
      .attr('width', this.width);

    // Insert timeline interval bars
    const groupHeight = this.height / this.numGroups;
    this.svg.selectAll('.group-section')
      .data(this.data)
      .enter()
      .append('line')
      .attr('class', 'group-section')
      .attr('x1', 0)
      .attr('x2', this.width)
      .attr('y1', (d: TimelineData) => {
        return groupHeight * ((this.numGroups - d.group) + 1);
      })
      .attr('y2', (d: TimelineData) => {
        return groupHeight * ((this.numGroups - d.group) + 1);
      });

    const groupIntervalItems = this.svg.selectAll('.group-interval-item')
      .data(this.data)
      .enter()
      .append('g')
      .attr('clip-path', 'url(#chart-content)')
      .attr('transform', (d: TimelineData) => `translate(0, ${groupHeight * d.group})`)
      .attr('style', (d: TimelineData) => `fill: ${TimelineComponent.STATE_TO_COLOR[d.state]}`);

    const intervalBarHeight = 0.8 * groupHeight; // Creates space between each interval
    const intervalBarMargin = (groupHeight - intervalBarHeight) / 2;
    groupIntervalItems
      .append('rect')
      .attr('class', 'interval pointer')
      .attr('width', (d: TimelineData) => this.x(d.endTime) - this.x(d.startTime))
      .attr('height', intervalBarHeight)
      .attr('y', intervalBarMargin)
      .attr('x', (d: TimelineData) => this.x(d.endTime))

    // Set the tooltip display on hover
    const tooltipDiv = document.createElement('div');
    const tooltip = d3.select(tooltipDiv).call(createTooltip);
    element.appendChild(tooltipDiv);

    groupIntervalItems
      .on('mouseover', (d: TimelineData, i: number, nodes: any): void => {
        d3.select(nodes[i]).select('rect').attr('fill-opacity', 0.50);

        tooltip
          .html(getTooltipContent(d))
          .style('opacity', 1);
      })
      .on('mouseleave', (d: TimelineData, i: number, nodes: any): void => {
        d3.select(nodes[i]).select('rect').attr('fill-opacity', 1);
        tooltip.style('opacity', 0);
      });

    this.svg.on('mousemove', (d: TimelineData, i: number, nodes: any): void => {
      let [x, y] = d3.mouse(nodes[i]);
      y += 120; // Set how much below cursor the tooltip will appear
      if (x > nodes[i].width / 2) {
        x -= 100;
      }

      tooltip
        .style('left', x + 'px')
        .style('top', y + 'px');
    })
  }
};
