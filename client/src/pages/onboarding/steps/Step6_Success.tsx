import { useNavigate } from '@tanstack/react-router';
import { useOnboarding } from '../OnboardingContext';

export default function Step6_Success() {
  const { state } = useOnboarding();
  const navigate = useNavigate();

  const selectedFields = (state.detectedFields?.features ?? []).filter((f) =>
    state.selectedFieldIds.has(f.id)
  );
  const totalHa = selectedFields.reduce((sum, f) => sum + f.properties.area_hectares, 0);

  function handleGoToDashboard() {
    localStorage.setItem('tv_onboarding_complete', '1');
    navigate({ to: '/overview' });
  }

  return (
    <div className="bg-white rounded-2xl shadow-2xl px-10 py-10 w-full max-w-sm text-center mx-4">
      <div className="">
        <div className="mx-auto w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-2xl font-bold text-gray-900 mb-2">You're all set!</h2>
        <p className="text-sm text-gray-500 mb-8">
          We've saved your {selectedFields.length} field{selectedFields.length !== 1 ? 's' : ''} ({totalHa.toFixed(1)} ha) and will start
          tracking them right away.
        </p>

        <button
          className="inline-flex items-center gap-2 border border-gray-300 text-gray-700 font-medium px-6 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-sm"
          onClick={handleGoToDashboard}
        >
          Go to Dashboard
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}

