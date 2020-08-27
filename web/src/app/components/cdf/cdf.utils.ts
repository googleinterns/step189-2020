import * as d3 from 'd3';

import { step189_2020 } from '../../../proto/step189_2020';

export interface Item {
  duration: number; // Minutes between completed stage and first non-empty stage
  probability: number; // Rank of the duration divided by number of points
}

/**
 * Defines the type of the d3 SVG. The d3.Selection has a generic type
 * Selection<GElement, Datum, PElement, PDatum>. We want our svg element to have
 * the interface SVGSVGElement. Datum, PElement, and PDatum are unused and thus,
 * assigned to undefined or null.
 * The d3G type is similar to the svg element but SVGGElement refers to a g
 * element within a svg.
 */
export type d3SVG = d3.Selection<SVGSVGElement, undefined, null, undefined>;
type d3G = d3.Selection<SVGGElement, undefined, null, undefined>;

const NANO_TO_MINUTES = (10 ** 9) * 60;
export const COMPLETED_BLUE = '#00bfa5';
const COMPLETED_STATE_TAG = 5;
export const STROKE_COLOR = '#167364';

/**
 * Calculates the duration between the completed stage and the first non-empty
 * stage. Assigns the probability as the rank of the duration value over the
 * total number of points. The duration and probability are defined in an
 * interface and all points stored as an array of CdfData interfaces.
 *
 * @param pushInfos Array of pushes for a single push def
 * @return Array of Items sorted by increasing duration
 */
