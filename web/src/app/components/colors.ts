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

export const DARK_GRAY = '#a9a9a9';
export const MED_GRAY = '#d3d3d3';
export const LIGHT_GRAY = '#eee';

const BLUE = '#2196f3';
const GREEN = '#34a853';
const ORANGE = '#f9ab00';
const RED = '#d50000';

// Mapping from states to corresponding colors.
export const STATE_TO_COLOR: {[index: number]: string} = {
  1: LIGHT_GRAY,
  3: BLUE,
  4: RED,
  5: GREEN,
  6: RED,
  7: BLUE,
  8: BLUE,
  9: RED,
  10: BLUE,
  11: BLUE,
  12: RED,
  13: BLUE,
  14: LIGHT_GRAY,
  15: BLUE,
  16: RED,
  17: LIGHT_GRAY,
  18: RED,
  19: LIGHT_GRAY,
  20: LIGHT_GRAY,
  21: ORANGE,
  24: ORANGE,
  25: ORANGE,
  29: RED
};