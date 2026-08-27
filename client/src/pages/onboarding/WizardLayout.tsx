import type { ReactNode } from 'react';
import OnboardingHeader from './OnboardingHeader';

const BG_TILE = '/backgroundLand.png';

interface Props {
  currentStep: number;
  onLogoClick: () => void;
  children: ReactNode;
}

export default function WizardLayout({ currentStep, onLogoClick, children }: Props) {
  return (
    <div className="flex flex-col h-screen">
      <OnboardingHeader onLogoClick={onLogoClick} />
      <main className="flex-1 overflow-hidden relative">
        {currentStep === 1 && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: `url(${BG_TILE})`,
              backgroundSize: 'cover',
              backgroundPosition: 'center',
              filter: 'brightness(0.82)',
            }}
          />
        )}
        <div className={`absolute inset-0${currentStep !== 1 ? ' bg-gray-50' : ''}`}>
          {children}
        </div>
      </main>
    </div>
  );
}
