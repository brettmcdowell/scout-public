import { useState } from 'react';

interface Props {
  onProceed: () => void;
}

const TOTAL_SCREENS = 5;

function DotProgress({ current }: { current: number }) {
  return (
    <div className="flex items-center">
      {Array.from({ length: TOTAL_SCREENS }, (_, i) => {
        const step = i + 1;
        const isComplete = current > step;
        const isCurrent = current === step;
        return (
          <div key={step} className="flex items-center">
            <div
              className={`w-3 h-3 rounded-full border-2 transition-colors duration-200 ${
                isComplete
                  ? 'bg-green-600 border-green-600'
                  : isCurrent
                    ? 'bg-white border-green-600'
                    : 'bg-white border-gray-300'
              }`}
            />
            {i < TOTAL_SCREENS - 1 && (
              <div
                className={`w-4 h-0.5 transition-colors duration-200 ${
                  current > step ? 'bg-green-600' : 'bg-gray-200'
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ScreenWelcome() {
  return (
    <div className="text-center">
      <div className="mx-auto w-32 h-32 bg-green-50 rounded-full flex items-center justify-center mb-8">
        <img src="/scoutLogoBG.png" alt="Scout" className="h-20 w-20" />
      </div>
      <h2 className="text-4xl font-bold text-gray-900 mb-5">
        Welcome to <span className="text-green-600">SCOUT</span>
      </h2>
      <p className="text-base text-gray-500 leading-relaxed max-w-md mx-auto">
        SCOUT uses satellite imagery and AI to help you monitor, understand, and
        optimise your farm's crop performance, surfacing the insights that matter
        most, right when you need them.
      </p>
    </div>
  );
}

const PROCESS_STEPS = [
  {
    num: 1,
    title: 'Enter your postcode',
    description:
      "Tell us where your farm is located. We'll zoom to your area and automatically scan for field boundaries.",
    // Replace this div with: <img src="/onboarding-step1.png" ... />
    // Screenshot: /onboarding page, Step 1 — the postcode input card on the land background
    // Save as: client/public/onboarding-step1.png
  },
  {
    num: 2,
    title: 'Select your farm fields',
    description:
      'We detect field boundaries on the satellite map. Click to select the fields that belong to your farm.',
    // Replace this div with: <img src="/onboarding-step2.png" ... />
    // Screenshot: /onboarding page, Step 4 — the map with field polygon overlays and the sidebar
    // Save as: client/public/onboarding-step2.png
  },
  {
    num: 3,
    title: 'Analyse & optimise',
    description:
      'View AI-powered crop health scores, compare scan dates side-by-side, and act on tailored recommendations for your farm.',
    // Replace this div with: <img src="/onboarding-step3.png" ... />
    // Screenshot: /intelligence page — dual-map view with NDVI overlay and insights panel visible
    // Save as: client/public/onboarding-step3.png
  },
];

function StepImage({ stepNum }: { stepNum: number }) {
  const alts = [
    'Postcode entry step on satellite land background',
    'Field selection step with polygon overlays and sidebar',
    'Intelligence dual-map NDVI view with insights panel',
  ];
  return (
    <img
      src={`/onboarding-step${stepNum}.png`}
      className="w-full aspect-video rounded-xl object-cover border border-gray-200/80"
      alt={alts[stepNum - 1]}
    />
  );
}

function ScreenProcess({ num }: { num: 1 | 2 | 3 }) {
  const step = PROCESS_STEPS[num - 1];
  return (
    <div>
      <StepImage stepNum={num} />
      <div className="mt-5">
        <p className="text-[11px] font-semibold text-green-600 uppercase tracking-wider mb-1.5">
          Step {step.num} of 3
        </p>
        <h3 className="text-lg font-bold text-gray-900 mb-2">{step.title}</h3>
        <p className="text-sm text-gray-500 leading-relaxed">{step.description}</p>
      </div>
    </div>
  );
}

function ScreenThankYou() {
  return (
    <div className="text-center">
      <div className="mx-auto w-28 h-28 bg-green-100 rounded-full flex items-center justify-center mb-8">
        <svg
          className="w-14 h-14 text-green-600"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
      </div>
      <h2 className="text-4xl font-bold text-gray-900 mb-5">Ready to get started?</h2>
      <p className="text-base text-gray-500 leading-relaxed max-w-md mx-auto">
        Thank you for choosing SCOUT. We'll walk you through setting up your farm
        in just a few steps then you'll have full access to your crop insights.
      </p>
    </div>
  );
}

export default function WelcomeModal({ onProceed }: Props) {
  const [screen, setScreen] = useState(1);

  const isLast = screen === TOTAL_SCREENS;

  function handleNext() {
    if (isLast) onProceed();
    else setScreen((s) => s + 1);
  }

  function handleBack() {
    setScreen((s) => s - 1);
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-md bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="px-8 pt-8 pb-2 flex flex-col justify-center">
          {screen === 1 && <ScreenWelcome />}
          {screen === 2 && <ScreenProcess num={1} />}
          {screen === 3 && <ScreenProcess num={2} />}
          {screen === 4 && <ScreenProcess num={3} />}
          {screen === 5 && <ScreenThankYou />}
        </div>

        <div className="px-8 py-6 mt-5 border-t border-gray-100 flex items-center justify-between">
          <DotProgress current={screen} />
          <div className="flex items-center gap-3">
            {screen > 1 && (
              <button
                onClick={handleBack}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="bg-green-600 hover:bg-green-700 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors"
            >
              {isLast ? 'Proceed' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
