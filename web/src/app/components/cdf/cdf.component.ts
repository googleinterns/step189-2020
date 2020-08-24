import { Component, ElementRef, Input, ViewChild, AfterViewInit } from '@angular/core';
import * as d3 from 'd3';

import { step189_2020 } from '../../../proto/step189_2020';

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

export class CdfComponent implements AfterViewInit {
  private static readonly NANO_TO_MINUTES: number = (10 ** 9) * 60;
  private static readonly COMPLETED_BLUE: string = '#00bfa5';
  private static readonly COMPLETED_STATE_TAG: number = 5;

  @ViewChild('cdf') private cdfContainer!: ElementRef;
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

      if (finalState === CdfComponent.COMPLETED_STATE_TAG) {
        // Find the start time of the first non-empty stage.
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
   * CdfChart:
   *     - y-axis-left, y-axis-right, y-axis-left-label
   *     - path:
   *         - cdf-curve
   * svg:
   *     - x-axis, x-axis-label, graph-title
   */
  private createChart(): void {
    if (!this.pushInfos) { return; }
    this.data = CdfComponent.populateData(this.pushInfos);

    const element = this.cdfContainer.nativeElement;
    const elementWidth = element.clientWidth;
    const elementHeight = element.clientHeight;

    const margin = { top: 50, right: 50, bottom: 50, left: 50 };

    const width = elementWidth - margin.left - margin.right;
    const height = elementHeight - margin.top - margin.bottom;

    const maxDuration = d3.max(this.data, d => d.duration);
    if (!maxDuration) { return; }

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

    // Removes axis's vertical line and keeps the tick marks.
    yAxisLeft.select('.domain').remove();

    cdfChart.append('text')
      .attr('class', 'y-axis-left-label')
      .attr('transform', 'rotate(-90)')
      .attr('y', -margin.left)
      .attr('x', -height / 2)
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

    // Removes axis's vertical line and keeps the tick marks.
    yAxisRight.select('.domain').remove();

    const xAxis = this.svg
      .append('g')
      .attr('class', 'x-axis')
      .attr('transform', `translate(${margin.left}, ${height + margin.top})`)
      .call(d3.axisBottom(xScale));

    this.svg.append('text')
      .attr('class', 'x-axis-label')
      .attr('transform',
            `translate(${(elementWidth) / 2}, ${elementHeight - margin.bottom / 2})`)
      .style('text-anchor', 'middle')
      .style('font-size', '12px')
      .text('Duration (minutes)');

    this.svg.append('text')
      .attr('class', 'graph-title')
      .attr('x', elementWidth / 2)
      .attr('y', margin.top / 2)
      .attr('text-anchor', 'middle')
      .style('font-size', '16px')
      .text('CDF of completed push durations');
      
    cdfChart
      .datum(this.graphData)
      .append('path')
      .attr('class', 'cdf-curve')
      .attr('fill', CdfComponent.COMPLETED_BLUE)
      .attr('d', d3.area<Item>()
        .x(d => xScale(d.duration))
        .y1(d => yScale(d.probability))
        .y0(yScale(0))
        .curve(d3.curveStepAfter)
      );
  }

  /*
   * After the component's view has been fully initialized, the chart can be
   * created. Since the pushInfos are static, we do not need to create the chart
   * at every change.
   */
  ngAfterViewInit(): void { this.createChart(); }
}
