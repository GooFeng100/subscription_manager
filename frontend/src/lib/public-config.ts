import { api } from "./api";

export type PublicConfig = {
  appBaseUrl: string;
  nodeEnv: string;
  turnstileEnabled: boolean;
  turnstileSiteKey: string;
};

export function getPublicConfig() {
  return api<PublicConfig>("/config");
}
