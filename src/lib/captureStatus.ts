/**
 * The status a card should render, given this deployment.
 *
 * Rows captured while capture was on can be left at `pending` or `capturing` forever after it
 * is switched off — nothing will ever advance them. Showing those as disabled keeps the grid
 * from spinning indefinitely on a deployment that will never produce a screenshot.
 */
export function displayCaptureStatus(
  status: 'pending' | 'capturing' | 'ready' | 'failed' | 'disabled',
  captureEnabled: boolean,
): 'pending' | 'capturing' | 'ready' | 'failed' | 'disabled' {
  if (captureEnabled) return status;
  return status === 'ready' ? 'ready' : 'disabled';
}
