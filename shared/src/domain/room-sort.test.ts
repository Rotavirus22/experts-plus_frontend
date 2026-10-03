import { describe, expect, it } from 'vitest';
import { compareRoomNumbers, sortBeds, sortRooms } from './room-sort.js';

const numbers = (list: string[]) => sortRooms(list.map((number) => ({ number }))).map((r) => r.number);

describe('natural room sort', () => {
  it('puts "2" before "10"', () => {
    expect(numbers(['10', '2', '1'])).toEqual(['1', '2', '10']);
    expect(compareRoomNumbers('2', '10')).toBeLessThan(0);
  });

  it('puts "1A" before "1B"', () => {
    expect(numbers(['1B', '1A'])).toEqual(['1A', '1B']);
  });

  it('sorts a realistic mixed list', () => {
    expect(numbers(['10', '2', '1B', '1A', 'G-12', '101', '2B', 'G-2', '301 Sup.', '301'])).toEqual([
      '1A',
      '1B',
      '2',
      '2B',
      '10',
      '101',
      '301',
      '301 Sup.',
      'G-2',
      'G-12',
    ]);
  });

  it('is case-insensitive', () => {
    expect(numbers(['g-10', 'G-2'])).toEqual(['G-2', 'g-10']);
  });

  it('is deterministic for values the collator considers equal', () => {
    const a = numbers(['g-2', 'G-2']);
    const b = numbers(['G-2', 'g-2']);
    expect(a).toEqual(b);
  });

  it('ignores surrounding whitespace', () => {
    expect(compareRoomNumbers(' 2', '10 ')).toBeLessThan(0);
  });

  it('does not mutate the input', () => {
    const input = [{ number: '10' }, { number: '2' }];
    sortRooms(input);
    expect(input.map((r) => r.number)).toEqual(['10', '2']);
  });
});

describe('bed sort', () => {
  it('orders by position, then label naturally', () => {
    const beds = sortBeds([
      { position: 2, label: 'Bed 10' },
      { position: 1, label: 'Bed 3' },
      { position: 2, label: 'Bed 2' },
    ]);
    expect(beds.map((b) => b.label)).toEqual(['Bed 3', 'Bed 2', 'Bed 10']);
  });
});
