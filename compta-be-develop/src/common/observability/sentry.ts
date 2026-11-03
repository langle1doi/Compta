import * as Sentry from '@sentry/node';

const CONNECTION_STRING = /\b[a-z][a-z0-9+.-]*:\/\/[^\s/@]+:[^\s/@]+@\S+/gi;

export const scrubText = (text: string) => text.replace(CONNECTION_STRING, '[connection string]');

/** Optional: without SENTRY_DSN nothing leaves the process. Requests stay out: headers and bodies hold tokens and passwords. */
export function initSentry(dsn: string | undefined, environment: string) {
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend(event) {
      delete event.request;
      delete event.user;
      delete event.breadcrumbs;
      for (const value of event.exception?.values ?? []) {
        if (value.value) value.value = scrubText(value.value);
      }
      if (event.message) event.message = scrubText(event.message);
      return event;
    },
  });
}

export function captureServerError(error: unknown, requestId?: string) {
  if (!Sentry.isInitialized()) return;
  Sentry.captureException(error, { tags: { request_id: requestId } });
}
