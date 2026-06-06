import { api } from "./api";

export type PublicConfig = {
  appBaseUrl: string;
  nodeEnv: string;
  turnstileEnabled: boolean;
  turnstileSiteKey: string;
  turnstileLoginEnabled: boolean;
  turnstileRegisterEnabled: boolean;
};

export function getPublicConfig() {
  return api<PublicConfig>("/config");
}
