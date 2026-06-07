import { api } from "./api";

export type PublicConfig = {
  appBaseUrl: string;
  nodeEnv: string;
};

export function getPublicConfig() {
  return api<PublicConfig>("/config");
}
