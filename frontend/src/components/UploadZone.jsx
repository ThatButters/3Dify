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
      <div
        {...getRootProps()}
        className={`
          relative rounded-xl border-2 border-dashed p-12 text-center cursor-pointer
          transition-all duration-200
          ${isDragActive
            ? 'border-blue-500 bg-blue-500/5'
            : 'border-[var(--color-border)] hover:border-gray-500 hover:bg-white/[0.02]'}
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
              <div className="flex items-center justify-center gap-2 text-sm text-gray-400">
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Uploading...
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
              <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 16V4m0 0l-4 4m4-4l4 4M4 20h16" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-300">
                {isDragActive ? 'Drop your photo here' : 'Drag & drop a photo, or click to browse'}
              </p>
              <p className="text-xs text-gray-500 mt-1">JPG, PNG, WEBP up to 20MB</p>
            </div>
          </div>
        )}
      </div>

      {error && (
        <p className="mt-3 text-sm text-red-400 text-center">{error}</p>
      )}
    </div>
  );
}
