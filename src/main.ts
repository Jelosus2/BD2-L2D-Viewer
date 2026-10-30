import "./assets/main.css";

import { createApp, defineAsyncComponent } from "vue";
import { createPinia } from "pinia";
import { useCharacterStore } from "@/stores/characterStore";
import { applyUrlParams } from "@/utils/urlSync";
import App from "./App.vue";

const pinia = createPinia();
const store = useCharacterStore(pinia);
applyUrlParams(store, window.location.search);

const preview = import.meta.env.DEV ? new URLSearchParams(window.location.search).get("preview") : null;
const rootComponent = preview === "spine"
    ? defineAsyncComponent(() => import("./components/SpinePreview.vue"))
    : preview === "cutscene"
        ? defineAsyncComponent(() => import("./components/CutscenePreview.vue"))
        : App;

const app = createApp(rootComponent);
app.use(pinia);
app.mount("#app");
