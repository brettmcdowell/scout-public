const STEP_LABELS = ['Postcode', 'Locate', 'Detect', 'Select', 'Confirm'];

interface Props {
  currentStep: number;
}

export default function StepIndicator({ currentStep }: Props) {
  if (currentStep > 5) return null;

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-3">
      <div className="flex items-center justify-between max-w-xl mx-auto">
        {STEP_LABELS.map((label, i) => {
          const step = i + 1;
          const isComplete = currentStep > step;
          const isCurrent = currentStep === step;

          return (
            <div key={label} className="flex items-center">
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors ${
                    isComplete
                      ? 'bg-green-600 border-green-600 text-white'
                      : isCurrent
                        ? 'border-green-600 text-green-700 bg-green-50'
                        : 'border-gray-300 text-gray-400 bg-white'
                  }`}
                >
                  {isComplete ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    step
                  )}
                </div>
                <span
                  className={`text-xs mt-1 ${
                    isCurrent ? 'text-green-700 font-medium' : 'text-gray-400'
                  }`}
                >
                  {label}
                </span>
              </div>
              {i < STEP_LABELS.length - 1 && (
                <div
                  className={`w-12 h-0.5 mx-1 mt-[-12px] ${
                    currentStep > step ? 'bg-green-600' : 'bg-gray-200'
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
      <p className="text-center text-xs text-gray-500 mt-2">
        Step {Math.min(currentStep, 5)} of 5
      </p>
    </div>
  );
}
