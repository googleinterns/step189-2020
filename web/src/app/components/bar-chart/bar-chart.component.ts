import { AfterViewInit, Component, ElementRef, Input, ViewChild} from '@angular/core';
import { formatDate } from '@angular/common';
import * as d3 from 'd3';

import { step189_2020 } from '../../../proto/step189_2020';

/**
 * Item includes all data used by the single in the bar chart.
 */
interface Item {
  pushID: string;    // Push ID string
  state: number;     // Tag of the push end state
  startTime: string; // Start time of the push, in `YYYY-MM-DD HH:mm` format
  durationHours: number;  // Duration of the push, in hours
}

/**
 * D3 types used by the bar chart.
 *
 * The d3.Selection has the default type Selection<GElement, Datum, PElement,
 * PDatum>, and we want to use it with Datum, Datum, PElement, PDatum being
 * `undefined` or `null`. The SVGSVGElement provides the access and all methods
 * to manipulate `<svg>` element, while SVGGElement corresponds to the `g` element
 * that the top bar chart and the bottom bar chart belong to.
 *
 * We separate the top bar chart and the bottom bar chart by `g` elements, so that
 * they can be updated with different methods using dropdown menu and brush selector.
 */
type d3SVG = d3.Selection<SVGSVGElement, undefined, null, undefined>;
type d3G = d3.Selection<SVGGElement, undefined, null, undefined>;
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
  private static readonly NANO_TO_SECS: number = 10 ** 9;
  private static readonly NANO_TO_MILLI: number = 10 ** 6;
  private static readonly SECS_TO_HRS: number = 60 * 60;
  private static readonly ALL_PUSHES_OPTION: string = 'all';
  private static readonly COLOR_LIGHT_GRAY: string = '#787878';
  private static readonly COLOR_DARK_GRAY: string = '#373C38';
  private static readonly COLOR_WHITE: string = '#eee';
  private static readonly COLOR_WHITE_TRANS: string = '#ffffff00';
  private static readonly DATE_FORMAT: string = 'yyyy-mm-dd hh:mm';
  private static readonly DATE_LOCALE: string = 'en-US';
  private static readonly STATE_TO_COLOR: { [index: number]: string } = {
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
  @ViewChild('barchart') private barChartContainer!: ElementRef; // Bar chart component
  @Input() private pushInfos!: step189_2020.IPushInfo[] | null;
  @Input() private currentPush!: step189_2020.IPushInfo | null;

  private dataAll: Item[] = [];
  private dataComplete: Item[] = [];
  private totalDuration: number[] = [];
  private completeDuration: number[] = [];
  private svg: d3SVG | undefined;
  private focus: d3G | undefined; // Top bar chart for display.
  // tslint:disable-next-line: no-any
  private brush: any; // Bottom bar chart for brushing.
  private heightFocus = 0;
  private heightBrush = 0;
  private width = 0;
  // tslint:disable-next-line: no-any
  private xScaleFocus: any;
  private yScaleFocus!: d3ScaleLinear;
  // tslint:disable-next-line: no-any
  private xScaleBrush: any;
  private yScaleBrush!: d3ScaleLinear;
  private xAxisFocus: d3G | undefined;
  private xAxisBrush: d3G | undefined;
  private yAxis: d3G | undefined;

  ngAfterViewInit(): void {
    if (!this.pushInfos) { return; }
    this.update(this.pushInfos);
    this.initialChart();
    this.updateChart(); // Initialize the focus chart with dataAll.
  }

  /**
   * This function populates pushID, state, startTime and durationHours of
   * given pushes. It generates dataAll and dataComplete for the two bar charts
   * and fills durationsHours for totalDuration and completeDuration for the
   * future boxplot. DataAll and dataComplete arrays are sorted in ascending order
   * by startTime.
   *
   * @param pushInfos Array for one push def
   */
  private update(pushInfos: step189_2020.IPushInfo[]): void {
    if (!pushInfos) { return; }
    pushInfos.reverse().forEach(pushInfo => {
      if (!pushInfo) { return; }
      const states = pushInfo.stateInfo;
      if (!states) { return; }
      const pushID = pushInfo.pushHandle;
      if (!pushID) { return; }
      const endState = states[states.length - 1].state;
      if (!endState) { return; }
      const pushStartTime = states[0].startTimeNsec;
      if (!pushStartTime) { return; }
      const pushEndTime = states[states.length - 1].startTimeNsec;
      if (!pushEndTime) { return; }

      // Filter pushes with only one state (0 duration) and endState which
      // should not be considered.
      if (states.length <= 1) { return; }
      if (endState !== 14 && endState !== 17 && endState !== 18 && endState !== 19) {
        const startTime = formatDate((+pushStartTime / BarChartComponent.NANO_TO_MILLI),
          BarChartComponent.DATE_FORMAT, BarChartComponent.DATE_LOCALE);
        const durationHours = (+pushEndTime - +pushStartTime) /
          BarChartComponent.NANO_TO_SECS / BarChartComponent.SECS_TO_HRS;
        const thePush: Item = {
          pushID,
          state: endState,
          startTime,
          durationHours
        };
        this.totalDuration.push(durationHours);
        this.dataAll.push(thePush);

        if (endState === 5) {
          this.dataComplete.push(thePush);
          this.completeDuration.push(durationHours);
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
   *  <g>
   *    // Top bar chart (focus).
   *    <g>
   *      // Top x-axis (xAxisFocus).
   *    </g>
   *    <g>
   *      // Top y-axis (yAxis).
   *    </g>
   *    <text>
   *      // Top y-axis title.
   *    </text>
   *  </g>
   *  <g>
   *    // Bottom bar chart (brush).
   *    <g>
   *      // Bottom x-axis (xAxisBrush).
   *    </g>
   *    <g>
   *      // Brush selector (brushSelector, inplemented in
   *      // updateChart function).
   *    </g>
   *  </g>
   * <svg>
   */
  private initialChart(): void {
    const element = this.barChartContainer.nativeElement;
    const elementWidth = element.clientWidth;
    const elementHeight = element.clientHeight;
    const marginFocus = { top: 60, right: 90, bottom: 150, left: 70 };
    const marginBrush = { top: 370, right: 90, bottom: 20, left: 70 };

    this.heightFocus = elementHeight;
    this.heightBrush = 30;
    this.width = elementWidth;

    this.svg = (d3
      .select(element)
      .append('svg') as d3SVG)
      .attr('width', elementWidth)
      .attr('height', elementHeight);

    this.focus = this.svg
      .append('g')
      .attr('transform', 'translate(0, 0)');

    // The brush here is an interactive element that allows dragging to display the
    // focus bar chart.
    this.brush = this.svg
      .append('g')
      .attr('transform', `translate(0, ${marginBrush.top})`);

    this.xScaleFocus = d3
      .scaleBand()
      .rangeRound([marginFocus.left, elementWidth - marginFocus.right])
      .padding(0.1);
    this.yScaleFocus = d3
      .scaleLinear().range([elementHeight - marginFocus.bottom, marginFocus.top]);
    this.xAxisFocus = this.focus
      .append('g')
      .attr('class', 'axis axis--x')
      .attr('transform', `translate(0, ${elementHeight - marginFocus.bottom})`);
    this.yAxis = this.focus
      .append('g')
      .attr('transform', `translate(${marginFocus.left}, 0)`)
      .style('color', BarChartComponent.COLOR_LIGHT_GRAY);

    this.focus.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', `translate(${elementWidth / 2}, ${marginFocus.top / 2})`)
      .style('font-size', '16px sans-serif')
      .text('Bar chart of push durations');
    this.focus.append('text')
      .attr('text-anchor', 'middle')
      .attr('transform', 'translate(' + (marginFocus.left / 2) + ',' +
        ((elementHeight - marginFocus.bottom + marginFocus.top) / 2) + ')rotate(-90)')
      .attr('fill', BarChartComponent.COLOR_LIGHT_GRAY)
      .text('Push durations (hours)')
      .style('font', '12px sans-serif');

    this.xScaleBrush = d3
      .scaleBand()
      .rangeRound([marginBrush.left, elementWidth - marginBrush.right])
      .padding(0.1);
    this.yScaleBrush = d3
      .scaleLinear().range([this.heightBrush, 0]);
    this.xAxisBrush = this.brush
      .append('g')
      .attr('transform', `translate(0, ${this.heightBrush})`);
  }

  /**
   * This function updates the focus bar chart and the brush bar chart based on
   * the data of the dropdown selection. The function display the most recent 30
   * pushes by default. It also implements an interactive brush to display a selected
   * area of the bar chart. If the selected value is 'all', the function updates both
   * charts with all pushes; if the selected value is 'completed', it udpates the charts with
   * just the completed pushes.
   */
  public updateChart(): void {
    // Clear all bars from the previous selection.
    d3.selectAll('rect').remove();

    const valueSelected = (document.getElementById('selections') as HTMLSelectElement).value;
    const dataSelected = (valueSelected === BarChartComponent.ALL_PUSHES_OPTION) ? this.dataAll : this.dataComplete;
    if (!dataSelected) { return; }

    const maxDuration = d3.max(dataSelected, (d: Item) => d.durationHours);
    if (!maxDuration) { return; }

    // Update xScaleBrush, yScaleBrush and xAxisBrush based on the
    // selected data for the brush chart.
    this.xScaleBrush.domain(dataSelected.map((d: Item) => d.startTime));
    this.yScaleBrush.domain([0, maxDuration]);
    if (!this.xAxisBrush) { return; }
    this.xAxisBrush.transition().duration(0)
      .call(d3.axisBottom(this.xScaleBrush).tickSize(0)) // Remove the ticks.
      .selectAll('text')
      .attr('opacity', 0); // Hide the x axis labels of the brush chart.

    // Remove the horizontal line of brush x axis to prevent overlaying the
    // brush selector.
    this.xAxisBrush.select('.domain').remove();

    // Initialize the brush bar chart.
    if (!this.brush) { return; }
    const brushBars = this.brush.selectAll('rect')
      .data(dataSelected)
      .enter()
      .append('rect')
      .attr('x', (d: Item) => this.xScaleBrush(d.startTime))
      .attr('width', this.xScaleBrush.bandwidth())
      .attr('y', (d: Item) => this.yScaleBrush(d.durationHours))
      .attr('height', (d: Item) => this.heightBrush - this.yScaleBrush(d.durationHours))
      .attr('style', (d: Item) => `fill: ${BarChartComponent.STATE_TO_COLOR[d.state]}`)
      .attr('fill-opacity', 1)
      .attr('stroke', (d: Item) => { // Outline the white bars.
          if (BarChartComponent.STATE_TO_COLOR[d.state] === BarChartComponent.COLOR_WHITE) {
            return BarChartComponent.COLOR_DARK_GRAY;
          }
          return BarChartComponent.STATE_TO_COLOR[d.state];
        });

    // Apply transition to all elements.
    brushBars.selectAll('#rect')
      .transition()
      .duration(500);

    // This local function changes the focus of the top bar chart based
    // on the input.
    const changeFocus = (inputData: Item[]) => {
      if (!inputData) { return; }

      // Remove all bars from previous brushing.
      if (!this.focus) { return; }
      this.focus.selectAll('rect').remove();

      const newBars = this.focus.selectAll('rect')
        .data(inputData);
      // TODO: Call function that creates a boxplot.
      const maxFocusDuration = d3.max(inputData, (d: Item) => d.durationHours);
      if (!maxFocusDuration) { return; }

      // Upate the xScaleFocus, yScaleFocus, xAxisFocus and yAxisFocus
      // based on the selected data for the focus chart.
      this.xScaleFocus.domain(inputData.map((d: Item) => d.startTime));
      this.yScaleFocus.domain([0, maxFocusDuration]);
      if (!this.yAxis) { return; }
      this.yAxis.transition().duration(0).call(d3.axisLeft(this.yScaleFocus));
      if (!this.xAxisFocus) { return; }
      this.xAxisFocus.transition().duration(0)
        .call(d3.axisBottom(this.xScaleFocus).tickSizeOuter(0))
        .selectAll('text')
        .style('text-anchor', 'end')
        .attr('dx', '-10px')
        .attr('dy', '-5px')
        .attr('transform', 'rotate(-90)')
        .style('fill', BarChartComponent.COLOR_LIGHT_GRAY);

      // Remove the horizontal line of y axis to follow the convention.
      this.yAxis.select('.domain').remove();

      newBars
        .attr('class', '.newBars')
        .enter()
        .append('rect')
          .attr('x', (d: Item) => this.xScaleFocus(d.startTime))
          .attr('width', this.xScaleFocus.bandwidth())
          .attr('y', (d: Item) => this.yScaleFocus(d.durationHours))
          .attr('height', (d: Item) =>
            this.yScaleFocus(0) - this.yScaleFocus(d.durationHours))
          .attr('style', (d: Item) =>
            `fill: ${BarChartComponent.STATE_TO_COLOR[d.state]}`)
          .attr('fill-opacity', 1)
          .attr('stroke', (d: Item) => { // Outline the white bars.
              if (BarChartComponent.STATE_TO_COLOR[d.state] === BarChartComponent.COLOR_WHITE) {
                return BarChartComponent.COLOR_DARK_GRAY;
              }
              return BarChartComponent.STATE_TO_COLOR[d.state];
            });
        // TODO: Call mouseover and mouseleave functions here.

      // Add transparent bars for hover convience.
      newBars
        .attr('class', '.transBars')
        .enter()
        .append('rect') // Add a transparent rect for each element.
          .attr('x', (d: Item) => this.xScaleFocus(d.startTime))
          .attr('width', this.xScaleFocus.bandwidth())
          .attr('y', (d: Item) => this.yScaleFocus(maxFocusDuration))
          .attr('height', (d: Item) =>
            this.yScaleFocus(d.durationHours) - this.yScaleFocus(maxFocusDuration))
          .attr('fill', BarChartComponent.COLOR_WHITE_TRANS);
        // TODO: Call mouseover and mouseleave functions here.

      // Apply transition to all elements.
      newBars.selectAll('rect')
        .transition()
        .duration(500);
    };

    // Update the focus chart given the selected data. If the selected data
    // contains more than 30 Items, only show the most recent 30 Items by default.
    changeFocus(
      (dataSelected.length > BarChartComponent.DEFAULT_NUM_BARS) ?
      dataSelected.slice(dataSelected.length - BarChartComponent.DEFAULT_NUM_BARS, dataSelected.length) : dataSelected);

    // Local variable used by the brushDown function to prevent the use
    // of `this` in the callback function.
    const localBrush = this.xScaleBrush;

    // This callback function updates the focus bar chart selection to the brusing
    // area. It is declared as a local function to prevent the use of `this`. The
    // listener of D3 brush function defaults `this` context as the current DOM element.
    // We have to declare it locally, in order to use xScaleBrush and dataSelected.
    const brushDown = () => {
      // Return if no input is given or the selection is emtpy.
      if (!d3.event.sourceEvent || !d3.event.selection) { return; }

      const newInput: string[] = [];
      let brushArea = d3.event.selection;
      // Set the area of selection to the entire xScaleFocus if selection
      // is invalid.
      if (brushArea[0] === brushArea[1]) { brushArea = localBrush.range(); }

      localBrush.domain().forEach((d: string) => {
        const position = localBrush(d) + localBrush.bandwidth() / 2;
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

    // Initial position of the brush selector according to the input of the focus bar.
    const firstItem =  (dataSelected.length > BarChartComponent.DEFAULT_NUM_BARS) ?
      dataSelected[dataSelected.length - BarChartComponent.DEFAULT_NUM_BARS] : dataSelected[0];
    const firstItemPosition = this.xScaleBrush(firstItem.startTime);
    const lastItemPosition = this.xScaleBrush(dataSelected[dataSelected.length - 1].startTime) +
      this.xScaleBrush.bandwidth();

    const brushSelector = d3
      .brushX()
      .extent([[70, 0], [this.width - 90, this.heightBrush]]) // Limit the brush.
      .on('brush', brushDown); // Update the focus bar chart based on the brush selection.

    this.brush.append('g')
      .attr('class', 'brush')
      .call(brushSelector)
      .call(brushSelector.move, [firstItemPosition, lastItemPosition]);
  }
}
