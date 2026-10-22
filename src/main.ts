import "./assets/main.css";

import { createApp, defineAsyncComponent } from "vue";
import { createPinia } from "pinia";
import { useCharacterStore } from "@/stores/characterStore";
import { applyUrlParams } from "@/utils/urlSync";
import App from "./App.vue";

const pinia = createPinia();
const store = useCharacterStore(pinia);
applyUrlParams(store, window.location.search);

const showPreview = import.meta.env.DEV && new URLSearchParams(window.location.search).get("preview") === "spine";
const rootComponent = showPreview
    ? defineAsyncComponent(() => import("./components/SpinePreview.vue"))
    : App;

const app = createApp(rootComponent);
app.use(pinia);
app.mount("#app");
