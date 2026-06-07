import { createRouter, createWebHistory } from "vue-router";
import RegisterPage from "../pages/RegisterPage.vue";
import LoginPage from "../pages/LoginPage.vue";
import DashboardPage from "../pages/DashboardPage.vue";
import RedeemPage from "../pages/RedeemPage.vue";
import PasswordPage from "../pages/PasswordPage.vue";
import HelpPage from "../pages/HelpPage.vue";
import RotationPage from "../pages/RotationPage.vue";
import AdminUsersPage from "../pages/AdminUsersPage.vue";
import AdminCodesPage from "../pages/AdminCodesPage.vue";
import AdminUpstreamsPage from "../pages/AdminUpstreamsPage.vue";
import AdminRotationPage from "../pages/AdminRotationPage.vue";
import AdminSettingsPage from "../pages/AdminSettingsPage.vue";
import AdminLogsPage from "../pages/AdminLogsPage.vue";
import { setBootMeCache, takeBootMeCache } from "../lib/auth-cache";
import { getHomePath, redirectToLogin } from "../lib/auth-navigation";

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/login" },
    { path: "/register", component: RegisterPage },
    { path: "/login", component: LoginPage },
    { path: "/dashboard", component: DashboardPage },
    { path: "/redeem", component: RedeemPage },
    { path: "/password", component: PasswordPage },
    { path: "/help", component: HelpPage },
    { path: "/rotation", component: RotationPage },
    { path: "/admin/users", component: AdminUsersPage },
    { path: "/admin/codes", component: AdminCodesPage },
    { path: "/admin/upstreams", component: AdminUpstreamsPage },
    { path: "/admin/rotation", component: AdminRotationPage },
    { path: "/admin/settings", component: AdminSettingsPage },
    { path: "/admin/logs", component: AdminLogsPage }
  ]
});

const publicPaths = new Set(["/login", "/register", "/help"]);
type Me = {
  userType?: "admin" | "user";
  dashboard?: string;
  username?: string;
  status?: string;
  expire_at?: string | null;
  disable_after?: string | null;
  sub_token?: string | null;
  sub_version?: string | null;
};

function clearAuthAndLogin() {
  setBootMeCache(null);
  redirectToLogin();
  return false;
}

router.beforeEach(async (to) => {
  if (to.path === "/") {
    return { path: "/login" };
  }

  if (publicPaths.has(to.path)) {
    const cached = takeBootMeCache();
    if (cached?.userType) {
      return getHomePath(cached.userType, cached.dashboard);
    }
    return true;
  }

  const cached = takeBootMeCache();
  let me: Me | null = cached ? { ...cached } : null;
  try {
    if (!me) {
      const resp = await fetch("/api/auth/me", { credentials: "include" });
      if (resp.status === 401) {
        return clearAuthAndLogin();
      }
      if (!resp.ok) {
        return clearAuthAndLogin();
      }
      me = (await resp.json()) as Me;
    }
  } catch {
    return clearAuthAndLogin();
  }

  if (!me?.userType) {
    return clearAuthAndLogin();
  }
  setBootMeCache(me as Me & { userType: "admin" | "user"; dashboard: string });

  if (to.path === "/rotation") {
    return me.userType === "admin" ? "/admin/rotation" : "/dashboard";
  }

  if (to.path === "/admin") {
    return "/admin/users";
  }

  if (to.path.startsWith("/admin") && me.userType !== "admin") {
    return "/dashboard";
  }
  if (to.path === "/dashboard" && me.userType !== "user") {
    return "/admin/users";
  }
  if (!to.path.startsWith("/admin") && me.userType === "admin") {
    return "/admin/users";
  }

  return true;
});
