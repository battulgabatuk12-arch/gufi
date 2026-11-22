const { test } = require('node:test');
const assert = require('node:assert/strict');
const { app } = require('./ui-harness.cjs');

test('presentation options persist without changing simulation or ranked command history', () => {
  const a = app(); a.click('startShortcut');
  const before = JSON.stringify(a.steppe.state), replay = JSON.stringify(a.steppe.replay);
  a.click('simpleGraphics'); a.click('storyVoice');
  assert.equal(a.steppe.renderer.detail, false);
  assert.equal(JSON.stringify(a.steppe.state), before);
  assert.equal(JSON.stringify(a.steppe.replay), replay);
  const b = app({ saved: a.storage });
  assert.equal(b.steppe.renderer.detail, false);
  assert.equal(b.document.getElementById('storyVoice').getAttribute('aria-pressed'), 'false');
  b.click('startShortcut'); b.frame();
});

test('story variants rotate while retaining the exact factual event and support reset', () => {
  const a = app(), story = a.context.SteppeStories.create();
  const event = { kind: 'mine', text: 'Уурхай +55 алт, +4 алт/с' };
  const first = story.describe(event), second = story.describe(event);
  assert.notEqual(first, second); assert.ok(first.endsWith(event.text)); assert.ok(second.endsWith(event.text));
  assert.equal(story.describe(event, false), event.text);
  story.reset(); assert.equal(story.describe(event), first);
  assert.equal(story.describe({ kind: 'unknown', text: 'Бодит үйл явдал' }), 'Бодит үйл явдал');
});

test('journal retains eight newest events, renders names as text, and resets on a new campaign', () => {
  const a = app(); a.click('startShortcut');
  const state = a.steppe.state;
  for (let n = 0; n < 10; n++) {
    state.events.push({ id: ++state.seq, kind: 'recruit', owner: 0, text: '<img src=x onerror=alert(1)> ' + n, x: 0, y: 0 });
    a.frames(15);
  }
  const log = a.document.getElementById('campaignLog');
  assert.equal(log.children.length, 8);
  assert.match(log.children[0].textContent, /<img src=x onerror=alert\(1\)> 9/);
  assert.equal(log.querySelectorAll('img').length, 0);
  a.click('newGame'); a.click('startShortcut');
  assert.equal(log.children.length, 1); assert.match(log.textContent, /Аян эхэллээ/);
});
