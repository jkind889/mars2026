export const DEFAULT_AUTH_RETURN_TO = "/";

const APP_ORIGIN = "https://mars.local";

export function safeReturnTo(returnTo?: unknown, allowedOrigin?: string) {
  if (
    typeof returnTo !== "string" ||
    returnTo.startsWith("//") ||
    returnTo.includes("\\")
  ) {
    return DEFAULT_AUTH_RETURN_TO;
  }

  try {
    const baseOrigin = allowedOrigin
      ? new URL(allowedOrigin).origin
      : APP_ORIGIN;

    if (!returnTo.startsWith("/") && !allowedOrigin) {
      return DEFAULT_AUTH_RETURN_TO;
    }

    const destination = new URL(returnTo, baseOrigin);

    if (destination.origin !== baseOrigin) {
      return DEFAULT_AUTH_RETURN_TO;
    }

    return `${destination.pathname}${destination.search}${destination.hash}`;
  } catch {
    return DEFAULT_AUTH_RETURN_TO;
  }
}

export function returnToForRequest(pathname: string, search = "") {
  return safeReturnTo(`${pathname}${search}`);
}
