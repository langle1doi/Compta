import type { SecuritySettingsConfig } from "../types";

export const mockSecuritySettings: SecuritySettingsConfig = {
  totpEnabled: true,
  email2faEnabled: false,
  googleSso: "connected",
  microsoftSso: "not_configured",
  failedLoginLockout: 5,
  preferredLanguage: "fr",
};
