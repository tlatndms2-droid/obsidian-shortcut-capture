import { Notice, Platform, Plugin, Scope } from 'obsidian';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { Transaction } from '@codemirror/state';
import { Capture } from './capture.mjs';

type Target = {
  doc: Document; rect: DOMRect; valid: () => boolean;
  insert: (text: string) => boolean; restore: () => void;
};

export default class ShortcutCapturePlugin extends Plugin {
  private views = new Set<EditorView>();
  private saved: Target | null = null;
  private paletteTarget: Target | null = null;
  private held = new Set<string>();
  private popup: HTMLElement | null = null;
  private dismiss: ((restore?: boolean) => void) | null = null;
  private documents = new WeakSet<Document>();

  onload() {
    if (!Platform.isWin) { new Notice('이 시제품은 Windows Obsidian 전용입니다.'); return; }
    const owner = this;
    this.registerEditorExtension(ViewPlugin.fromClass(class {
      constructor(readonly view: EditorView) { owner.views.add(view); }
      destroy() { owner.views.delete(this.view); }
    }));
    this.watchDocument(document);
    this.addCommand({ id: 'capture-shortcut', name: '단축키 입력', callback: () => this.open() });
  }

  private watchDocument(doc: Document) {
    if (this.documents.has(doc)) return;
    this.documents.add(doc);
    this.registerDomEvent(doc, 'keydown', e => {
      this.held.add(e.code || e.key);
      if (!this.popup) {
        const target = this.readTarget(doc);
        if (target) this.saved = target;
        if ((e.ctrlKey || e.metaKey) && e.code === 'KeyP') this.paletteTarget = target;
      }
    }, true);
    this.registerDomEvent(doc, 'keyup', e => this.held.delete(e.code || e.key), true);
    this.registerDomEvent(doc.defaultView!, 'blur', () => { this.held.clear(); });
    this.registerDomEvent(doc, 'focusout', () => queueMicrotask(() => {
      if (!this.popup && !document.querySelector('.prompt') && !this.readTarget(document)) {
        this.saved = null; this.paletteTarget = null;
      }
    }));
    for (const event of ['focusin', 'pointerup', 'input', 'selectionchange'] as const) {
      this.registerDomEvent(doc, event, () => {
        if (this.popup) return;
        const target = this.readTarget(doc);
        if (target) this.saved = target;
      });
    }
    const discover = () => {
      for (const frame of doc.querySelectorAll('iframe')) {
        try { if (frame.contentDocument) this.watchDocument(frame.contentDocument); } catch { /* external embed */ }
      }
    };
    const observer = new MutationObserver(discover);
    observer.observe(doc.body, {childList:true, subtree:true}); this.register(() => observer.disconnect());
    this.registerDomEvent(doc, 'load', discover, true); discover();
  }

  onunload() { this.dismiss?.(); this.saved = null; this.paletteTarget = null; this.views.clear(); }

