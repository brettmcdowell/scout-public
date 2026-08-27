import { useState } from 'react';
import { OnboardingProvider, useOnboarding } from './OnboardingContext';
import WizardLayout from './WizardLayout';
import OnboardingMap from './OnboardingMap';
import BottomNav from './BottomNav';
import Step1_PostcodeEntry from './steps/Step1_PostcodeEntry';
import Step4Sidebar from './steps/Step4Sidebar';
import Step5Sidebar from './steps/Step5Sidebar';
import Step5b_CropDetails from './steps/Step5b_CropDetails';
import Step6_Success from './steps/Step6_Success';
import WelcomeModal from './WelcomeModal';
import { saveOnboarding } from '../../api/onboarding';

/** Headings shown above the map for steps 2–5 */
function StepHeading({ bgStep }: { bgStep: number }) {
  const { state } = useOnboarding();

  const headings: Record<number, { title: string; subtitle: string }> = {
    2: { title: 'Locating your area', subtitle: `Zooming to ${state.postcode}` },
    3: { title: 'Detecting fields', subtitle: "We're scanning for field boundaries" },
    4: { title: 'Select your fields', subtitle: 'Click fields on the map or use the checkboxes below.' },
    5: { title: 'Review & confirm', subtitle: 'Check your selection before we save them.' },
    6: { title: 'Crop details', subtitle: 'Add crop type and sowing date for contextual analysis.' },
  };

  const h = headings[bgStep];
  if (!h) return null;

  return (
    <div className="px-6 pt-5 pb-4">
      <h2 className="text-3xl font-bold text-gray-900 mb-1">{h.title}</h2>
      <p className="text-base text-gray-500">{h.subtitle}</p>
    </div>
  );
}