export function populateData(pushInfos: step189_2020.IPushInfo[]): Item[] {
  const durations: number[] = [];
  pushInfos.forEach(pushInfo => {
    if (!pushInfo) { return; }
    const states = pushInfo.stateInfo;
    if (!states) { return; }
    const pushEndTime = states[states.length - 1].startTimeNsec;
    if (!pushEndTime) { return; }
    const finalState = states[states.length - 1].state;
    if (!finalState) { return; }

    if (finalState === COMPLETED_STATE_TAG) {
      // Find the start time of the first non-empty stage.
      let firstStateStart: number | Long = -1;
      for (const state of states) {
        if (state.stage && state.startTimeNsec) {
          firstStateStart = state.startTimeNsec;
          break;
        }
      }
      if (firstStateStart !== -1) {
        const duration = (+pushEndTime - +firstStateStart) / NANO_TO_MINUTES;
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
 * Finds the probability of a duration taking less time than the given duration
 * parameter. Because the curve is a step function and the data is sorted by
 * increasing duration, the resulting probability is the probability of the
 * Item with a duration directly less than the given duration parameter.
 *
 * @param data Array of Items sorted by increasing duration
 * @param duration A duration value between the min and max of all durations
 * @return A probability value between 0 and 1 (exclusive)
 */
export function getProbabilityForDuration(data: Item[], duration: number): number {
  const allDurations = data.map(d => d.duration);
  const index = d3.bisectLeft(allDurations, duration);
  return data[index - 1].probability;
}

/**
 * Finds the interpolated duration value for a given probability. It uses the
 * ratio of the differences in duration over the differences in probability of
 * the Items with probability directly less and than greater than probability
 * parameter.
 *
 * @param data Array of Items sorted by increasing duration
 * @param probability A probability value between 0 and 1 (exclusive)
 * @return The interpolated duration value for the probability parameter
 */
function getDurationforProbability(data: Item[], probability: number): number {
  const allProbabilities = data.map(d => d.probability);
  const left = data[d3.bisectLeft(allProbabilities, probability) - 1];
  const right = data[d3.bisectRight(allProbabilities, probability)];
  return ((probability - left.probability) * (right.duration - left.duration) /
    (right.probability - left.probability)) + left.duration;
}

/**
 * Generates an array of items that maps an array of probabilities to its
 * interpolated duration. If the durations are too close together, then
 * recursively spread out the smallest and largest probability line until there
 * is at least 15 pixels of space between them. If this never happens, then the
 * smallest and largest probabilities are deleted and only the median is
 * returned.
 *
 * @param data Array of Items sorted by increasing duration
 * @param percentileLines Array of numbers representing the probability
 * @param xScale d3 function that applies a scaling factor on raw x values to
 * correctly place them on the graph
 * @return Array of Items with the duration as the interpolated duration and the
 * probability as the given probability from probabilityLines
 */
export function generateQuantiles(data: Item[], percentileLines: number[], xScale: d3.ScaleLinear<number, number>): Item[] {
  if (percentileLines[0] < 0.01 || percentileLines[2] > .99) {
    return [percentileLines[1]].map(d => ({
      duration: getDurationforProbability(data, d),
      probability: d} as Item));
  }
  let quantiles = percentileLines.map(d => ({
    duration: getDurationforProbability(data, d),
    probability: d} as Item));

  const pixelDifference = 15;
  const differences = [xScale(quantiles[1].duration - quantiles[0].duration), xScale(quantiles[2].duration - quantiles[1].duration)];
  if (differences[0] < pixelDifference || differences[1] < pixelDifference) {
    quantiles = generateQuantiles(data, [percentileLines[0] - .01, percentileLines[1], percentileLines[2] + .01], xScale);
  }
  return quantiles;
}

/**
 * Produces an array of numbers that represent the amount of height needed to
 * place a dot at that location. Looping through the duration values in sorted
 * order, if placing a dot overlaps with previously placed dots, then increase
 * the y position to dodge that dot. This loops until the (x, y) position of the
 * does not overlap with any other dots.
 *
 * @param radius radius of dots
 * @param xScale d3 function that applies a scaling factor on raw x values to
 * correctly place them on the graph
 * @param xVals array of durations in sorted order
 * @return Array of numbers representing the y position of the dot at duration
 * value maintaining the same indices as the xVals
 */
export function generateYPosition(radius: number, xScale: d3.ScaleLinear<number, number>, xVals: number[]): number[] {
  const radius2 = radius ** 2;
  const coordinates = [];
  for (const val of xVals) {
    const x = xScale(val);
    let y = 0;
    for (const {x: xi, y: yi} of coordinates) {
      if (!xi) { continue; }
      const x2 = (xi - x) ** 2;
      const y2 = (yi - y) ** 2;
      if (radius2 > x2 + y2) {
        y = yi + Math.sqrt(radius2 - x2) + 1e-6;
        continue;
      }
    }
    coordinates.push({x, y});
  }
  return coordinates.map(d => d.y);
}

/**
 * Appends a vertical line on the chart at the duration of the current push.
 * If the current push does not end with a completed stage, then no line is
 * appended to the chart.
 *
 * @param currentPush push information for the push that the page is on
 * @param currentPushLine d3 SVG G element
 * @param xScale d3 function that applies a scaling factor on raw x values to
 * correctly place them on the graph
 * @param height height of the chart element
 */
export function addCurrentPushLine(
                  currentPush: step189_2020.IPushInfo,
                  currentPushLine: d3G,
                  data: Item[],
                  xScale: d3.ScaleLinear<number, number>,
                  height: number,
                  yScale: d3.ScaleLinear<number, number>): void {
  const states = currentPush.stateInfo;
  if (!states) { return; }
  const pushEndTime = states[states.length - 1].startTimeNsec;
  if (!pushEndTime) { return; }
  const finalState = states[states.length - 1].state;
  if (!finalState) { return; }

  if (finalState !== COMPLETED_STATE_TAG) { return; }

  // Find the start time of the first non-empty stage.
  let firstStateStart: number | Long = -1;
  for (const state of states) {
    if (state.stage && state.startTimeNsec) {
      firstStateStart = state.startTimeNsec;
      break;
    }
  }
  if (firstStateStart === -1) { return; }

  const duration = (+pushEndTime - +firstStateStart) / NANO_TO_MINUTES;

  const markerSize = 2.5;
  const markerPath = [[0, 0], [0, markerSize], [markerSize, markerSize / 2]];
  currentPushLine
    .append('defs')
    .append('marker')
    .attr('id', 'arrow')
    .attr('refX', 3)
    .attr('refY', markerSize / 2)
    .attr('markerWidth', markerSize)
    .attr('markerHeight', markerSize)
    .attr('orient', 'auto')
    .datum(markerPath)
    .append('path')
    .attr('d', d3.line<number[]>()
      .x(d => d[0])
      .y(d => d[1]));

  const endOfLine = yScale(getProbabilityForDuration(data, duration));

  currentPushLine
    .append('line')
    .attr('id', 'current-push-line')
    .attr('stroke', 'white')
    .attr('stroke-dasharray', '10 5')
    .attr('stroke-width', 3)
    .attr('x1', xScale(duration))
    .attr('y1', endOfLine)
    .attr('x2', xScale(duration))
    .attr('y2', height)
    .attr('marker-start', 'url(#arrow)');

  currentPushLine
    .append('text')
    .attr('text-anchor', 'middle')
    .attr('x', xScale(duration))
    .attr('y', endOfLine - 13)
    .attr('id', 'current-line-text')
    .attr('font-size', '12px')
    .text('Current Push');
}
