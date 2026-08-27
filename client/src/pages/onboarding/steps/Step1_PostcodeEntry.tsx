import { useState } from 'react';
import { useOnboarding } from '../OnboardingContext';
import { geocodePostcode } from '../../../api/postcodes';
import BottomNav from '../BottomNav';

// Matches all standard UK postcode formats after normalization (one space enforced):
//   A9 9AA  A99 9AA  AA9 9AA  AA99 9AA  A9A 9AA  AA9A 9AA  GIR 0AA
const UK_POSTCODE_REGEX =
  /^(GIR 0AA|[A-PR-UWYZ]{1,2}[0-9][A-Z0-9]? [0-9][ABD-HJLNP-UW-Z]{2})$/i;

/**
 * Strip whitespace, then re-insert a single space before the inward code
 * (which is always the last 3 characters of a UK postcode).
 * Works for "BT37ABB" → "BT37 ABB" and "BT37 ABB" → "BT37 ABB".
 */
function normalisePostcode(raw: string): string {
  const stripped = raw.replace(/\s+/g, '');
  if (stripped.length < 5 || stripped.length > 7) return stripped;
  return `${stripped.slice(0, -3)} ${stripped.slice(-3)}`;
}

export default function Step1_PostcodeEntry() {
  const { dispatch } = useOnboarding();
  const [postcode, setPostcode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Uppercase and strip anything that can't appear in a UK postcode
    const val = e.target.value.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
    setPostcode(val);
    if (error) setError('');
  }

  async function handleSubmit() {
    setError('');
    const normalised = normalisePostcode(postcode.trim());

    if (!UK_POSTCODE_REGEX.test(normalised)) {
      setError('Please enter a valid UK postcode (e.g. BT78 4RP)');
      return;
    }

    setPostcode(normalised);
    setLoading(true);
    try {
      const coords = await geocodePostcode(normalised);
      dispatch({ type: 'SET_POSTCODE', payload: normalised });
      dispatch({ type: 'SET_COORDINATES', payload: coords });
      dispatch({ type: 'NEXT_STEP' });
    } catch {
      setError('Postcode not found. Please check and try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="h-full flex items-center justify-center px-6">
      <div className="card-pulse-green w-full max-w-sm backdrop-blur-md bg-white/80 rounded-2xl p-7 shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-900 mb-1 text-center">Where is your farm?</h2>
        <p className="text-xs text-gray-400 mb-6 text-center">Enter your postcode to detect your fields.</p>

        <input
          type="text"
          value={postcode}
          onChange={handleChange}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="e.g. BT78 4RP"
          maxLength={8}
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="w-full px-4 py-3 border-2 border-green-400 rounded-xl text-lg text-center font-semibold tracking-widest focus:outline-none focus:border-green-500 bg-white placeholder:text-gray-300 placeholder:font-normal placeholder:tracking-normal"
          autoFocus
        />

        {error && (
          <p className="text-red-500 text-sm mt-3 text-center">{error}</p>
        )}
      </div>

      <BottomNav
        onNext={handleSubmit}
        nextLabel="Continue"
        nextDisabled={!postcode.trim()}
        loading={loading}
        loadingLabel="Searching..."
      />
    </div>
  );
}