  private readTarget(doc: Document): Target | null {
    let active = doc.activeElement as HTMLElement | null;
    while (active?.tagName === 'IFRAME') {
      try { const inner = (active as unknown as HTMLIFrameElement).contentDocument; if (!inner) return null; doc = inner; active = doc.activeElement as HTMLElement | null; } catch { return null; }
    }
    if (!active || !active.closest || active.closest('.shortcut-capture-popup, .prompt, .suggestion-container')) return null;
    const focused = EditorView.findFromDOM(active);
    for (const view of focused ? [focused] : this.views) {
      if (view.contentDOM !== active && !view.contentDOM.contains(active)) continue;
      if (!view.state.facet(EditorView.editable) || view.state.selection.ranges.length !== 1) return null;
      const original = view.state.doc;
      const selection = view.state.selection;
      const { from, to, head } = selection.main;
      const coords = view.coordsAtPos(head);
      if (!coords) return null;
      const valid = () => view.dom.isConnected && view.state.doc.eq(original)
        && view.state.selection.eq(selection) && view.state.facet(EditorView.editable);
      return { doc, rect: this.rootRect(doc, new DOMRect(coords.left, coords.top, 1, coords.bottom - coords.top)), valid,
        restore: () => { if (valid()) view.focus(); },
        insert: text => {
          if (!valid()) return false;
          view.dispatch({changes: {from, to, insert: text}, selection: {anchor: from + text.length},
            annotations: Transaction.userEvent.of('input.shortcut-capture'), scrollIntoView: true});
          view.focus(); return true;
        }
      };
    }
    if (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA') {
      const input = active as HTMLInputElement | HTMLTextAreaElement;
      active = input;
      if (input.disabled || input.readOnly || input.selectionStart === null || input.selectionEnd === null) return null;
      const original = input.value, from = input.selectionStart, to = input.selectionEnd;
      const direction = input.selectionDirection;
      const valid = () => input.isConnected && !input.disabled && !input.readOnly && input.value === original;
      const restore = () => { if (valid()) { input.focus(); input.setSelectionRange(from, to, direction || 'none'); } };
      return {doc, rect: this.rootRect(doc, this.inputCaret(input, from)), valid, restore,
        insert: text => {
          if (!valid()) return false;
          restore();
          // Chromium's native editing command preserves the input's undo history.
          const ok = doc.execCommand('insertText', false, text);
          return ok && input.value === original.slice(0, from) + text + original.slice(to);
        }
      };
    }
    const groupLabel = active.closest<HTMLElement>('.canvas-group-label[contenteditable="true"], .inline-title[contenteditable="true"], .view-header-title[contenteditable="true"], .nav-file-title-content[contenteditable="true"]');
    if (groupLabel) {
      const selection = doc.getSelection();
      if (!selection || selection.rangeCount !== 1) return null;
      const range = selection.getRangeAt(0).cloneRange();
      if (!groupLabel.contains(range.commonAncestorContainer)) return null;
      const original = groupLabel.textContent || '';
      const prefix = range.cloneRange(); prefix.selectNodeContents(groupLabel); prefix.setEnd(range.startContainer, range.startOffset);
      const from = prefix.toString().length, to = from + range.toString().length;
      const valid = () => groupLabel.isConnected && groupLabel.isContentEditable && groupLabel.textContent === original
        && groupLabel.contains(range.startContainer) && groupLabel.contains(range.endContainer);
      const restore = () => { if (valid()) { groupLabel.focus(); selection.removeAllRanges(); selection.addRange(range); } };
      const rect = range.getBoundingClientRect();
      return {doc, rect: this.rootRect(doc, rect.width || rect.height ? rect : groupLabel.getBoundingClientRect()), valid, restore,
        insert: text => { if (!valid()) return false; restore(); return doc.execCommand('insertText',false,text)
          && groupLabel.textContent === original.slice(0,from) + text + original.slice(to); }
      };
    }
    // Unknown contenteditable/plugin editors are intentionally not mutated.
    return null;
  }

  private rootRect(doc: Document, rect: DOMRect): DOMRect {
    let left = rect.left, top = rect.top;
    for (let win: Window | null = doc.defaultView; win?.frameElement; win = win.parent) {
      const frame = win.frameElement as HTMLElement, r = frame.getBoundingClientRect();
      const sx = r.width / (frame.offsetWidth || r.width), sy = r.height / (frame.offsetHeight || r.height);
      left = r.left + left * sx; top = r.top + top * sy;
    }
    return new DOMRect(left, top, rect.width, rect.height);
  }

  private inputCaret(input: HTMLInputElement | HTMLTextAreaElement, offset: number): DOMRect {
    const doc = input.ownerDocument, box = input.getBoundingClientRect(), css = getComputedStyle(input);
    const mirror = doc.createElement('div');
    for (const prop of ['font', 'lineHeight', 'letterSpacing', 'padding', 'borderWidth', 'boxSizing', 'wordSpacing', 'textIndent'] as const) mirror.style[prop] = css[prop];
    Object.assign(mirror.style, {position:'fixed', left:`${box.left}px`, top:`${box.top}px`, width:`${box.width}px`,
      whiteSpace: input instanceof HTMLTextAreaElement ? 'pre-wrap' : 'pre', overflowWrap:'break-word', visibility:'hidden'});
    mirror.textContent = input.value.slice(0, offset);
    const mark = doc.createElement('span'); mark.textContent = '\u200b'; mirror.append(mark); doc.body.append(mirror);
    const r = mark.getBoundingClientRect(); mirror.remove();
    return new DOMRect(r.left - input.scrollLeft, r.top - input.scrollTop, 1, r.height || parseFloat(css.lineHeight) || 20);
  }

