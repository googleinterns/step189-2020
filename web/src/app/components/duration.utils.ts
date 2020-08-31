import {step189_2020} from '../../proto/step189_2020';

export interface DurationItem {
  startNsec: number|Long;  // nsec time of the first non-empty state
  endNsec: number|Long;    // nsec time of the last state
}

const NANO_TO_DAYS = (10 ** 9) * 60 * 60 * 24;
const NANO_TO_HOURS: number = (10 ** 9) * 60 * 60;
const NANO_TO_MINUTES: number = (10 ** 9) * 60;
const NANO_TO_SECONDS: number = (10 ** 9);

export const UNIT_CONVERSION: {[unit: string]: number} = {
  seconds: NANO_TO_SECONDS,
  minutes: NANO_TO_MINUTES,
  hours: NANO_TO_HOURS,
  days: NANO_TO_DAYS
};

/**
 * Finds the unit of time that best describes the majority of the durations of
 * the pushInfos.
 *
 * @param pushInfos Array of pushes for a single push def
 * @return one of [seconds, minutes, hours, days]
 */
export function findDurationUnit(pushInfos: step189_2020.IPushInfo[]): string {
  const unitCounter: {[unit: string]: number} = {
    seconds: 0,
    minutes: 0,
    hours: 0,
    days: 0
  };

  pushInfos.forEach(pushInfo => {
    if (!pushInfo) {
      return;
    }

    const states = pushInfo.stateInfo;
    if (!states) {
      return;
    }

    const pushEndTime = states[states.length - 1].startTimeNsec;
    if (!pushEndTime) {
      return;
    }

    const finalState = states[states.length - 1].state;
    if (!finalState) {
      return;
    }

    // Find the start time of the first non-empty stage.
    const startEnd: DurationItem|undefined = findDuration(pushInfo);
    if (startEnd) {
      const nsecDuration = (+pushEndTime - +startEnd.startNsec);
      for (const unit of ['days', 'hours', 'minutes', 'seconds']) {
        if ((nsecDuration / UNIT_CONVERSION[unit]) > 1) {
          unitCounter[unit] += 1;
          break;
        }
      }
    }
  });

  let bestUnit = '';
  let max = 0;
  for (const [key, value] of Object.entries(unitCounter)) {
    if (value > max) {
      max = value;
      bestUnit = key;
    }
  }
  return bestUnit;
}

/**
 * Finds the start time of the first non-empty state and the end time of the
 * pushInfo.
 *
 * @param pushInfo A single push
 * @return a DurationItem that has a start of the time of the first non-empty
 *     stage and an end of the time of the last state. If there is no state with
 *     a stage, then return undefined.
 */
export function findDuration(pushInfo: step189_2020.IPushInfo): DurationItem|
    undefined {
  const states = pushInfo.stateInfo;
  if (!states) {
    return;
  }

  let firstStateStart: number|Long = -1;
  for (const state of states) {
    if (state.stage && state.startTimeNsec) {
      firstStateStart = state.startTimeNsec;
      break;
    }
  }

  if (firstStateStart === -1) {
    return;
  }

  const endTime = states[states.length - 1].startTimeNsec;
  if (!endTime) {
    return;
  }

  return {startNsec: firstStateStart, endNsec: endTime} as DurationItem;
}
