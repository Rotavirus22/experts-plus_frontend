import { describe, expect, it } from 'vitest';
import {
  detectHeaderRow,
  guessFieldType,
  parseImportDate,
  parseTarget,
  suggestMapping,
  suggestStatus,
} from './import.js';

describe('suggestMapping', () => {
  // Headers as they appear in a real master list (trailing spaces included).
  const headers = [
    'SL NO', 'MOL ID ', 'STATUS ', 'EMPLOYEE ID NO ', 'NAME', 'POSITION', 'DIVISION', 'NATIONALITY', 'PASSPORT NUMBER',
    'DATE OF JOINING', 'DOB', 'CONTACT NUMBER ', 'BASIC SALARY ', 'EMIRATES ID NO', 'EID EXPIRY', 'IBAN NO  ', 'REMARKS',
  ];

  it('matches built-in fields by synonym and skips the rest', () => {
    const m = suggestMapping(headers, []);
    expect(Object.fromEntries(headers.map((h, i) => [h.trim(), m[i]]))).toEqual({
      'SL NO': 'skip',
      'MOL ID': 'skip',
      STATUS: 'status',
      'EMPLOYEE ID NO': 'employee_code',
      NAME: 'full_name',
      POSITION: 'designation',
      DIVISION: 'department',
      NATIONALITY: 'nationality',
      'PASSPORT NUMBER': 'passport_number',
      'DATE OF JOINING': 'join_date',
      DOB: 'skip',
      'CONTACT NUMBER': 'uae_phone',
      'BASIC SALARY': 'skip',
      'EMIRATES ID NO': 'emirates_id_number',
      'EID EXPIRY': 'skip',
      'IBAN NO': 'skip',
      REMARKS: 'remarks',
    });
  });

  it('matches visible custom fields by label, never hidden ones', () => {
    const m = suggestMapping(['Emp No', 'MOL ID', 'DOB'], [
      { key: 'mol_id', label: 'MOL Id', isHidden: false },
      { key: 'dob', label: 'DOB', isHidden: true },
    ]);
    expect(m).toEqual(['employee_code', 'custom:mol_id', 'skip']);
  });

  it('uses each target once', () => {
    expect(suggestMapping(['Name', 'Employee Name'], [])).toEqual(['full_name', 'skip']);
  });
});

describe('parseTarget', () => {
  it('parses every kind and rejects unknown ones', () => {
    expect(parseTarget('skip')).toEqual({ kind: 'skip' });
    expect(parseTarget('join_date')).toEqual({ kind: 'field', key: 'join_date' });
    expect(parseTarget('custom:mol_id')).toEqual({ kind: 'custom', key: 'mol_id' });
    expect(parseTarget('new:3')).toEqual({ kind: 'new', index: 3 });
    expect(parseTarget('camp')).toBeNull();
    expect(parseTarget('custom:')).toBeNull();
  });
});

describe('suggestStatus', () => {
  it.each([
    ['ACTIVE', 'ACTIVE'],
    ['', 'ACTIVE'],
    ['RESIGNATION', 'RESIGNED'],
    ['Resigned', 'RESIGNED'],
    ['TERMINATION', 'TERMINATED'],
    ['ABSCONDING', 'ABSCONDED'],
    ['ANNUAL LEAVE', 'ON_LEAVE'],
    ['EMERGENCY  LEAVE', 'ON_LEAVE'],
    ['Visa Cancelled', 'VISA_CANCELLED'],
    ['TRANSFERRED', 'TRANSFERRED_OUT'],
    ['PENDING', null],
  ])('%s -> %s', (raw, expected) => expect(suggestStatus(raw)).toBe(expected));
});

describe('parseImportDate', () => {
  it.each([
    ['2019-08-06', '2019-08-06'],
    ['2019-08-06T00:00:00.000Z', '2019-08-06'],
    ['06-Aug-19', '2019-08-06'],
    ['6 August 2019', '2019-08-06'],
    ['06/08/2019', '2019-08-06'],
    ['6.8.19', '2019-08-06'],
    ['10-Sep-85', '1985-09-10'],
    ['31/02/2020', null],
    ['2019-13-01', null],
    ['EPRS-3022', null],
    ['', null],
  ])('%s -> %s', (raw, expected) => expect(parseImportDate(raw)).toBe(expected));
});

describe('guessFieldType', () => {
  it('guesses from the values', () => {
    expect(guessFieldType(['2027-09-10', '', '2027-07-27'])).toBe('DATE');
    expect(guessFieldType(['3500', '1700', '1,430'])).toBe('NUMBER');
    expect(guessFieldType(['10004069796903', '10025049197571'])).toBe('TEXT'); // MOL ID: an identifier
    expect(guessFieldType(['971553097973', '+971 50 123 4567'])).toBe('PHONE');
    expect(guessFieldType(['a@b.com'])).toBe('EMAIL');
    expect(guessFieldType(['Yes', 'no'])).toBe('BOOLEAN');
    expect(guessFieldType(['HSBC', 'C3PAY'])).toBe('TEXT');
    expect(guessFieldType([])).toBe('TEXT');
  });
});

describe('detectHeaderRow', () => {
  it('skips a date row above the headers', () => {
    const rows = [
      ['2026-10-05', '2026-10-05', '', ''],
      ['SL NO', 'STATUS', 'EMPLOYEE ID NO', 'NAME'],
      ['1', 'ACTIVE', 'EPRS-3022', 'A B'],
    ];
    expect(detectHeaderRow(rows)).toBe(2);
  });
  it('defaults to the first row', () => {
    expect(detectHeaderRow([['Emp No', 'Name'], ['E1', 'A']])).toBe(1);
    expect(detectHeaderRow([])).toBe(1);
  });
});
