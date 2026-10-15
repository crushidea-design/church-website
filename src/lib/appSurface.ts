/** The marker is added only to the RAAH Hosting build, never from URL input.
 * This selects the UI; authentication and server permissions remain mandatory.
 */
export function isRaahSurface(hostname: string, surface?: string): boolean {
  return hostname === 'raah.builttogether.church' || surface === 'raah';
}

export function isRaahSubdomain(): boolean {
  if (typeof window === 'undefined') return false;
  return isRaahSurface(window.location.hostname, document.documentElement.dataset.appSurface);
}