/** Steps 2–6 (+ frozen background for step 7 success modal) */
function MapSteps() {
  const { state, dispatch } = useOnboarding();
  const step = state.currentStep;
  const bgStep = Math.min(step, 6);
  const [saving, setSaving] = useState(false);
  const [allCropFieldsVisited, setAllCropFieldsVisited] = useState(false);

  const selectedFields = (state.detectedFields?.features ?? []).filter((f) =>
    state.selectedFieldIds.has(f.id)
  );

  async function handleConfirm() {
    if (!state.coordinates) return;
    setSaving(true);
    try {
      // Merge crop details into field properties before saving
      const fieldsWithCrops = selectedFields.map((f) => {
        const detail = state.cropDetails[f.id];
        if (!detail) return f;
        return {
          ...f,
          properties: {
            ...f.properties,
            crop_type: detail.cropType || undefined,
            sowing_date: detail.sowingDate || undefined,
          },
        };
      });
      await saveOnboarding({
        postcode: state.postcode,
        center: state.coordinates,
        selected_fields: fieldsWithCrops,
      });
      dispatch({ type: 'NEXT_STEP' });
    } catch {
      dispatch({ type: 'SET_ERROR', payload: 'Failed to save. Please try again.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <StepHeading bgStep={bgStep} />

      <div className="flex-1 flex mx-6 mb-20 min-h-0">
        {(bgStep === 4 || bgStep === 5 || bgStep === 6) && (
          <div className="w-72 shrink-0 mr-4 overflow-hidden h-full min-h-0 animate-slide-in-left">
            {bgStep === 4 && <Step4Sidebar />}
            {bgStep === 5 && <Step5Sidebar />}
            {bgStep === 6 && <Step5b_CropDetails onAllVisited={() => setAllCropFieldsVisited(true)} />}
          </div>
        )}
        <div className="flex-1 rounded-xl overflow-hidden border border-gray-200 shadow-sm transition-all duration-500 relative">
          <OnboardingMap />
          {bgStep === 6 && allCropFieldsVisited && (
            <div className="absolute inset-0 z-10 bg-gray-900/60 backdrop-blur-sm flex items-center justify-center">
              <div className="bg-green-600 rounded-2xl shadow-2xl p-8 text-center max-w-xs mx-4 border-2 border-green-700">
                <div className="w-12 h-12 bg-green-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-white mb-2">All fields complete</h3>
                <p className="text-sm text-green-100 leading-relaxed">
                  Crop details added for all your fields. Hit Confirm & Save to finish.
                </p>
              </div>
            </div>
          )}
          {bgStep === 2 && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="absolute inset-0 bg-green-900/55 animate-detect-pulse rounded-xl" />
              <div className="relative z-10 w-14 h-14 rounded-full border-4 border-green-400 border-t-transparent animate-spin" />
            </div>
          )}
          {step === 3 && !state.detectDone && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="absolute inset-0 bg-green-900/55 animate-detect-pulse rounded-xl" />
              <div className="relative z-10 w-14 h-14 rounded-full border-4 border-green-400 border-t-transparent animate-spin" />
            </div>
          )}
        </div>
      </div>

      {(bgStep === 5 || bgStep === 6) && state.error && (
        <p className="text-red-600 text-sm px-6 -mt-16 mb-12">{state.error}</p>
      )}

      {bgStep === 2 && (
        <BottomNav
          onBack={() => dispatch({ type: 'PREV_STEP' })}
          onNext={() => {}}
          loading={true}
          loadingLabel="Zooming in..."
        />
      )}
      {bgStep === 3 && (
        <BottomNav
          onBack={() => dispatch({ type: 'PREV_STEP' })}
          onNext={state.detectDone ? () => dispatch({ type: 'NEXT_STEP' }) : () => {}}
          loading={!state.detectDone}
          loadingLabel="Discovering..."
          nextLabel={`${state.visibleFieldCount} fields found — Continue`}
        />
      )}
      {bgStep === 4 && (
        <BottomNav
          onBack={() => dispatch({ type: 'PREV_STEP' })}
          onNext={() => dispatch({ type: 'NEXT_STEP' })}
          nextLabel="Continue"
          nextDisabled={state.selectedFieldIds.size === 0}
        />
      )}
      {bgStep === 5 && step < 6 && (
        <BottomNav
          onBack={() => dispatch({ type: 'PREV_STEP' })}
          onNext={() => dispatch({ type: 'NEXT_STEP' })}
          nextLabel="Continue"
        />
      )}
      {bgStep === 6 && step < 7 && (
        <BottomNav
          onBack={() => dispatch({ type: 'PREV_STEP' })}
          onNext={handleConfirm}
          nextLabel="Confirm & Save"
          nextDisabled={!allCropFieldsVisited}
          nextPulsate={allCropFieldsVisited}
          loading={saving}
          loadingLabel="Saving..."
        />
      )}
    </div>
  );
}

function OnboardingWizard({ onLogoClick }: { onLogoClick: () => void }) {
  const { state } = useOnboarding();
  const step = state.currentStep;

  return (
    <WizardLayout currentStep={Math.min(step, 6)} onLogoClick={onLogoClick}>
      {step === 1 && <Step1_PostcodeEntry />}
      {step >= 2 && <MapSteps />}

      {step === 7 && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center backdrop-blur-sm bg-black/40">
          <Step6_Success />
        </div>
      )}
    </WizardLayout>
  );
}

const DEV_FORCE_WELCOME = import.meta.env.DEV && import.meta.env.VITE_FORCE_WELCOME === 'true';

export function OnboardingPage() {
  const [wizardKey, setWizardKey] = useState(0);
  const [showWelcome, setShowWelcome] = useState(
    () => DEV_FORCE_WELCOME || !localStorage.getItem('tv_welcome_seen')
  );

  function handleLogoClick() {
    // Increment key to remount the entire wizard, resetting all onboarding state
    setWizardKey((k) => k + 1);
    // Re-show the welcome modal if the flag is enabled or user hasn't seen it
    if (DEV_FORCE_WELCOME || !localStorage.getItem('tv_welcome_seen')) {
      setShowWelcome(true);
    }
    // If modal isn't enabled, the wizard simply resets to step 1 (postcode entry)
  }

  function handleProceed() {
    localStorage.setItem('tv_welcome_seen', '1');
    setShowWelcome(false);
  }

  return (
    <>
      <OnboardingProvider key={wizardKey}>
        <OnboardingWizard onLogoClick={handleLogoClick} />
      </OnboardingProvider>
      {showWelcome && <WelcomeModal onProceed={handleProceed} />}
    </>
  );
}
