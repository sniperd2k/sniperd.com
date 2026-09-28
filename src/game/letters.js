/**
 * Letter-spelling state machines: SNOW, BOARD, LODGE.
 */

export function createLetterBank(word) {
  const letters = String(word).toUpperCase().split('');
  return {
    word: letters.join(''),
    letters,
    lit: letters.map(() => false),
    completions: 0,
  };
}

export function spotLetter(bank, letter) {
  const L = String(letter).toUpperCase();
  const lit = bank.lit.slice();
  let changed = false;
  for (let i = 0; i < bank.letters.length; i++) {
    if (bank.letters[i] === L && !lit[i]) {
      lit[i] = true;
      changed = true;
      break; // spot one occurrence at a time
    }
  }
  const complete = lit.every(Boolean);
  let completions = bank.completions;
  let nextLit = lit;
  if (complete) {
    completions += 1;
    nextLit = bank.letters.map(() => false);
  }
  return {
    bank: { ...bank, lit: nextLit, completions },
    changed,
    completed: complete,
  };
}

export function spotNext(bank) {
  const lit = bank.lit.slice();
  const idx = lit.findIndex((v) => !v);
  if (idx < 0) {
    return {
      bank: {
        ...bank,
        lit: bank.letters.map(() => false),
        completions: bank.completions + 1,
      },
      changed: true,
      completed: true,
      letter: null,
    };
  }
  lit[idx] = true;
  const complete = lit.every(Boolean);
  let completions = bank.completions;
  let nextLit = lit;
  if (complete) {
    completions += 1;
    nextLit = bank.letters.map(() => false);
  }
  return {
    bank: { ...bank, lit: nextLit, completions },
    changed: true,
    completed: complete,
    letter: bank.letters[idx],
  };
}

export function litCount(bank) {
  return bank.lit.filter(Boolean).length;
}

export function isComplete(bank) {
  return bank.lit.every(Boolean);
}

export function resetLetters(bank) {
  return {
    ...bank,
    lit: bank.letters.map(() => false),
  };
}
