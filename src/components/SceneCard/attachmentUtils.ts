import { useEffect, useState } from 'react';
import type { Attachment } from '../../types';

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${Math.round(kb)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
}

export function isImageAttachment(a: Attachment): boolean {
  return a.mimeType.startsWith('image/');
}

/* Chrome/Safari/Firefox render PDFs in an iframe; anything else gets the
   download fallback instead of an empty frame. */
export const canRenderPdf =
  typeof navigator === 'undefined' || navigator.pdfViewerEnabled !== false;

/* Saves a blob to disk without leaving the app. The object URL is revoked on a
   later tick — revoking it synchronously cancels the download in Safari. */
export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* Object URL tied to a blob's lifetime.
   Creating it in useMemo and revoking it in an effect looks equivalent but
   breaks under StrictMode: the double-invoked cleanup revokes a URL the memo
   never recreates, leaving dead <img>/<iframe> sources. Creating and revoking
   inside the same effect keeps the pair together — this is the one case where
   setState in an effect is the correct pattern, since the URL cannot exist
   before the effect that owns its revocation runs. */
export function useBlobUrl(blob: Blob | null | undefined): string {
  const [url, setUrl] = useState('');
  useEffect(() => {
    if (!blob) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setUrl('');
      return;
    }
    const next = URL.createObjectURL(blob);
    setUrl(next);
    return () => URL.revokeObjectURL(next);
  }, [blob]);
  return url;
}
