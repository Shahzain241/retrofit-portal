import '@testing-library/jest-dom/vitest';

// jsdom does not implement requestAnimationFrame by default. Run callbacks
// synchronously so the shared Modal's enter animation resolves cleanly in tests.
global.requestAnimationFrame = (cb) => cb(Date.now());
global.cancelAnimationFrame = () => {};
