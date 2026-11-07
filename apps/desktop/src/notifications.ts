/**
 * APEX Real Mobile & Desktop Notification Service
 * Supports:
 * 1. Mobile Lock-Screen & Status-Bar Notifications via ServiceWorker
 * 2. Fallback to native Web Notifications API
 * 3. Haptic Device Vibration for mobile devices
 * 4. Synthesized Audio Alert Chime via Web Audio API (Zero external assets needed)
 */

let swRegistration: ServiceWorkerRegistration | null = null;

// Initialize & register the Service Worker
export async function registerNotificationServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }

  try {
    const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    swRegistration = reg;
    return reg;
  } catch (err) {
    console.warn('[Notifications] ServiceWorker registration failed:', err);
    return null;
  }
}

// Check if browser/mobile device supports notifications
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// Get current permission status ('granted' | 'denied' | 'default')
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

// Request permission from the user
export async function requestNotificationPermission(): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  try {
    const result = await Notification.requestPermission();
    if (result === 'granted') {
      await registerNotificationServiceWorker();
      return true;
    }
    return false;
  } catch (err) {
    console.warn('[Notifications] Error requesting permission:', err);
    return false;
  }
}

// Synthesized Alert Sound via Web Audio API (Crystal-clear dual-tone alarm)
export function playAlertChime() {
  if (typeof window === 'undefined') return;

  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    // Tone 1 (High Alert)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(880, now); // A5
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(now);
    osc1.stop(now + 0.15);

    // Tone 2 (Higher Confirmation Alert)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(1174.66, now + 0.18); // D6
    gain2.gain.setValueAtTime(0.35, now + 0.18);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(now + 0.18);
    osc2.stop(now + 0.45);
  } catch (err) {
    console.warn('[Notifications] Could not play alert sound:', err);
  }
}

// Device Haptic Vibration (Works on Android & supported mobile browsers)
export function triggerHapticVibration() {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    try {
      // 3 pulses: Buzz - pause - Buzz - pause - Long Buzz
      navigator.vibrate([250, 100, 250, 100, 450]);
    } catch {
      // Ignore vibration errors if blocked
    }
  }
}

export interface DeviceNotificationOptions {
  body: string;
  tag?: string;
  url?: string;
  severity?: string;
  silent?: boolean;
}

/**
 * Fires a REAL system notification on mobile phone or desktop
 */
export async function sendDeviceNotification(
  title: string,
  options: DeviceNotificationOptions
): Promise<boolean> {
  if (!isNotificationSupported()) return false;

  // Always play audible and haptic feedback
  if (!options.silent) {
    playAlertChime();
    triggerHapticVibration();
  }

  // If not granted, can't show system banner
  if (Notification.permission !== 'granted') {
    return false;
  }

  const notifOptions = {
    body: options.body,
    icon: '/icon-192.svg',
    badge: '/icon-192.svg',
    tag: options.tag || 'apex-incident',
    renotify: true,
    requireInteraction: true,
    data: {
      url: options.url || (typeof window !== 'undefined' ? window.location.href : '/'),
      severity: options.severity || 'high',
      timestamp: Date.now()
    }
  };

  try {
    // 1. Try via Service Worker (REQUIRED on Android & iOS 16.4+ mobile status bar)
    if (swRegistration && 'showNotification' in swRegistration) {
      await swRegistration.showNotification(title, notifOptions);
      return true;
    }

    // 2. Try retrieving active registration
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.ready;
      if (reg && 'showNotification' in reg) {
        swRegistration = reg;
        await reg.showNotification(title, notifOptions);
        return true;
      }
    }

    // 3. Fallback to window Notification constructor
    new Notification(title, notifOptions);
    return true;
  } catch (err) {
    console.warn('[Notifications] Failed to display notification:', err);
    // Still fallback to browser Notification if possible
    try {
      new Notification(title, notifOptions);
      return true;
    } catch {
      return false;
    }
  }
}
