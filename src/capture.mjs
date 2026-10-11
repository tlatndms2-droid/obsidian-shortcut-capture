const modifiers = ['Ctrl', 'Shift', 'Alt', 'Meta'];
export function keyName(e) {
  const c = e.code || '';
  if (/^Control/.test(c) || e.key === 'Control') return 'Ctrl';
  if (/^Shift/.test(c) || e.key === 'Shift') return 'Shift';
  if (/^Alt/.test(c) || e.key === 'Alt') return 'Alt';
  if (/^Meta/.test(c) || e.key === 'Meta') return 'Meta';
  if (/^Key[A-Z]$/.test(c)) return c.slice(3);
  if (/^Digit\d$/.test(c)) return c.slice(5);
  const names = {Space: 'Space', Escape: 'Esc', Backquote: 'Backquote',
    Minus: 'Minus', Equal: 'Equal', BracketLeft: 'BracketLeft', BracketRight: 'BracketRight',
    Backslash: 'Backslash', Semicolon: 'Semicolon', Quote: 'Quote', Comma: 'Comma',
    Period: 'Period', Slash: 'Slash'};
  return names[c] || c || (e.key === ' ' ? 'Space' : e.key === 'Escape' ? 'Esc' : e.key);
}
export class Capture {
  held = new Map();
  maximum = [];
  down(e) {
    if (e.repeat || this.held.has(e.code || e.key)) return this.text;
    if (!this.held.size) this.maximum = [];
    this.held.set(e.code || e.key, keyName(e));
    const values = [...new Set(this.held.values())];
    // Modifier flags also cover modifiers held before a window focus transition.
    for (const [flag, name] of [['ctrlKey','Ctrl'], ['shiftKey','Shift'], ['altKey','Alt'], ['metaKey','Meta']]) {
      if (e[flag] && !values.includes(name)) values.unshift(name);
    }
    const combination = [...modifiers.filter(x => values.includes(x)), ...values.filter(x => !modifiers.includes(x))];
    if (combination.some(x => !modifiers.includes(x)) && combination.length >= this.maximum.length) this.maximum = combination;
    return this.text;
  }
  up(e) { this.held.delete(e.code || e.key); }
  release() { this.held.clear(); }
  get text() { return this.maximum.join('+'); }
}
