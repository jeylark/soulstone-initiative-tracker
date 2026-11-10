export type { DeepReadonly } from './DeepReadonly';
export { theme } from './theme.svelte';
export type { LiveSessionCredential, LiveSessionDescriptor } from './live-session-client';
export {
	joinLiveSession,
	LiveSessionRequestError,
	createLiveSession,
	deleteLiveSessionCredential,
	endLiveSession,
	loadLiveSessionCredential,
	regenerateViewerCode,
	resumeLiveSession,
	saveLiveSessionCredential,
	updateLiveSession
} from './live-session-client';
