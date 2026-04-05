import log from './log';

import { registerSW } from 'virtual:pwa-register';

/**
 * The `BeforeInstallPromptEvent` is fired at the `Window.onbeforeinstallprompt` handler
 * before a user is prompted to "install" a web site to a home screen on mobile.
 */
interface BeforeInstallPromptEvent extends Event {
    /**
     * Returns an array of `DOMString` items containing the platforms on which the event was
     * dispatched. This is provided for user agents that want to present a choice of versions
     * to the user such as, for example, "web" or "play" which would allow the user to chose
     * between a web version or an Android version.
     */
    readonly platforms: string[];

    /**
     * Returns a `Promise` that resolves to a `DOMString`
     * containing either "accepted" or "dismissed".
     */
    readonly userChoice: Promise<{
        outcome: 'accepted' | 'dismissed';
        platform: string;
    }>;

    /**
     * Allows a developer to show the install prompt at a time of their own choosing.
     * This method returns a Promise.
     */
    prompt(): Promise<void>;
}
declare global {
    interface WindowEventMap {
        beforeinstallprompt: BeforeInstallPromptEvent;
    }
}

let deferredPrompt: BeforeInstallPromptEvent | null;

function sanitizeNamespacePart(value: string | number | boolean | undefined): string {
    return (
        String(value ?? 'none')
            .trim()
            .toLowerCase()
            .replace(/[^\da-z]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'none'
    );
}

function getEnvironmentNamespace(): string {
    return [globalConfig.hub, globalConfig.host, globalConfig.port, globalConfig.serverId]
        .map((value) => sanitizeNamespacePart(value))
        .join('__');
}

function getPromptedKey(): string {
    return `prompted:${getEnvironmentNamespace()}`;
}

function isLocalEnvironment(): boolean {
    return ['localhost', '127.0.0.1', '::1'].includes(window.location.hostname);
}

async function clearLocalServiceWorkerState(): Promise<void> {
    let registrations = await navigator.serviceWorker.getRegistrations();

    await Promise.all(registrations.map((registration) => registration.unregister()));

    if ('caches' in window) {
        let cacheKeys = await window.caches.keys();

        await Promise.all(cacheKeys.map((cacheKey) => window.caches.delete(cacheKey)));
    }
}

export default async function install(): Promise<void> {
    if (!deferredPrompt || isLocalEnvironment()) return;

    let promptedKey = getPromptedKey();

    if (localStorage.getItem(promptedKey) !== 'true')
        await deferredPrompt.prompt().catch((error: Error) => log.error('[SW ERROR]', error));

    let { outcome } = await deferredPrompt.userChoice;

    localStorage.setItem(promptedKey, 'true');
    if (outcome === 'accepted') {
        // PWA has been installed
    }
    // User chose not to install PWA
    else;

    deferredPrompt = null;
}

async function init(): Promise<void> {
    if (isLocalEnvironment()) {
        await clearLocalServiceWorkerState().catch((error: Error) =>
            log.error('[SW ERROR]', error)
        );

        return;
    }

    window.addEventListener('beforeinstallprompt', (event) => {
        // Prevent Chrome 67 and earlier from automatically showing the prompt.
        event.preventDefault();

        deferredPrompt = event;
    });

    registerSW({ immediate: true });
}

// Check compatibility for the browser and environment we're running this in.
if (import.meta.env.PROD && 'serviceWorker' in navigator) void init();