  private open() {
    if (this.popup) return;
    const direct = this.readTarget(document);
    const paletteOpen = !!document.querySelector('.prompt');
    // The command palette steals focus; only reuse a previously captured target
    // while that palette is still the command's execution context.
    const target = direct || (paletteOpen ? this.paletteTarget || this.saved : null);
    this.paletteTarget = null;
    if (!target || !target.valid()) { new Notice('먼저 편집할 텍스트 위치에 커서를 놓아 주세요.'); return; }
    const doc = document, win = doc.defaultView!;
    const keyWindows = [...new Set([win, target.doc.defaultView!])];
    const blocked = new Set(this.held);
    const scope = new Scope();
    const processed = new WeakSet<KeyboardEvent>();
    const capture = new Capture();
    let choice: 'cancel' | 'insert' | null = null;
    const el = doc.createElement('div'); el.className = 'shortcut-capture-popup'; el.tabIndex = -1;
    el.setAttribute('role','dialog'); el.setAttribute('aria-label','단축키 입력');
    el.addEventListener('pointerdown', e => e.preventDefault());
    const value = doc.createElement('span'); value.className = 'shortcut-capture-value';
    value.setAttribute('aria-live','polite');
    const button = (label: string, action: () => void) => {
      const b = doc.createElement('button'); b.type = 'button'; b.textContent = label; b.addEventListener('click', action); return b;
    };
    const cancel = button('취소', () => close()); cancel.className = 'shortcut-capture-cancel';
    const insert = button('삽입', () => commit()); insert.className = 'shortcut-capture-insert';
    const x = button('×', () => close()); x.className = 'shortcut-capture-close'; x.setAttribute('aria-label','닫기');
    el.append(value, cancel, insert, x); this.popup = el; doc.body.append(el);
    const position = () => {
      const r = el.getBoundingClientRect();
      const left = Math.max(8, Math.min(target.rect.left, win.innerWidth - r.width - 8));
      const above = target.rect.top - r.height - 8;
      const top = above >= 8 ? above : Math.min(win.innerHeight - r.height - 8, target.rect.bottom + 8);
      el.style.left = `${left}px`; el.style.top = `${Math.max(8, top)}px`;
    };
    const render = () => {
      value.textContent = capture.text || '키를 누르세요';
      value.classList.toggle('is-empty', !capture.text);
      value.setAttribute('aria-label', capture.text || '키를 눌러 주세요');
      insert.disabled = !capture.text;
      cancel.classList.toggle('is-selected', choice === 'cancel'); insert.classList.toggle('is-selected', choice === 'insert'); position();
    };
    const swallow = (e: Event) => { e.preventDefault(); e.stopImmediatePropagation(); };
    const keydown = (e: KeyboardEvent) => {
      if (processed.has(e)) return;
      processed.add(e);
      swallow(e);
      if (blocked.has(e.code || e.key) || e.repeat) return;
      const modified = e.ctrlKey || e.shiftKey || e.altKey || e.metaKey;
      if (!modified && !capture.held.size && e.key.startsWith('Arrow')) {
        if (e.key === 'ArrowLeft') choice = 'cancel';
        if (e.key === 'ArrowRight') choice = 'insert';
        render(); return;
      }
      if (choice && !modified && e.key === 'Enter') { choice === 'cancel' ? close() : commit(); return; }
      if (choice) { choice = null; capture.release(); capture.maximum = []; }
      capture.down(e); render();
    };
    const keyup = (e: KeyboardEvent) => { swallow(e); blocked.delete(e.code || e.key); capture.up(e); };
    const outside = (e: PointerEvent) => { if (!el.contains(e.target as Node)) { swallow(e); close(); } };
    const close = (restore = true) => {
      for (const keyWindow of keyWindows) { keyWindow.removeEventListener('keydown', keydown, true); keyWindow.removeEventListener('keyup', keyup, true); }
      doc.removeEventListener('pointerdown', outside, true); win.removeEventListener('resize', position);
      doc.removeEventListener('scroll', cancelScroll, true);
      this.app.keymap.popScope(scope);
      el.remove(); this.popup = null; this.dismiss = null; this.held.clear();
      if (restore) target.restore();
    };
    const cancelScroll = () => close();
    const commit = () => {
      if (!capture.text) return;
      if (!target.valid()) { close(false); new Notice('입력 위치가 변경되어 삽입을 취소했습니다.'); return; }
      const text = '`' + capture.text + '`'; close(false);
      if (!target.insert(text)) new Notice('원래 입력 위치에 안전하게 삽입할 수 없습니다.');
    };
    this.dismiss = close;
    scope.register(null, null, e => { keydown(e); return false; });
    this.app.keymap.pushScope(scope);
    for (const keyWindow of keyWindows) { keyWindow.addEventListener('keydown', keydown, true); keyWindow.addEventListener('keyup', keyup, true); }
    doc.addEventListener('pointerdown', outside, true); win.addEventListener('resize', position);
    doc.addEventListener('scroll', cancelScroll, true);
    render();
  }
}
