
'use strict';

importScripts('./vendor/diff/diff.min.js');

const lines = text => text.match(/[^\r\n]*(?:\r\n|\r|\n)|[^\r\n]+$/gu) || [];
const simplify = text => text.replace(/\s+/gu, ' ').trim();

function tokenParts(text, mode, language) {
  const granularity = mode === 'characters' ? 'grapheme' : 'word';
  if (!Intl.Segmenter) return mode === 'characters' ? [...text] : text.match(/\s+|[\p{L}\p{N}\p{M}]+|./gu) || [];
  return Array.from(new Intl.Segmenter(language, { granularity }).segment(text), part => part.segment);
}

function hunk(before, after, options, deadline) {
  const whole = () => ({
    before: before ? [{ text: before, edited: true }] : [],
    after: after ? [{ text: after, edited: true }] : [],
    changed: true
  });
  if (!before || !after || options.mode === 'lines' || before.length + after.length > 12_000 || Date.now() >= deadline) return whole();
  const left = tokenParts(before, options.mode, options.language);
  const right = tokenParts(after, options.mode, options.language);
  const changes = Diff.diffArrays(left, right, {
    timeout: Math.min(90, Math.max(1, deadline - Date.now())),
    maxEditLength: 2500,
    comparator: options.ignore ? (a, b) => simplify(a) === simplify(b) : undefined
  });
  if (!changes) return whole();
  let startBefore = 0;
  let startAfter = 0;
  const result = { before: [], after: [], changed: true };
  for (const { count, added, removed } of changes) {
    if (!added) {
      result.before.push({ text: left.slice(startBefore, startBefore + count).join(''), edited: Boolean(removed) });
      startBefore += count;
    }
    if (!removed) {
      result.after.push({ text: right.slice(startAfter, startAfter + count).join(''), edited: Boolean(added) });
      startAfter += count;
    }
  }
  return result;
}

function compare(before, after, options) {
  const left = lines(before);
  const right = lines(after);
  const deadline = Date.now() + 1700;
  const changes = Diff.diffArrays(left, right, {
    timeout: 1100, maxEditLength: 12_000,
    comparator: options.ignore ? (a, b) => simplify(a) === simplify(b) : undefined
  });
  if (!changes || changes.length > 5000) throw new Error('complex');
  const blocks = [];
  let startLeft = 0;
  let startRight = 0;
  let removed = '';
  let added = '';
  const flush = () => {
    if (removed || added) blocks.push(hunk(removed, added, options, deadline));
    removed = added = '';
  };
  for (const change of changes) {
    const { count } = change;
    if (change.removed) {
      removed += left.slice(startLeft, startLeft + count).join('');
      startLeft += count;
    } else if (change.added) {
      added += right.slice(startRight, startRight + count).join('');
      startRight += count;
    } else {
      flush();
      blocks.push({
        before: [{ text: left.slice(startLeft, startLeft + count).join(''), edited: false }],
        after: [{ text: right.slice(startRight, startRight + count).join(''), edited: false }],
        changed: false
      });
      startLeft += count;
      startRight += count;
    }
  }
  flush();
  return blocks;
}

self.onmessage = event => {
  try {
    const { before, after, options } = event.data;
    self.postMessage({ blocks: compare(before, after, options) });
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
