import { useOnboarding } from './OnboardingContext';

interface Props {
  onLogoClick: () => void;
}

// Internal steps 1-5 → visual steps 1-4 (2 & 3 are merged into "Scan")
const VISUAL_LABELS = ['Postcode', 'Scan', 'Select', 'Confirm'];
const TOTAL_VISUAL = 4;

function toVisual(internal: number): number {
  if (internal <= 1) return 1;
  if (internal <= 3) return 2;
  if (internal <= 4) return 3;
  return 4;
}

// Which internal step to jump to when clicking a visual step circle
const VISUAL_TO_INTERNAL: Record<number, number> = { 1: 1, 2: 2, 3: 4, 4: 5 };

export default function OnboardingHeader({ onLogoClick }: Props) {
  const { state, dispatch } = useOnboarding();
  const { currentStep, detectDone } = state;

  if (currentStep > 6) return null;

  const visualCurrent = toVisual(currentStep);

  function handleStepClick(visual: number) {
    if (visual >= visualCurrent) return;
    let internal = VISUAL_TO_INTERNAL[visual];
    // If clicking "Scan" and detection already ran, jump straight to Select
    // so we don't re-trigger the fly-to/detect animation
    if (visual === 2 && detectDone) internal = 4;
    dispatch({ type: 'GOTO_STEP', payload: internal });
  }

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
      {/* Logo — clickable, glows on hover */}
      <button
        onClick={onLogoClick}
        title="Return to start"
        className="flex items-center gap-2.5 group cursor-pointer focus:outline-none"
      >
        <img
          src="/scoutLogoBG.png"
          alt="Scout"
          className="h-7 w-7 transition-all duration-300 group-hover:drop-shadow-[0_0_10px_rgba(34,197,94,0.85)]"
        />
        <span className="text-base font-bold text-gray-900 transition-colors duration-200 group-hover:text-green-600">
          TerraVision <span className="text-green-600">SCOUT</span>
        </span>
      </button>

      {/* Step indicator */}
      <div className="flex items-center gap-3.5">
        <span className="text-sm text-gray-500 font-medium">
          Step {Math.min(visualCurrent, TOTAL_VISUAL)} of {TOTAL_VISUAL}
        </span>

        <div className="flex items-center">
          {VISUAL_LABELS.map((label, i) => {
            const visual = i + 1;
            const isComplete = visualCurrent > visual;
            const isCurrent = visualCurrent === visual;
            const isClickable = visual < visualCurrent;

            return (
              <div key={label} className="flex items-center">
                <button
                  onClick={() => handleStepClick(visual)}
                  disabled={!isClickable}
                  title={isClickable ? `Back to ${label}` : label}
                  className={[
                    'w-4 h-4 rounded-full border-2 transition-all duration-200',
                    isComplete
                      ? 'bg-green-600 border-green-600 cursor-pointer hover:ring-2 hover:ring-green-300 hover:ring-offset-1 hover:scale-110'
                      : isCurrent
                        ? 'bg-white border-green-600 cursor-default'
                        : 'bg-white border-gray-300 cursor-default',
                  ].join(' ')}
                  aria-label={`${isClickable ? 'Go back to' : ''} Step ${visual}: ${label}`}
                />
                {i < VISUAL_LABELS.length - 1 && (
                  <div
                    className={`w-5 h-0.5 transition-colors duration-300 ${
                      visualCurrent > visual ? 'bg-green-600' : 'bg-gray-300'
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </header>
  );
}
