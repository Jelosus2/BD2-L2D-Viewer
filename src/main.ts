import "./assets/main.css";

import { createApp, defineAsyncComponent } from "vue";
import { createPinia } from "pinia";
import App from "./App.vue";

const params = new URLSearchParams(window.location.search);
const preview = import.meta.env.DEV ? params.get("preview") : null;

const rootComponent = preview === "spine"
    ? defineAsyncComponent(() => import("./components/SpinePreview.vue"))
    : preview === "cutscene"
        ? defineAsyncComponent(() => import("./components/CutscenePreview.vue"))
        : App;

createApp(rootComponent).use(createPinia()).mount("#app");
