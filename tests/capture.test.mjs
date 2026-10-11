import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Capture, keyName } from '../src/capture.mjs';
const event = (code, rest = {}) => ({code, key: code, ...rest});
test('simultaneous keys and maximum do not shrink', () => {
  const c = new Capture(); c.down(event('KeyG')); c.down(event('KeyX'));
  assert.equal(c.text,'G+X'); c.up(event('KeyG')); assert.equal(c.text,'G+X');
  c.up(event('KeyX')); c.down(event('KeyA')); assert.equal(c.text,'A');
});
test('modifier ordering independent of press order', () => {
  const c = new Capture(); c.down(event('KeyA')); c.down(event('ControlRight'));
  c.down(event('ShiftLeft')); assert.equal(c.text,'Ctrl+Shift+A');
});
test('modifier sides collapse and repeats ignored', () => {
  const c = new Capture(); c.down(event('ControlLeft')); c.down(event('ControlRight'));
  c.down(event('KeyA',{ctrlKey:true})); c.down(event('KeyA',{repeat:true}));
  assert.equal(c.text,'Ctrl+A'); c.up(event('ControlLeft')); assert.equal(c.text,'Ctrl+A');
});
test('English physical keys work even with IME key names', () => {
  assert.equal(keyName(event('KeyG',{key:'Process'})), 'G');
  assert.equal(keyName(event('Digit1',{key:'!'})), '1');
});
test('single keys and combined arrows', () => {
  for (const [code,text] of [['Space','Space'],['Escape','Esc'],['Enter','Enter'],['F3','F3']]) {
    const c=new Capture(); c.down(event(code)); assert.equal(c.text,text);
  }
  const c = new Capture(); c.down(event('ArrowRight',{ctrlKey:true})); assert.equal(c.text,'Ctrl+ArrowRight');
});
test('modifier-only is not insertable, new cycle replaces', () => {
  const c=new Capture(); c.down(event('ControlLeft')); assert.equal(c.text,'');
  c.down(event('KeyA')); c.release(); c.down(event('KeyX')); assert.equal(c.text,'X');
});
