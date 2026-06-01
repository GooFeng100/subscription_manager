import { createRouter, createWebHistory } from "vue-router";
import RegisterPage from "../pages/RegisterPage.vue";
import LoginPage from "../pages/LoginPage.vue";
import DashboardPage from "../pages/DashboardPage.vue";
import RedeemPage from "../pages/RedeemPage.vue";
import PasswordPage from "../pages/PasswordPage.vue";
import HelpPage from "../pages/HelpPage.vue";
import RotationPage from "../pages/RotationPage.vue";

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
    { path: "/rotation", component: RotationPage }
  ]
});
