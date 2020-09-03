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
import * as d3 from 'd3';

import {step189_2020} from '../../../proto/step189_2020';
import {DurationItem, findDuration, findDurationUnit, UNIT_CONVERSION} from '../duration-utils';

import {Item} from './bar-chart.component';

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
export type d3SVG = d3.Selection<SVGSVGElement, Item[], null, undefined>;
export type d3G = d3.Selection<SVGGElement, Item[], null, undefined>;
export type d3Circle =
    d3.Selection<SVGCircleElement, Item, SVGGElement, Item[]>;
export type d3HTML = d3.Selection<HTMLDivElement, Item, null, undefined>;
export type d3Rect = d3.Selection<SVGRectElement, Item, SVGGElement, Item[]>;
export type d3ScaleLinear = d3.ScaleLinear<number, number>;
export type d3ScaleBand = d3.ScaleBand<string>;

/**
 * Constants.
 */
const NANO_TO_MILLI: number = 10 ** 6;
const DATE_FORMAT = 'yyyy-MM-dd HH:mm:ss';
const DATE_LOCALE = 'en-US';

export const DEFAULT_NUM_BARS = 30;
export const DEFAULT_MAX_BARS = 100;
export const ALL_PUSHES_OPTION = 'all';
export const COLOR_LIGHT_GRAY = '#787878';
export const COLOR_DARK_GRAY = '#373C38';
export const COLOR_WHITE_TRANS = '#ffffff00';

/**
 * This function populates pushID, state, startTime and duration of
 * given pushes. It generates dataAll for the bar charts.
 *
 * @param pushInfos: Array for one push def
 */
export function populateData(pushInfos: step189_2020.IPushInfo[]): Item[] {
  const pushes: Item[] = [];
  const divisor = UNIT_CONVERSION[findDurationUnit(pushInfos)];
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

    // Filter pushes with only one state (0 duration) and endState which
    // should not be considered.
    if (states.length <= 1) {
      return;
    }
    const startTime =
        formatDate((+pushStartTime / NANO_TO_MILLI), DATE_FORMAT, DATE_LOCALE);
    const pushStartEnd: DurationItem|undefined = findDuration(pushInfo);
    if (pushStartEnd) {
      pushes.push({
        pushID,
        state: endState,
        startTime,
        duration: (+pushStartEnd.endNsec - +pushStartEnd.startNsec) / divisor
      } as Item);
    }
  });
  return pushes;
}

/**
 * This function generates data for ticks and text labels in the boxplot.
 * If the values are clustered together, we only return the median. If maximum
 * and minimum are pretty separated, we return the maximum, minimum and median.
 * Otherwise, we return all nums that it given.
 *
 * @param labels: Array of minimum, first quantile, median, third quantile and
 * maximum
 * @param yScale: y scale of the box plot
 */
export function generateLabels(
    labels: number[], yScale: d3ScaleLinear): number[] {
  const pixelDiff = 8;
  if (yScale(labels[0]) - yScale(labels[4]) < pixelDiff * 2) {
    return [labels[2]];
  }
  for (let i = 0; i < 4; i++) {
    if (yScale(labels[i]) - yScale(labels[i + 1]) < pixelDiff) {
      return [labels[0], labels[2], labels[4]];
    }
  }
  return labels;
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
export function addTag(
    d: Item, tag: d3G, bandwidth: number, barX: number, barY: number): void {
  if (!barX) {
    return;
  }

  // Add time duration, in one decimal.
  tag.append('text')
      .attr('dx', (barX + bandwidth / 2) + 'px')
      .attr('dy', (barY - 4) + 'px')
      .style('color', COLOR_DARK_GRAY)
      .style('font', '11px sans-serif')
      .style('line-height', '1.3')
      .style('text-anchor', 'middle')
      .text(d.duration.toFixed(2));

  // Bold the start time on x axis.
  tag.append('text')
      .attr('dx', (barX + bandwidth / 2 + 3.5) + 'px')
      .attr('dy', 280 + 'px')
      .attr(
          'transform',
          'rotate(-90 ' + (barX + bandwidth / 2 + 3.5) + ',' + 280 + ')')
      // .attr('style', 'font-weight: bold;')
      .style('stroke', COLOR_DARK_GRAY)
      .style('stroke-width', '0.35px')
      .style('fill', COLOR_DARK_GRAY)
      .style('font', '10px sans-serif')
      .style('line-height', '1.3')
      .style('text-anchor', 'end')
      .text(d.startTime);
}
