import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Download, ExternalLink, Trash2, X } from 'lucide-react';
import {
  canRenderPdf,
  downloadBlob,
  formatBytes,
  isImageAttachment,
  useBlobUrl,
} from './attachmentUtils';
import type { Attachment } from '../../types';

/* Full-screen viewer for a column's attachments.
   PDFs render in an iframe (the browser's own viewer), images fill the frame
   with click-to-zoom. Arrows walk the whole list without closing. */

const dateFmt = new Intl.DateTimeFormat('ca-ES', {
  day: '2-digit',
  month: 'short',
  year: 'numeric',
});

interface ViewerProps {
  attachments: Attachment[];
  index: number;
  onIndexChange: (index: number) => void;
  onClose: () => void;
  onRename?: (id: string, name: string) => void;
  onDelete?: (id: string) => void;
}

export function AttachmentViewer(props: ViewerProps) {
  const current = props.attachments[props.index];
  if (!current) return null;

  return createPortal(
    <div className="att-viewer" onClick={props.onClose}>
      <div className="att-viewer-backdrop" />
      {/* Keyed by attachment: zoom, rename and delete-confirm reset on navigation */}
      <ViewerBody key={current.id} {...props} current={current} />
    </div>,
    document.body,
  );
}

function ToolbarButton({
  onClick,
  title,
  danger,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  danger?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      className={`att-viewer-btn ${danger ? 'is-danger' : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

function ViewerBody({
  attachments,
  index,
  current,
  onIndexChange,
  onClose,
  onRename,
  onDelete,
}: ViewerProps & { current: Attachment }) {
  const [zoomed, setZoomed] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [draftName, setDraftName] = useState(current.name);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);

  const url = useBlobUrl(current.blob);
  const isImage = isImageAttachment(current);

  const go = useCallback(
    (delta: number) => {
      if (attachments.length < 2) return;
      onIndexChange((index + delta + attachments.length) % attachments.length);
    },
    [attachments.length, index, onIndexChange],
  );

  // Captured on the document so column-level shortcuts never see these keys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (renaming) return; // the input handles its own Enter/Escape
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [go, onClose, renaming]);

  const startRename = () => {
    if (!onRename) return;
    setDraftName(current.name);
    setRenaming(true);
    // Focus after the input mounts
    requestAnimationFrame(() => renameInputRef.current?.select());
  };

  const commitRename = () => {
    const name = draftName.trim();
    setRenaming(false);
    if (name && name !== current.name) onRename?.(current.id, name);
  };

  const handleDelete = () => {
    if (!confirmDelete) { setConfirmDelete(true); return; }
    const id = current.id;
    if (attachments.length <= 1) onClose();
    else if (index >= attachments.length - 1) onIndexChange(index - 1);
    onDelete?.(id);
  };

  return (
    <>
      {/* Top bar — name, meta and actions */}
      <div className="att-viewer-bar" onClick={e => e.stopPropagation()}>
        <div className="att-viewer-meta">
          {renaming ? (
            <input
              ref={renameInputRef}
              className="att-viewer-rename"
              value={draftName}
              autoFocus
              onChange={e => setDraftName(e.target.value)}
              onBlur={commitRename}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); commitRename(); }
                if (e.key === 'Escape') { e.preventDefault(); setRenaming(false); }
              }}
            />
          ) : (
            <button
              className="att-viewer-name"
              onClick={startRename}
              title={onRename ? 'Clica per reanomenar' : current.name}
            >
              {current.name}
            </button>
          )}
          <span className="att-viewer-sub">
            {formatBytes(current.size)} · {dateFmt.format(current.createdAt)}
            {attachments.length > 1 && ` · ${index + 1}/${attachments.length}`}
          </span>
        </div>

        <div className="att-viewer-actions">
          <ToolbarButton
            title="Descarregar"
            onClick={() => downloadBlob(current.blob, current.name)}
          >
            <Download size={16} />
          </ToolbarButton>
          <ToolbarButton
            title="Obrir en una pestanya nova"
            onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}
          >
            <ExternalLink size={16} />
          </ToolbarButton>
          {onDelete && (
            <ToolbarButton
              title={confirmDelete ? 'Clica un altre cop per esborrar' : 'Esborrar adjunt'}
              danger={confirmDelete}
              onClick={handleDelete}
            >
              <Trash2 size={16} />
            </ToolbarButton>
          )}
          <ToolbarButton title="Tancar" onClick={onClose}>
            <X size={18} />
          </ToolbarButton>
        </div>
      </div>

      {/* Stage */}
      <div className="att-viewer-stage" onClick={e => e.stopPropagation()}>
        {attachments.length > 1 && (
          <button
            className="att-viewer-nav is-prev"
            onClick={() => go(-1)}
            title="Anterior"
            aria-label="Anterior"
          >
            <ChevronLeft size={22} />
          </button>
        )}

        {isImage ? (
          <div
            className={`att-viewer-imgwrap ${zoomed ? 'is-zoomed' : ''}`}
            onClick={() => setZoomed(z => !z)}
          >
            {url && <img src={url} alt={current.name} draggable={false} />}
          </div>
        ) : canRenderPdf ? (
          url && (
            <iframe
              className="att-viewer-frame"
              src={`${url}#view=FitH`}
              title={current.name}
            />
          )
        ) : (
          /* Browsers with no built-in PDF viewer would show a blank frame */
          <div className="att-viewer-fallback">
            <span className="att-viewer-fallback-ext">PDF</span>
            <p>Aquest navegador no pot mostrar PDFs incrustats.</p>
            <div className="att-viewer-fallback-actions">
              <button onClick={() => downloadBlob(current.blob, current.name)}>
                Descarregar
              </button>
              <button onClick={() => url && window.open(url, '_blank', 'noopener,noreferrer')}>
                Obrir en una pestanya
              </button>
            </div>
          </div>
        )}

        {attachments.length > 1 && (
          <button
            className="att-viewer-nav is-next"
            onClick={() => go(1)}
            title="Següent"
            aria-label="Següent"
          >
            <ChevronRight size={22} />
          </button>
        )}
      </div>

      {/* Filmstrip */}
      {attachments.length > 1 && (
        <div className="att-viewer-strip" onClick={e => e.stopPropagation()}>
          {attachments.map((a, i) => (
            <StripItem
              key={a.id}
              attachment={a}
              active={i === index}
              onClick={() => onIndexChange(i)}
            />
          ))}
        </div>
      )}
    </>
  );
}

function StripItem({
  attachment,
  active,
  onClick,
}: {
  attachment: Attachment;
  active: boolean;
  onClick: () => void;
}) {
  const isImage = isImageAttachment(attachment);
  const url = useBlobUrl(isImage ? attachment.blob : null);

  return (
    <button
      className={`att-strip-item ${active ? 'is-active' : ''}`}
      onClick={onClick}
      title={attachment.name}
      style={url ? { backgroundImage: `url(${url})` } : undefined}
    >
      {!isImage && <span className="att-strip-ext">PDF</span>}
    </button>
  );
}
