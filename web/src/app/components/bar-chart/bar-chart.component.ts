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

import {step189_2020} from '../../../proto/step189_2020';

/**
 * Item includes all data used by the single in the bar chart.
 */
interface Item {
  pushID: string;     // Push ID string
  state: number;      // Tag of the push end state
  startTime: string;  // Start time of the push, in `yyyy-MM-dd HH:mm:ss` format
  durationHours: number;  // Duration of the push, in hours
}

/**
 * D3 types used by the bar chart.
 *
 * The d3.Selection has the default type Selection<GElement, Datum, PElement,
 * PDatum>, and we want to use it with Datum, Datum, PElement, PDatum being
 * `undefined` or `null`. The SVGSVGElement provides the access and all methods
 * to manipulate `<svg>` element, while SVGGElement corresponds to the `g`
 * element that the top bar chart and the bottom bar chart belong to.
 *
 * We separate the top bar chart and the bottom bar chart by `g` elements, so
 * that they can be updated with different methods using dropdown menu and
 * brush selector.
 */
type d3SVG = d3.Selection<SVGSVGElement, Item[], null, undefined>;
type d3G = d3.Selection<SVGGElement, Item[], null, undefined>;
type d3Circle = d3.Selection<SVGCircleElement, Item, SVGGElement, Item[]>;
type d3HTML = d3.Selection<HTMLDivElement, Item, null, undefined>;
type d3Rect = d3.Selection<SVGRectElement, Item, SVGGElement, Item[]>;
type d3ScaleLinear = d3.ScaleLinear<number, number>;
type d3ScaleBand = d3.ScaleBand<string>;

@Component({
  selector: 'app-bar-chart',
  templateUrl: './bar-chart.component.html',
  styleUrls: ['./bar-chart.component.scss']
})

