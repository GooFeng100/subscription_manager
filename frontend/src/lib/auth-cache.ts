type MeBrief = {
  userType: "admin" | "user";
  dashboard: string;
  username?: string;
  status?: string;
  expire_at?: string | null;
  disable_after?: string | null;
  sub_token?: string | null;
  sub_version?: string | null;
};

let bootMeCache: MeBrief | null = null;

export function setBootMeCache(me: MeBrief | null) {
  bootMeCache = me;
}

export function takeBootMeCache() {
  const value = bootMeCache;
  bootMeCache = null;
  return value;
}
