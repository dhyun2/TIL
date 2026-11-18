// A textarea exposes its selection but not the character under a file drag.
// Hit-test a text layer with the same wrapping, padding and scroll position.
export function dropPosition(field, x, y) {
  const rect = field.getBoundingClientRect();
  const style = getComputedStyle(field);
  const mirror = document.createElement('div');
  for (const key of ['font', 'letterSpacing', 'wordSpacing', 'lineHeight', 'tabSize',
    'textAlign', 'textIndent', 'direction', 'wordBreak', 'overflowWrap', 'padding']) {
    mirror.style[key] = style[key];
  }
  Object.assign(mirror.style, {
    position: 'fixed', top: rect.top + field.clientTop + 'px', left: rect.left + field.clientLeft + 'px',
    width: field.clientWidth + 'px', height: field.clientHeight + 'px', boxSizing: 'border-box',
    whiteSpace: 'pre-wrap', overflow: 'hidden', opacity: '0', zIndex: '2147483647',
  });
  mirror.textContent = field.value + '\u200b';
  document.body.append(mirror);
  try {
    mirror.scrollTop = field.scrollTop;
    mirror.scrollLeft = field.scrollLeft;
    const bounds = mirror.getBoundingClientRect();
    x = Math.max(bounds.left + 1, Math.min(x, bounds.right - 1));
    y = Math.max(bounds.top + 1, Math.min(y, bounds.bottom - 1));
    const caret = document.caretPositionFromPoint?.(x, y);
    if (caret?.offsetNode === mirror.firstChild) return Math.min(caret.offset, field.value.length);
    const range = document.caretRangeFromPoint?.(x, y);
    if (range?.startContainer === mirror.firstChild) return Math.min(range.startOffset, field.value.length);
    return field.value.length;
  } finally {
    mirror.remove();
  }
}
