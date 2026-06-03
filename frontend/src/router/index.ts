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
import { setBootMeCache } from "../lib/auth-cache";

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

const publicPaths = new Set(["/login", "/register"]);

router.beforeEach(async (to) => {
  if (to.path === "/") {
    return { path: "/login" };
  }

  if (publicPaths.has(to.path)) {
    // Public pages should not trigger /api/auth/me on forced refresh,
    // avoiding unnecessary 401 noise in browser console.
    return true;
  }

  let me: { userType: "admin" | "user"; dashboard: string } | null = null;
  try {
    const resp = await fetch("/api/auth/me", { credentials: "include" });
    if (resp.ok) {
      me = (await resp.json()) as { userType: "admin" | "user"; dashboard: string; sub_version?: string | null };
      setBootMeCache(me);
    }
  } catch {
    me = null;
  }

  if (!me) {
    return "/login";
  }

  if (to.path === "/rotation") {
    return me.userType === "admin" ? "/admin/rotation" : "/dashboard";
  }

  if (to.path === "/admin") {
    return "/admin/users";
  }

  if (to.path.startsWith("/admin") && me.userType !== "admin") {
    return "/dashboard";
  }
  if (!to.path.startsWith("/admin") && me.userType === "admin") {
    return "/admin/users";
  }

  return true;
});
