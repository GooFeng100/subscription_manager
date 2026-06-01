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

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: "/", redirect: "/dashboard" },
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
