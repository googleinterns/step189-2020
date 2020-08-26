import * as d3 from 'd3';

import { step189_2020 } from '../../../proto/step189_2020';

interface Item {
  duration: number; // Minutes between completed stage and first non-empty stage
  probability: number; // Rank of the duration divided by number of points
}

type d3G = d3.Selection<SVGGElement, undefined, null, undefined>;

export class CDFHelper {
  static readonly NANO_TO_MINUTES: number = (10 ** 9) * 60;
  static readonly COMPLETED_BLUE: string = '#00bfa5';
  static readonly COMPLETED_STATE_TAG: number = 5;

  /**
   * Calculates the duration between the completed stage and the first non-empty
   * stage. Assigns the probability as the rank of the duration value over the
   * total number of points. The duration and probability are defined in an
   * interface and all points stored as an array of CdfData interfaces.
   *
   * @param pushInfos Array of pushes for a single push def
   * @return Array of Items sorted by increasing duration
   */
  static populateData(pushInfos: step189_2020.IPushInfo[]): Item[] {
    const durations: number[] = [];
    pushInfos.forEach(pushInfo => {
      if (!pushInfo) { return; }
      const states = pushInfo.stateInfo;
      if (!states) { return; }
      const pushEndTime = states[states.length - 1].startTimeNsec;
      if (!pushEndTime) { return; }
      const finalState = states[states.length - 1].state;
      if (!finalState) { return; }

      if (finalState === this.COMPLETED_STATE_TAG) {
        // Find the start time of the first non-empty stage.
        let firstStateStart: number | Long = -1;
        for (const state of states) {
          if (state.stage && state.startTimeNsec) {
            firstStateStart = state.startTimeNsec;
            break;
          }
        }
        if (firstStateStart !== -1) {
          const duration = (+pushEndTime - +firstStateStart) / this.NANO_TO_MINUTES;
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

  static getXforPercentage(data: Item[], probability: number): number {
    const yVals = data.map(d => d.probability);
    const left = data[d3.bisectLeft(yVals, probability) - 1];
    const right = data[d3.bisectRight(yVals, probability)];
    return ((probability - left.probability) * (right.duration - left.duration) /
      (right.probability - left.probability)) + left.duration;
  }

  static generateQuantiles(data: Item[], percentileLines: number[], xScale: d3.ScaleLinear<number, number>): Item[] {
    if (percentileLines[0] < 0.01 || percentileLines[2] > .99) {
      return [percentileLines[1]].map(d => ({
        duration: this.getXforPercentage(data, d),
        probability: d} as Item));
    }
    let quantiles = percentileLines.map(d => ({
      duration: this.getXforPercentage(data, d),
      probability: d} as Item));

    const differences = [xScale(quantiles[1].duration - quantiles[0].duration), xScale(quantiles[2].duration - quantiles[1].duration)];
    if (differences[0] < 15 || differences[1] < 15) {
      quantiles = this.generateQuantiles(data, [percentileLines[0] - .01, percentileLines[1], percentileLines[2] + .01], xScale);
    }
    return quantiles;
  }

  static generateYPosition(radius: number, xScale: d3.ScaleLinear<number, number>, xVals: number[]): number[] {
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

  static addCurrentPushLine(
                    currentPush: step189_2020.IPushInfo,
                    currentPushLine: d3G,
                    xScale: d3.ScaleLinear<number, number>,
                    height: number): void {
    const states = currentPush.stateInfo;
    if (!states) { return; }
    const pushEndTime = states[states.length - 1].startTimeNsec;
    if (!pushEndTime) { return; }
    const finalState = states[states.length - 1].state;
    if (!finalState) { return; }

    if (finalState !== this.COMPLETED_STATE_TAG) { return; }

    // Find the start time of the first non-empty stage.
    let firstStateStart: number | Long = -1;
    for (const state of states) {
      if (state.stage && state.startTimeNsec) {
        firstStateStart = state.startTimeNsec;
        break;
      }
    }
    if (firstStateStart === -1) { return; }

    const duration = (+pushEndTime - +firstStateStart) / this.NANO_TO_MINUTES;

    currentPushLine
      .append('line')
      .attr('class', 'current-push-line')
      .attr('stroke', 'black')
      .attr('stroke-dasharray', '10 5 5 5')
      .attr('x1', xScale(duration))
      .attr('y1', height)
      .attr('x2', xScale(duration))
      .attr('y2', 0);

    currentPushLine
      .append('text')
      .attr('text-anchor', 'middle')
      .attr('x', xScale(duration))
      .attr('y', 0)
      .attr('id', 'current-line-text')
      .attr('font-size', '10px')
      .text('Current Push');
  }
}
