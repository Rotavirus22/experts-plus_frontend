import { describe, expect, it } from 'vitest';
import { bedGridColumns, bedTypesFor, nextBedLabels } from './bed-labels.js';

describe('nextBedLabels', () => {
  it('starts at 1 in an empty room', () => {
    expect(nextBedLabels([], 'B', 3)).toEqual(['B1', 'B2', 'B3']);
  });

  it('continues after the highest number, ignoring other labels', () => {
    expect(nextBedLabels(['B1', 'B10', 'b3', 'Window', 'Bed 2'], 'B', 2)).toEqual(['B11', 'B12']);
  });

  it('works with word prefixes and spaces', () => {
    expect(nextBedLabels(['Bed 1', 'Bed 2'], 'Bed ', 1)).toEqual(['Bed 3']);
  });

  it('treats regex characters in the prefix literally', () => {
    expect(nextBedLabels(['B.1', 'BX2'], 'B.', 1)).toEqual(['B.2']);
  });
});

describe('bedTypesFor', () => {
  it('bunk pairs alternate lower/upper with a single at the end when odd', () => {
    expect(bedTypesFor('BUNK_PAIRS', 5)).toEqual(['BUNK_LOWER', 'BUNK_UPPER', 'BUNK_LOWER', 'BUNK_UPPER', 'SINGLE']);
    expect(bedTypesFor('SINGLE', 2)).toEqual(['SINGLE', 'SINGLE']);
    expect(bedTypesFor('UNSPECIFIED', 1)).toEqual([null]);
  });
});

describe('bedGridColumns', () => {
  it('lays beds out in a near-square grid, at most 6 wide', () => {
    expect([0, 1, 2, 4, 6, 8, 12, 20, 40].map(bedGridColumns)).toEqual([1, 1, 2, 3, 3, 4, 5, 6, 6]);
  });
  it('labels new beds "Bed 1", "Bed 2" by default and continues after existing ones', () => {
    expect(nextBedLabels([], 'Bed ', 3)).toEqual(['Bed 1', 'Bed 2', 'Bed 3']);
    expect(nextBedLabels(['Bed 1', 'Bed 2'], 'Bed ', 2)).toEqual(['Bed 3', 'Bed 4']);
  });
});
