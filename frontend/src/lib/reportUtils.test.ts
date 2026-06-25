import { test } from 'node:test';
import assert from 'node:assert';
import { convertYYMMDDToYYYYMMDD, convertYYYYMMDDToYYMMDD, normalizeDateInput } from './reportUtils';

test('convertYYMMDDToYYYYMMDD converts date correctly', (): void => {
  // 正常パターン
  assert.strictEqual(convertYYMMDDToYYYYMMDD('26/06/08'), '2026-06-08');
  assert.strictEqual(convertYYMMDDToYYYYMMDD('00/01/01'), '2000-01-01');
  
  // 1桁の月日の自動パディング
  assert.strictEqual(convertYYMMDDToYYYYMMDD('26/6/8'), '2026-06-08');
  assert.strictEqual(convertYYMMDDToYYYYMMDD('26/06/8'), '2026-06-08');
  assert.strictEqual(convertYYMMDDToYYYYMMDD('26/6/08'), '2026-06-08');

  // 異常パターン
  assert.strictEqual(convertYYMMDDToYYYYMMDD(''), '');
  assert.strictEqual(convertYYMMDDToYYYYMMDD('26/06'), '');
  assert.strictEqual(convertYYMMDDToYYYYMMDD('26/06/08/09'), '');
  assert.strictEqual(convertYYMMDDToYYYYMMDD('abc/def/ghi'), '');
  assert.strictEqual(convertYYMMDDToYYYYMMDD('26/06/ab'), '');
});

test('convertYYYYMMDDToYYMMDD converts date correctly', (): void => {
  // 正常パターン
  assert.strictEqual(convertYYYYMMDDToYYMMDD('2026-06-08'), '26/06/08');
  assert.strictEqual(convertYYYYMMDDToYYMMDD('2000-01-01'), '00/01/01');

  // 異常パターン
  assert.strictEqual(convertYYYYMMDDToYYMMDD(''), '');
  assert.strictEqual(convertYYYYMMDDToYYMMDD('2026-06'), '');
  assert.strictEqual(convertYYYYMMDDToYYMMDD('26-06-08'), ''); // 年が4桁ではない
  assert.strictEqual(convertYYYYMMDDToYYMMDD('2026-6-8'), '');  // 月日が2桁ではない
  assert.strictEqual(convertYYYYMMDDToYYMMDD('2026-06-08-09'), '');
});

test('normalizeDateInput normalizes user date input correctly', (): void => {
  assert.strictEqual(normalizeDateInput('26/5/8'), '26/05/08');
  assert.strictEqual(normalizeDateInput('26/05/08'), '26/05/08');
  assert.strictEqual(normalizeDateInput(''), '');
});
