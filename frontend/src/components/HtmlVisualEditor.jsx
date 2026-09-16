import { useImperativeHandle, useRef } from 'react';
import { sanitizeHtml } from '../lib/htmlEditor';

export default function HtmlVisualEditor({ ref, documentHtml, onChange, onHistory }) {
  const frameRef = useRef(null);
  const rangeRef = useRef(null);
  const commandInProgress = useRef(false);
  const handlersRef = useRef({ onChange, onHistory });
  handlersRef.current = { onChange, onHistory };

  const publish = () => {
    const doc = frameRef.current?.contentDocument;
    if (doc?.body) handlersRef.current.onChange(doc.body.innerHTML, !commandInProgress.current);
  };
  useImperativeHandle(ref, () => ({
    command(command, value) {
      const doc = frameRef.current?.contentDocument;
      if (!doc?.body) return;
      doc.body.focus();
      const selection = doc.getSelection();
      if (rangeRef.current && doc.body.contains(rangeRef.current.commonAncestorContainer)) {
        selection.removeAllRanges();
        selection.addRange(rangeRef.current);
      }
      commandInProgress.current = true;
      doc.execCommand(command, false, value);
      publish();
      commandInProgress.current = false;
    },
    selectedText() { return frameRef.current?.contentDocument?.getSelection()?.toString() || ''; },
  }));

  const initialize = () => {
    const doc = frameRef.current?.contentDocument;
    if (!doc?.body) return;
    rangeRef.current = null;
    doc.body.contentEditable = 'true';
    doc.body.setAttribute('aria-label', 'Nội dung văn bản');
    doc.body.style.minHeight = 'calc(100vh - 80px)';
    doc.addEventListener('selectionchange', () => {
      const selection = doc.getSelection();
      if (selection.rangeCount && doc.body.contains(selection.anchorNode)) rangeRef.current = selection.getRangeAt(0).cloneRange();
    });
    doc.addEventListener('input', publish);
    doc.addEventListener('click', e => { if (e.target.closest('a')) e.preventDefault(); });
    doc.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && ['z', 'y'].includes(e.key.toLowerCase())) {
        e.preventDefault();
        handlersRef.current.onHistory(e.key.toLowerCase() === 'y' || e.shiftKey ? 1 : -1);
      }
    });
    // Keep pasted/dropped markup from introducing active content into the editor.
    const insertTransfer = (e, transfer) => {
      e.preventDefault();
      const html = transfer?.getData('text/html');
      commandInProgress.current = true;
      if (html) doc.execCommand('insertHTML', false, sanitizeHtml(html));
      else doc.execCommand('insertText', false, transfer?.getData('text/plain') || '');
      publish();
      commandInProgress.current = false;
    };
    doc.addEventListener('paste', e => insertTransfer(e, e.clipboardData));
    doc.addEventListener('drop', e => insertTransfer(e, e.dataTransfer));
  };

  return <iframe ref={frameRef} title="Soạn văn bản trực quan" className="html-visual-frame" sandbox="allow-same-origin" srcDoc={documentHtml} onLoad={initialize} />;
}
