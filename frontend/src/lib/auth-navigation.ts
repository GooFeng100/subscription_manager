import { clearBootMeCache } from "./auth-cache";

export type AuthUserType = "admin" | "user";

export function getHomePath(userType?: AuthUserType, dashboard?: string) {
  if (userType === "admin") {
    return dashboard || "/admin/users";
  }
  if (userType === "user") {
    return dashboard || "/dashboard";
  }
  return "/login";
}

export function redirectToLogin() {
  clearBootMeCache();
  if (window.location.pathname !== "/login") {
    window.location.replace("/login");
  }
}