export class BarChartComponent implements AfterViewInit {
  /**
   * Constants.
   */
  private static readonly DEFAULT_NUM_BARS: number = 30;
  private static readonly DEFAULT_MAX_BARS: number = 100;
  private static readonly NANO_TO_SECS: number = 10 ** 9;
  private static readonly NANO_TO_MILLI: number = 10 ** 6;
  private static readonly SECS_TO_HRS: number = 60 * 60;
  private static readonly ALL_PUSHES_OPTION: string = 'all';
  private static readonly COLOR_LIGHT_GRAY: string = '#787878';
  private static readonly COLOR_DARK_GRAY: string = '#373C38';
  private static readonly COLOR_WHITE: string = '#eee';
  private static readonly COLOR_WHITE_TRANS: string = '#ffffff00';
  private static readonly DATE_FORMAT: string = 'yyyy-MM-dd HH:mm:ss';
  private static readonly DATE_LOCALE: string = 'en-US';
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
    12: '#d50000',
    13: '#2196f3',
    15: '#2196f3',
    16: '#d50000'
  };

  /**
   * Private variables.
   *
   * The non-null assertion operator('!') suggests that there is no
   * issue of variables being `null` or `undefined`. Some variables are
   * declared as any, as their types change in different functions.
   */
  @ViewChild('barchart') private barChartContainer!: ElementRef;
  @Input() private pushInfos!: step189_2020.IPushInfo[]|null;
  @Input() private currentPush!: step189_2020.IPushInfo|null;

  private dataAll: Item[] = [];
  private dataComplete: Item[] = [];
  private svg: d3SVG|undefined;
  private focus: d3G|undefined;
  private brush: d3G|undefined;
  private points: d3Circle|undefined;
  private boxplot: d3G|undefined;
  private tag: d3G|undefined;
  private tooltip: d3HTML|undefined;
  private heightBrush = 0;
  private width = 0;
  private xScaleFocus: d3ScaleBand = d3.scaleBand();
  private yScaleFocus: d3ScaleLinear = d3.scaleLinear();
  private xScaleBrush: d3ScaleBand = d3.scaleBand();
  private yScaleBrush: d3ScaleLinear = d3.scaleLinear();
  private xAxisFocus: d3G|undefined;
  private xAxisBrush: d3G|undefined;
  private yAxis: d3G|undefined;

  ngAfterViewInit(): void {
    if (!this.pushInfos) {
      return;
    }
    this.update(this.pushInfos);
    this.initialChart();
    this.updateChart();  // Initialize the focus chart with dataAll.
  }

  /**
   * This function populates pushID, state, startTime and durationHours of
   * given pushes. It generates dataAll and dataComplete for the two bar charts.
   *
   * @param pushInfos: Array for one push def
   */
  private update(pushInfos: step189_2020.IPushInfo[]): void {
    if (!pushInfos) {
      return;
    }
    pushInfos.reverse().forEach(pushInfo => {
      if (!pushInfo) {
        return;
      }
      const states = pushInfo.stateInfo;
      if (!states) {
        return;
      }
      const pushID = pushInfo.pushHandle;
      if (!pushID) {
        return;
      }
      const endState = states[states.length - 1].state;
      if (!endState) {
        return;
      }
      const pushStartTime = states[0].startTimeNsec;
      if (!pushStartTime) {
        return;
      }
      const pushEndTime = states[states.length - 1].startTimeNsec;
      if (!pushEndTime) {
        return;
      }

      // Filter pushes with only one state (0 duration) and endState which
      // should not be considered.
      if (states.length <= 1) {
        return;
      }
      if (endState !== 14 && endState !== 17 && endState !== 18 &&
          endState !== 19) {
        const startTime = formatDate(
            (+pushStartTime / BarChartComponent.NANO_TO_MILLI),
            BarChartComponent.DATE_FORMAT, BarChartComponent.DATE_LOCALE);
        const durationHours = (+pushEndTime - +pushStartTime) /
            BarChartComponent.NANO_TO_SECS / BarChartComponent.SECS_TO_HRS;
        const thePush:
            Item = {pushID, state: endState, startTime, durationHours};
        this.dataAll.push(thePush);

        if (endState === 5) {
          this.dataComplete.push(thePush);
        }
      }
    });
  }

  /**
   * This function scales the x-axis and y-axis and initializes empty focus
   * and brush elements.
   *
   * Structure of the SVG:
   * <svg>
   *  <g id='focus-bar-chart'>
   *    <g id='boxplot'>
   *      <circle class='boxplot-points'></circle>
   *      <rect class='boxplot-box'></rect>
   *      <line class='boxplot-median'></line>
   *      <line class='boxplot-ticks'></line>
   *      <text class='boxplot-labels'></text>
   *    </g>
   *    <g class='axis-xFocus'></g>
   *    <g class='axis-y'></g>
   *    <text id='bar-chart-title'></text>
   *    <text id='y-axis-title'></text>
   *    <rect class='new-bars'></rect>
   *    <rect class='trans-bars'></rect>
   *    // Implemented in local function changeFocus, so that the bars doesn't
   *    // cover the number.
   *    <g id='tag></g>
   *  </g>
   *  <g id='brush-bar-chart'>
   *    <g class='axis-xBrush'></g>
   *    <rect class='brush-bars'></g>
   *    // Implemented in updateChart funtion.
   *    <g class='brush'></g>
   *  </g>
   * </svg>
   */
  private initialChart(): void {
    const element = this.barChartContainer.nativeElement;
    const elementWidth = element.clientWidth;
    const elementHeight = element.clientHeight;
    const marginFocus = {top: 60, right: 90, bottom: 150, left: 110};
    const marginBrush = {top: 380, right: 90, bottom: 20, left: 110};

    this.heightBrush = 30;
    this.width = elementWidth;

    this.svg = (d3.select(element).append('svg') as d3SVG)
                   .attr('width', elementWidth)
                   .attr('height', elementHeight);

    this.focus = this.svg.append('g')
                     .attr('id', 'focus-bar-chart')
                     .attr('transform', 'translate(0, 0)');

    // The brush here is an interactive element that allows dragging to display
    // the focus bar chart.
    this.brush = this.svg.append('g')
                     .attr('id', 'brush-bar-chart')
                     .attr('transform', `translate(0, ${marginBrush.top})`);

    this.boxplot = this.focus.append('g').attr('id', 'boxplot');

    this.xScaleFocus =
        d3.scaleBand()
            .range([marginFocus.left, elementWidth - marginFocus.right])
            .padding(0.1);
    this.yScaleFocus = d3.scaleLinear().range(
        [elementHeight - marginFocus.bottom, marginFocus.top]);
    this.xAxisFocus =
        this.focus.append('g')
            .attr('class', 'axis-xFocus')
            .attr(
                'transform',
                `translate(0, ${elementHeight - marginFocus.bottom})`);
    this.yAxis = this.focus.append('g')
                     .attr('class', 'axis-y')
                     .attr('transform', `translate(${marginFocus.left}, 0)`)
                     .style('color', BarChartComponent.COLOR_LIGHT_GRAY);

    this.focus.append('text')
        .attr('id', 'bar-chart-title')
        .attr('text-anchor', 'middle')
        .attr('transform', `translate(${elementWidth / 2},
        ${marginFocus.top / 2})`)
        .style('font-size', '16px sans-serif')
        .text('Bar chart of push durations');
    this.focus.append('text')
        .attr('id', 'y-axis-title')
        .attr('text-anchor', 'middle')
        .attr(
            'transform',
            'translate(' + (marginFocus.left / 2 + 25) + ',' +
                ((elementHeight - marginFocus.bottom + marginFocus.top) / 2) +
                ')rotate(-90)')
        .attr('fill', BarChartComponent.COLOR_LIGHT_GRAY)
        .text('Push durations (hours)')
        .style('font', '12px sans-serif');

    this.xScaleBrush =
        d3.scaleBand()
            .range([marginBrush.left, elementWidth - marginBrush.right])
            .padding(0.1);
    this.yScaleBrush = d3.scaleLinear().range([this.heightBrush, 0]);
    this.xAxisBrush =
        this.brush.append('g')
            .attr('class', 'axis-xBrush')
            .attr('transform', `translate(0, ${this.heightBrush})`);
  }

  /**
   * This function updates the focus bar chart and the brush bar chart based on
   * the data of the dropdown selection. The function displays the most recent
   * `DEFAULT_NUM_BARS` by default. It also implements an interactive brush to
   * display a selected area of the bar chart. If the user selects
   * 'Show all pushes', the function updates both charts with all pushes;
   * otherwise, it updates the charts with just the completed ones.
   */
  public updateChart(): void {
    // Clear all bars from the previous selection.
    d3.selectAll('rect').remove();

    const valueSelected =
        (document.getElementById('selections') as HTMLSelectElement).value;
    const dataSelected =
        (valueSelected === BarChartComponent.ALL_PUSHES_OPTION) ?
        this.dataAll :
        this.dataComplete;
    if (!dataSelected) {
      return;
    }

    const maxDuration = d3.max(dataSelected, (d: Item) => d.durationHours);
    if (!maxDuration) {
      return;
    }

    // Update xScaleBrush, yScaleBrush and xAxisBrush based on the
    // selected data for the brush chart.
    this.xScaleBrush.domain(dataSelected.map((d: Item) => d.startTime));
    this.yScaleBrush.domain([0, maxDuration]);
    if (!this.xAxisBrush) {
      return;
    }
    this.xAxisBrush.transition()
        .duration(0)
        .call(d3.axisBottom(this.xScaleBrush).tickSize(0))  // Remove the ticks.
        .selectAll('text')
        .attr('opacity', 0);  // Hide the x axis labels of the brush chart.

    // Remove the horizontal line of brush x axis to prevent overlaying the
    // brush selector.
    this.xAxisBrush.select('.domain').remove();

    // Initialize the brush bar chart.
    if (!this.brush) {
      return;
    }
    const brushBars =
      (this.brush.selectAll('rect') as d3Rect)
      .data(dataSelected)
      .enter();

    brushBars
        .append('rect')
        .attr('x', (d: Item) => {
          const x = this.xScaleBrush(d.startTime);
          return !x ? null : x; // Return `null` if x is `undefined`.
        })
        .attr('width', this.xScaleBrush.bandwidth())
        .attr('y', (d: Item) => this.yScaleBrush(d.durationHours))
        .attr(
            'height',
            (d: Item) => this.heightBrush - this.yScaleBrush(d.durationHours))
        .attr(
            'style',
            (d: Item) => `fill: ${BarChartComponent.STATE_TO_COLOR[d.state]}`)
        .attr('fill-opacity', 1)
        .attr('stroke', (d: Item) => {  // Outline the white bars.
          if (BarChartComponent.STATE_TO_COLOR[d.state] ===
              BarChartComponent.COLOR_WHITE) {
            return BarChartComponent.COLOR_DARK_GRAY;
          }
          return 'none';
        });

    // Apply transition to all elements.
    brushBars.selectAll('rect').transition().duration(500);

    // This function shows the tooltip and tags when the user hovers over a
    // bar, or the empty area above it. The function here is a callback, so we
    // use an arrow function to make `this` indicate the current object instead
    // of the context in which the callback is invoked.
    const showHoverInformation = (d: Item, i: number) => {
      // Locate x and y position of the bar.
      const barX = this.xScaleFocus(d.startTime);
      const barY = this.yScaleFocus(d.durationHours);
      // Highlight the bar when hover over it and blur the x labels.
      d3.select(d3.event.currentTarget).attr('fill-opacity', 0.70);
      d3.select('.axis-xFocus').selectAll('text').style('opacity', 0.65);
      if (!this.points) {
        return;
      }
      d3.select(this.points.nodes()[i])  // Hightlight the corresponding point.
          .attr('fill-opacity', 1)
          .style('stroke', BarChartComponent.COLOR_DARK_GRAY);
      this.addTag(d, barX, barY);
      this.initialTooltip(d, barX, barY);
    };

    // This function removes the tooltip and tags when the user's cursor
    // leaves a bar, or the empty area above it. The function here is a
    // callback, so we use an arrow function to make `this` indicate the current
    // object instead of the context in which the callback is invoked.
    const hideHoverInformation = (d: Item, i: number) => {
      // Remove highlight from the bar and reset the x labels.
      d3.select(d3.event.currentTarget).attr('fill-opacity', 1);
      d3.select('.axis-xFocus').selectAll('text').style('opacity', 1);
      if (!this.points) {
        return;
      }
      d3.select(this.points.nodes()[i])  // Remove highlight from the point.
          .attr('fill-opacity', 0.45)
          .style('stroke', 'none');
      if (!this.tag) {
        return;
      }
      this.tag.selectAll('text').remove();
      if (!this.tooltip) {
        return;
      }
      this.tooltip.remove();
    };

    // This local function changes the focus of the top bar chart based
    // on the input.
    const changeFocus = (inputData: Item[]) => {
      if (!inputData) {
        return;
      }

      // Remove all bars from previous brushing.
      if (!this.focus) {
        return;
      }
      this.focus.selectAll('rect').remove();

      const maxFocusDuration =
          d3.max(inputData, (d: Item) => Math.ceil(d.durationHours));
      if (!maxFocusDuration) {
        return;
      }

      // Upate the xScaleFocus, yScaleFocus, xAxisFocus and yAxisFocus
      // based on the selected data for the focus chart.
      this.xScaleFocus.domain(inputData.map((d: Item) => d.startTime));
      this.yScaleFocus.domain([0, maxFocusDuration])
          .nice();  // Optimal the number of ticks we want to show.

      if (!this.yAxis) {
        return;
      }
      this.yAxis.call(d3.axisLeft(this.yScaleFocus));


      // Remove the horizontal line of y axis to follow the convention.
      this.yAxis.select('.domain').remove();

      // If the focus chart has more than `DEFAULT_MAX_BARS`, set the ticks and
      // labels on xAxisFocus to be always smaller than `DEFAULT_MAX_BARS`.
      if (!this.xAxisFocus) {
        return;
      }
      if (inputData.length > BarChartComponent.DEFAULT_MAX_BARS) {
        const modNum =
            Math.round((inputData.length / BarChartComponent.DEFAULT_MAX_BARS));
        this.xAxisFocus.call(
             d3.axisBottom(this.xScaleFocus)
                .tickValues(this.xScaleFocus.domain().filter(
                    (x: string, i: number) => !(i % modNum)))
                .tickSizeOuter(0));
      } else {
        this.xAxisFocus.call(d3.axisBottom(this.xScaleFocus).tickSizeOuter(0));
      }
      this.xAxisFocus.selectAll('text')
          .style('text-anchor', 'end')
          .attr('dx', '-10px')
          .attr('dy', '-5px')
          .attr('transform', 'rotate(-90)')
          .style('fill', BarChartComponent.COLOR_LIGHT_GRAY);

      const focusBars = (this.focus.selectAll('rect') as d3Rect)
          .data(inputData)
          .enter();

      const solidBars =
          focusBars
              .append('rect')
              .attr('x', (d: Item) => {
                const x = this.xScaleFocus(d.startTime);
                return !x ? null : x; // Return `null` if x is `undefined`.
              })
              .attr('width', this.xScaleFocus.bandwidth())
              .attr('y', (d: Item) => this.yScaleFocus(d.durationHours))
              .attr(
                  'height',
                  (d: Item) =>
                      this.yScaleFocus(0) - this.yScaleFocus(d.durationHours))
              .attr(
                  'style',
                  (d: Item) =>
                      `fill: ${BarChartComponent.STATE_TO_COLOR[d.state]}`)
              .attr('fill-opacity', 1)
              .attr(
                  'stroke',
                  (d: Item) => {  // Outline the white bars.
                    if (BarChartComponent.STATE_TO_COLOR[d.state] ===
                        BarChartComponent.COLOR_WHITE) {
                      return BarChartComponent.COLOR_DARK_GRAY;
                    }
                    return 'none';
                  })
              .on('mouseover', showHoverInformation)
              .on('mouseleave', hideHoverInformation);

      // Add transparent bars for hover convience.
      focusBars
          .append('rect')  // Add a transparent rect for each element.
          .attr('x', (d: Item) => {
            const x = this.xScaleFocus(d.startTime);
            return !x ? null : x; // Return `null` if x is `undefined`.
          })
          .attr('width', this.xScaleFocus.bandwidth())
          .attr('y', (d: Item) => this.yScaleFocus(maxFocusDuration))
          .attr(
              'height',
              (d: Item) => this.yScaleFocus(d.durationHours) -
                  this.yScaleFocus(maxFocusDuration))
          .attr('fill', BarChartComponent.COLOR_WHITE_TRANS)
          .on('mouseover',
              (d: Item, i: number) => {
                d3.select(solidBars.nodes()[i]).attr('fill-opacity', 0.7);
                showHoverInformation(d, i);
              })
          .on('mouseleave', (d: Item, i: number) => {
            d3.select(solidBars.nodes()[i]).attr('fill-opacity', 1);
            hideHoverInformation(d, i);
          });

      // Apply transition to all elements.
      focusBars.selectAll('rect').transition().duration(500);

      // Create a boxplot based on inputData.
      this.createBoxplot(inputData);

      // Append tag to the focus element, so it always shows on top of the bars.
      this.tag = this.focus.append('g').attr('id', 'tag');
    };

    // Update the focus chart given the selected data. If the selected data
    // contains more than 30 Items, only show the most recent 30 Items by
    // default.
    changeFocus(
        (dataSelected.length > BarChartComponent.DEFAULT_NUM_BARS) ?
            dataSelected.slice(
                dataSelected.length - BarChartComponent.DEFAULT_NUM_BARS,
                dataSelected.length) :
            dataSelected);

    // Local variable used by the brushDown function to prevent the use
    // of `this` in the callback function.
    const localBrush = this.xScaleBrush;

    // This callback function updates the focus bar chart selection to the
    // brusing area. It is declared as a local function to prevent the use of
    // `this`. The listener of D3 brush function defaults `this` context as the
    // current DOM element. We have to declare it locally, in order to use
    // xScaleBrush and dataSelected.
    const brushDown = () => {
      // Return if no input is given or the selection is emtpy.
      if (!d3.event.sourceEvent || !d3.event.selection) {
        return;
      }
      // Remove hover tooltip and tag while brushing on bars.
      if (this.tooltip) {
        this.tooltip.remove();
      }
      if (this.tag) {
        this.tag.selectAll('text').remove();
      }
      const newInput: string[] = [];
      let brushArea = d3.event.selection;
      // Set the area of selection to the entire xScaleFocus if selection
      // is invalid.
      if (brushArea[0] === brushArea[1]) {
        brushArea = localBrush.range();
      }

      localBrush.domain().forEach((d: string) => {
        const barPosition = localBrush(d);
        if (!barPosition) {
          return;
        }
        const position = barPosition + localBrush.bandwidth() / 2;
        if (position >= brushArea[0] && position <= brushArea[1]) {
          newInput.push(d);
        }
      });

      const newData: Item[] = [];
      for (const data of dataSelected) {
        if (newInput.includes(data.startTime)) {
          newData.push(data);
        }
      }

      // Update the bar chart with extracted data.
      changeFocus(newData);
    };

    // Initial position of the brush selector according to the input of the
    // focus bar.
    const lastItem =
        this.xScaleBrush(dataSelected[dataSelected.length - 1].startTime);
    const firstItem =
        (dataSelected.length > BarChartComponent.DEFAULT_NUM_BARS) ?
        dataSelected[dataSelected.length - BarChartComponent.DEFAULT_NUM_BARS] :
        dataSelected[0];
    if (!lastItem) {
      return;
    }
    const firstItemPosition = this.xScaleBrush(firstItem.startTime);
    const lastItemPosition = lastItem + this.xScaleBrush.bandwidth();

    const brushSelector =
        d3.brushX()
            .extent([[110, 0], [this.width - 90, this.heightBrush]])
            .on('brush',
                brushDown);  // Update the focus bar chart based on selection.

    (this.brush.append('g') as
    d3.Selection<SVGGElement, unknown, null, unknown>)
        .attr('class', 'brush')
        .call(brushSelector)
        .call(brushSelector.move, [firstItemPosition, lastItemPosition]);
  }

  /**
   * This function creates a boxplot next to the focus bar chart with all
   * selected data. It indicates maximum, minimium, median, first quantile and
   * third quantile of the selected data durations.
   *
   * @param inputData: Data selected for the focus bar chart
   */
  private createBoxplot(inputData: Item[]): void {
    if (!this.boxplot) {
      return;
    }
    // Remove all elements of from the previous boxplot.
    this.boxplot.selectAll('circle').remove();
    this.boxplot.selectAll('line').remove();
    this.boxplot.selectAll('text').remove();

    const durationSelected = inputData.map((obj: Item) => obj.durationHours);
    const durationSorted = durationSelected.sort(d3.ascending);
    const durationMax = durationSorted[durationSorted.length - 1];
    const durationMin = durationSorted[0];

    const q1 = d3.quantile(durationSorted, 0.25);
    if (!q1) {
      return;
    }
    const median = d3.quantile(durationSorted, 0.5);
    if (!median) {
      return;
    }
    const q3 = d3.quantile(durationSorted, 0.75);
    if (!q3) {
      return;
    }
    const dataLabels = [durationMax, durationMin, q1, median, q3];

    const boxWidth = 30;
    // If more than `DEFAULT_MAX_BARS` are selected, set the circle radius to be
    // 1.4; otherwise, set the radius to 2.5.
    const pointRadius =
        (inputData.length > BarChartComponent.DEFAULT_MAX_BARS) ? 1.4 : 2.5;
    const jitterWidth = boxWidth - 10;
    const center = this.width - 55;

    // Add individual points with jitter.
    const newBoxplot = this.boxplot.selectAll('points').data(inputData);

    this.points =
        newBoxplot.attr('class', 'boxplot-points')
            .enter()
            .append('circle')
            .attr(
                'cx',
                (d: Item) =>
                    (center - jitterWidth / 2 + Math.random() * jitterWidth))
            // TODO: Tie the position of the points for any change of the brush.
            .attr('cy', (d: Item) => this.yScaleFocus(d.durationHours))
            .attr('r', pointRadius)
            .style(
                'fill', (d: Item) => BarChartComponent.STATE_TO_COLOR[d.state])
            .style('fill-opacity', 0.45);  // Show overlay among dataPoints.

    // Add the rectangle for the boxplot.
    this.boxplot.attr('class', 'boxplot-box')
        .append('rect')
        .attr('x', center - boxWidth / 2)
        .attr('y', this.yScaleFocus(q3))
        .attr('height', (this.yScaleFocus(q1) - this.yScaleFocus(q3)))
        .attr('width', boxWidth)
        .attr('stroke', BarChartComponent.COLOR_DARK_GRAY)
        .style('fill-opacity', 0);

    // Add the median horizontal line to the boxplot.
    this.boxplot.attr('class', 'boxplot-median')
        .append('line')
        .attr('x1', center - boxWidth / 2)
        .attr('x2', center + boxWidth / 2)
        .attr('y1', this.yScaleFocus(median))
        .attr('y2', this.yScaleFocus(median))
        .attr('stroke', BarChartComponent.COLOR_DARK_GRAY)
        .style('fill-opacity', 1);

    // Add ticks for max, min, median, q1 and q3.
    this.boxplot.attr('class', 'boxplot-ticks')
        .selectAll('ticks')
        .data(dataLabels)
        .enter()
        .append('line')
        .attr('x1', center + boxWidth / 2 + 4)
        .attr('x2', center + boxWidth / 2 + 10)
        .attr('y1', (d: number) => this.yScaleFocus(d))
        .attr('y2', (d: number) => this.yScaleFocus(d))
        .attr('stroke', BarChartComponent.COLOR_LIGHT_GRAY)
        .style('fill-opacity', 1);

    // Add labels for max, min, median, q1 and q3.
    this.boxplot.attr('class', 'boxplot-labels')
        .selectAll('labels')
        .data(dataLabels)
        .enter()
        .append('text')
        .attr('dx', center + boxWidth / 2 + 12)
        .attr('dy', (d: number) => this.yScaleFocus(d) + 3)
        .attr('line-height', '1.5')
        .text((d: number) => d.toFixed(1))
        .style('text-anchor', 'start')
        .style('font', '11px sans-serif')
        .style('fill', BarChartComponent.COLOR_LIGHT_GRAY);
  }

  /**
   * This function adds tag content, which is the time duration for the push,
   * and startTime. The time duration is added on top of the hovered bar, and
   * the startTime is bolded on the x axis of the focus bar chart.
   *
   * @param d: Item that the bar represents
   * @param barX: x position of the bar
   * @param barY: y position of the bar
   */
  private addTag(d: Item, barX: number|undefined, barY: number): void {
    if (!barX) {
      return;
    }
    if (!this.tag) {
      return;
    }

    // Add time duration, in one decimal.
    this.tag.append('text')
        .attr('dx', (barX + this.xScaleFocus.bandwidth() / 2) + 'px')
        .attr('dy', (barY - 4) + 'px')
        .style('color', BarChartComponent.COLOR_DARK_GRAY)
        .style('font', '11px sans-serif')
        .style('line-height', '1.3')
        .style('text-anchor', 'middle')
        .text(d.durationHours.toFixed(1));

    // Bold the start time on x axis.
    this.tag.append('text')
        .attr('dx', (barX + this.xScaleFocus.bandwidth() / 2 + 3.5) + 'px')
        .attr('dy', 280 + 'px')
        .attr(
            'transform',
            'rotate(-90 ' + (barX + this.xScaleFocus.bandwidth() / 2 + 3.5) +
                ',' + 280 + ')')
        // .attr('style', 'font-weight: bold;')
        .style('stroke', BarChartComponent.COLOR_DARK_GRAY)
        .style('stroke-width', '0.5px')
        .style('fill', BarChartComponent.COLOR_DARK_GRAY)
        .style('font', '10px sans-serif')
        .style('line-height', '1.3')
        .style('text-anchor', 'end')
        .text(d.startTime);
  }

  /**
   * This fucntion initializes the tooltip on top of the duration tag.
   *
   * @param d: Item that the bar represents
   * @param barX: x position of the bar
   * @param barY: y position of the bar
   */
  private initialTooltip(d: Item, barX: number|undefined, barY: number): void {
    const element = this.barChartContainer.nativeElement;
    // Create a `div` fpr the tooltip.
    const tooltipDiv = document.createElement('div');
    tooltipDiv.setAttribute('class', 'tooltip');
    this.tooltip = d3.select(tooltipDiv);

    // Add tooltip style.
    this.tooltip.attr('class', 'tooltip')
        .style('position', 'absolute')
        .style('pointer-events', 'none')
        .style('opacity', 1)
        .style('background-color', 'black')
        .style('color', 'white')
        .style('border-radius', '2px')
        .style('padding', '6px')
        .style('box-shadow', '0 0 7px rgba(0,0,0,.3)')
        .style('line-height', '1.5')
        .style('font', '12px sans-serif')
        .style('display', 'inline');
    element.appendChild(tooltipDiv);

    if (!barX) {
      return;
    }
    // Reposition the x so that the middle of the tooltip sits on top of the
    // bar.
    barX -= (130 - this.xScaleFocus.bandwidth() / 2);

    // Add tooltip content.
    this.tooltip.style('left', barX + 'px')
        .style('top', barY - 10 + 'px')
        .style('background-color', BarChartComponent.STATE_TO_COLOR[d.state])
        .html(
            'Push ID: ' + d.pushID + '<br> End state: ' + d.state +
            '<br> Start time: ' + d.startTime);
  }
}
