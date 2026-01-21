/**
 * PhoneSimulator Component Tests
 *
 * Note: This test file is prepared for Jest/React Testing Library.
 * Install test dependencies with: npm install --save-dev jest @testing-library/react @testing-library/jest-dom
 *
 * Run manually for now by importing into a test page.
 */

import { PhoneSimulator } from './PhoneSimulator';

// Sample SMS content for testing
export const sampleSMSContent = `LAKEO Lake Oberon (863m)
24hr from 06:00 Mon

06h 5-7o Rn15% W12-20 Cld40% CB18 FL22

08h 7-10o Rn18% W14-22 Cld45% CB17 FL21

10h 10-14o Rn22% W16-26 Cld52% CB15 FL19

12h 12-16o Rn25% W18-30 Cld60% CB14 FL18 !

Rn=Rain W=Wind Cld=Cloud
CB=CloudBase(x100m)
FL=Freeze(x100m)`;

export const sampleWatchContent = `LAKEO 863m
Mon 20 Jan

06h 5-7o Rn15%
W12-20 CB18 FL22

08h 7-10o Rn18%
W14-22 CB17 FL21

10h 10-14o Rn22%
W16-26 CB15 FL19

Rn=Rain W=Wind
CB=Cloud FL=Freeze`;

/**
 * Test cases (to be run with Jest when configured):
 *
 * 1. renders iPhone variant by default
 * 2. renders Watch variant when specified
 * 3. displays provided content
 * 4. typing animation starts with empty content
 * 5. typing animation reveals characters progressively
 * 6. accepts custom className for positioning
 */

// Export for use in visual test page
export { PhoneSimulator };
