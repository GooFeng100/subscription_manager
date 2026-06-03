import { createApp } from "vue";
import { createPinia } from "pinia";
import { router } from "./router";
import App from "./App.vue";
import faviconUrl from "./assets/icons/mark.png";

const existingFavicon = document.querySelector("link[rel='icon']");
if (existingFavicon) {
  existingFavicon.setAttribute("href", faviconUrl);
  existingFavicon.setAttribute("type", "image/png");
} else {
  const link = document.createElement("link");
  link.rel = "icon";
  link.type = "image/png";
  link.href = faviconUrl;
  document.head.appendChild(link);
}

createApp(App).use(createPinia()).use(router).mount("#app");
