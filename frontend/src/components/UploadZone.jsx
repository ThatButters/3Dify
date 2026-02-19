import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';

export default function UploadZone({ onUpload, disabled }) {
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);

  const onDrop = useCallback(async (accepted, rejected) => {
    setError(null);
    if (rejected.length > 0) {
      setError('Invalid file. Use JPG, PNG, or WEBP under 20MB.');
      return;
    }
    const file = accepted[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      await onUpload(file);
    } catch (err) {
      setError(err.message);
      setUploading(false);
    }
  }, [onUpload]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxSize: 20 * 1024 * 1024,
    multiple: false,
    disabled: disabled || uploading,
  });

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Gradient border wrapper */}
      <div className="rounded-2xl p-[1px] bg-gradient-to-b from-[var(--color-border-2)] to-transparent">
        <div className="rounded-2xl bg-[var(--color-surface)] p-1">
          <div
            {...getRootProps()}
            className={`
              border-2 border-dashed rounded-xl p-10 sm:p-14 text-center cursor-pointer
              transition-all duration-250
              ${isDragActive
                ? 'border-[var(--color-accent)]/40 glow-accent-sm'
                : 'border-[var(--color-border-2)] hover:border-[var(--color-accent)]/30'}
              ${uploading ? 'pointer-events-none opacity-60' : ''}
            `}
          >
            <input {...getInputProps()} />

            {preview ? (
              <div className="space-y-4">
                <img
                  src={preview}
                  alt="Preview"
                  className="mx-auto max-h-48 rounded-lg object-contain"
                />
                {uploading && (
                  <div className="flex items-center justify-center gap-2 text-sm text-[var(--color-muted)]">
                    <svg className="w-4 h-4 animate-spin text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Uploading...
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-5">
                <div className="w-14 h-14 rounded-2xl bg-[var(--color-accent)]/10 flex items-center justify-center mx-auto">
                  <svg className="w-7 h-7 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm mb-1">
                    {isDragActive ? 'Drop your photo here' : 'Drag & drop your photo'}
                  </p>
                  <p className="text-xs text-[var(--color-muted-2)] mb-6">JPG, PNG, WEBP up to 20MB</p>
                </div>
                <button
                  type="button"
                  className="px-6 py-2.5 btn-accent text-sm font-medium rounded-xl glow-accent-sm"
                >
                  Choose File
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-3 text-sm text-[var(--color-danger)] text-center">{error}</p>
      )}
    </div>
  );
}
