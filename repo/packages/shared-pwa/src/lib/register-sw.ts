/**
 * registerServiceWorker -- idempotent SW registration helper
 * Reference: task-1.4.9 Sprint 4 Phase 1
 */

export interface RegisterServiceWorkerOptions {
  scope?: string | undefined;
  onUpdate?: ((registration: ServiceWorkerRegistration) => void) | undefined;
  onSuccess?: ((registration: ServiceWorkerRegistration) => void) | undefined;
  onError?: ((error: Error) => void) | undefined;
}

export async function registerServiceWorker(
  swPath: string,
  options: RegisterServiceWorkerOptions = {},
): Promise<ServiceWorkerRegistration | null> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  const { scope = '/', onUpdate, onSuccess, onError } = options;

  try {
    const existing = await navigator.serviceWorker.getRegistration(scope);
    const registration =
      existing ?? (await navigator.serviceWorker.register(swPath, { scope }));

    if (registration.waiting) {
      onUpdate?.(registration);
    }

    registration.addEventListener('updatefound', () => {
      const installing = registration.installing;
      if (!installing) return;
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            onUpdate?.(registration);
          } else {
            onSuccess?.(registration);
          }
        }
      });
    });

    if (!navigator.serviceWorker.controller && registration.active) {
      onSuccess?.(registration);
    }
    return registration;
  } catch (err) {
    onError?.(err instanceof Error ? err : new Error(String(err)));
    return null;
  }
}
