import { describe, it, expect } from 'vitest';
import {
  createLetterBank,
  spotLetter,
  spotNext,
  litCount,
  resetLetters,
} from '../../src/game/letters.js';

describe('letter spelling', () => {
  it('spots SNOW one letter at a time', () => {
    let bank = createLetterBank('SNOW');
    let r = spotLetter(bank, 'S');
    expect(r.changed).toBe(true);
    expect(r.bank.lit[0]).toBe(true);
    bank = r.bank;
    r = spotLetter(bank, 'S');
    expect(r.changed).toBe(false);
    bank = spotLetter(bank, 'N').bank;
    bank = spotLetter(bank, 'O').bank;
    r = spotLetter(bank, 'W');
    expect(r.completed).toBe(true);
    expect(r.bank.completions).toBe(1);
    expect(r.bank.lit.every((v) => !v)).toBe(true);
  });

  it('spotNext walks BOARD', () => {
    let bank = createLetterBank('BOARD');
    for (let i = 0; i < 4; i++) {
      const r = spotNext(bank);
      bank = r.bank;
      expect(r.completed).toBe(false);
    }
    const r = spotNext(bank);
    expect(r.completed).toBe(true);
    expect(litCount(r.bank)).toBe(0);
  });

  it('resetLetters clears lit', () => {
    let bank = createLetterBank('LODGE');
    bank = spotLetter(bank, 'L').bank;
    bank = resetLetters(bank);
    expect(litCount(bank)).toBe(0);
  });
});
