interface Props {
  onBack?: () => void;
  onNext?: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
  nextPulsate?: boolean;
  loading?: boolean;
  loadingLabel?: string;
  skipLabel?: string;
  onSkip?: () => void;
}

export default function BottomNav({ onBack, onNext, nextLabel = 'Continue', nextDisabled, nextPulsate, loading, loadingLabel, skipLabel, onSkip }: Props) {
  return (
    <div className="absolute bottom-0 left-0 right-0 p-4 flex items-center justify-between pointer-events-none z-[500]">
      {onBack ? (
        <button
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-sm font-medium px-4 py-2.5 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>
      ) : (
        <div />
      )}
      <div className="pointer-events-auto flex items-center gap-3">
        {skipLabel && onSkip && (
          <button
            onClick={onSkip}
            disabled={loading}
            className="text-sm text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
          >
            {skipLabel}
          </button>
        )}
      {onNext && (
        <button
          onClick={onNext}
          disabled={nextDisabled || loading}
          className={`pointer-events-auto flex items-center gap-2 text-white text-sm font-medium px-5 py-2.5 rounded-lg shadow-sm transition-colors disabled:opacity-70 ${
            nextPulsate && !loading
              ? 'bg-green-500 hover:bg-green-400 animate-btn-pulse'
              : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {loading ? (
            <>
              {loadingLabel || 'Loading...'}
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </>
          ) : (
            <>
              {nextLabel}
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </>
          )}
        </button>
      )}
      </div>
    </div>
  );
}
