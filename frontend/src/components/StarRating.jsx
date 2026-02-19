import { useState } from 'react';

export default function StarRating({ onSubmit, disabled }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) return;
    try {
      await onSubmit(rating);
      setSubmitted(true);
    } catch {
      // Error handled by parent
    }
  };

  if (submitted) {
    return (
      <div className="text-sm text-[var(--color-muted)] flex items-center gap-2">
        <svg className="w-4 h-4 text-[var(--color-success)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Thanks for rating!
        {rating >= 4 && <span className="text-[var(--color-muted-2)]">Added to gallery.</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button
            key={star}
            disabled={disabled}
            onClick={() => setRating(star)}
            onMouseEnter={() => setHover(star)}
            onMouseLeave={() => setHover(0)}
            className="p-0.5 transition-transform hover:scale-125 disabled:opacity-50"
          >
            <svg
              className={`w-6 h-6 ${
                star <= (hover || rating) ? 'text-[var(--color-warning)]' : 'text-[var(--color-muted-2)]'
              } transition-colors`}
              fill={star <= (hover || rating) ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        ))}
      </div>
      {rating > 0 && (
        <button
          onClick={handleSubmit}
          className="text-xs px-3 py-1 rounded-md btn-accent transition-colors"
        >
          Submit
        </button>
      )}
    </div>
  );
}
