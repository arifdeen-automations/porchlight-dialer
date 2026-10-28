// Run with: npm test   (uses Node's built-in test runner, no installs needed)
const test = require('node:test');
const assert = require('node:assert/strict');
const { defaultCfg, canCall, canText, evaluateQueue, planDial } = require('../rules.js');

// Times are minutes after midnight, Pacific. 420 = 7:00 AM PT.
const lead = (o = {}) => ({ id: 'T', state: 'TX', phone: '(512) 555-0199', attemptsToday: 0,
  textOptOut: false, busy: false, closed: false, touches: [], ...o });
const callDue = (id, due) => [{ id, type: 'call', due, status: 'pending' }];

test('allows a call at exactly 8:00 AM local (start is inclusive)', () => {
  assert.equal(canCall(lead(), 360, defaultCfg()).ok, true); // 6:00 AM PT = 8:00 AM Texas
});

test('blocks a call at 7:59 AM local and marks it as wait, not block', () => {
  const r = canCall(lead(), 359, defaultCfg());
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'wait');
});

test('blocks a call at 9:00 PM local (end is exclusive)', () => {
  assert.equal(canCall(lead(), 1140, defaultCfg()).ok, false);
});

test("checks hours in the seller's own time zone", () => {
  const cfg = defaultCfg();
  assert.equal(canCall(lead({ state: 'TX' }), 420, cfg).ok, true);  // 9:00 AM in Texas
  assert.equal(canCall(lead({ state: 'CA' }), 420, cfg).ok, false); // 7:00 AM in California
});

test('Arizona runs on the Pacific clock in October (no DST)', () => {
  assert.equal(canCall(lead({ state: 'AZ' }), 450, defaultCfg()).ok, false);
});

test('Florida sample window ends at 8:00 PM local', () => {
  const cfg = defaultCfg();
  assert.equal(canCall(lead({ state: 'FL' }), 1019, cfg).ok, true);
  assert.equal(canCall(lead({ state: 'FL' }), 1020, cfg).ok, false);
});

test('matches do-not-call numbers in any format', () => {
  const cfg = defaultCfg();
  cfg.dncText = '937.555.0119';
  assert.equal(canCall(lead({ phone: '(937) 555-0119' }), 600, cfg).reason, 'On do-not-call list');
});

test('do-not-call wins over every other rule', () => {
  const cfg = defaultCfg();
  cfg.dncText = '+1 512 555 0199';
  const r = canCall(lead({ attemptsToday: 9 }), 100, cfg);
  assert.equal(r.reason, 'On do-not-call list');
  assert.equal(r.kind, 'block');
});

test('blocks the call once the daily limit is reached', () => {
  const cfg = defaultCfg();
  assert.equal(canCall(lead({ attemptsToday: 2 }), 600, cfg).ok, true);
  assert.equal(canCall(lead({ attemptsToday: 3 }), 600, cfg).kind, 'block');
});

test('never texts a seller who opted out', () => {
  assert.equal(canText(lead({ textOptOut: true }), 600, defaultCfg()).reason, 'Opted out of texts');
});

test('blocks calls after midnight Eastern (11:30 PM PT is 2:30 AM in Florida)', () => {
  assert.equal(canCall(lead({ state: 'FL' }), 1410, defaultCfg()).ok, false);
});

test('queue is empty when no call is due yet', () => {
  assert.equal(evaluateQueue([lead({ touches: callDue('x', 900) })], 600, defaultCfg()).items.length, 0);
});

test('queue puts the earliest due seller first, across time zones', () => {
  const a = lead({ id: 'A', state: 'CA', touches: callDue('a', 540) }); // due 9:00 AM PT
  const b = lead({ id: 'B', state: 'FL', touches: callDue('b', 600) }); // due 7:00 AM PT
  assert.equal(evaluateQueue([a, b], 600, defaultCfg()).ready[0].lead.id, 'B');
});

test('never dials more sellers than there are free agents', () => {
  const cfg = defaultCfg();
  const leads = ['A', 'B', 'C'].map(id => lead({ id, touches: callDue(id + '1', 500) }));
  assert.equal(planDial(leads, [{ id: 'x', status: 'available' }, { id: 'y', status: 'oncall' }], 600, cfg).length, 1);
  assert.equal(planDial(leads, [{ id: 'y', status: 'oncall' }], 600, cfg).length, 0);
});

test('skips sellers who are already on a call', () => {
  assert.equal(evaluateQueue([lead({ busy: true, touches: callDue('z', 500) })], 600, defaultCfg()).items.length, 0);
});
