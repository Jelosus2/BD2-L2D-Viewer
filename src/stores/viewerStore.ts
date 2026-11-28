import { defineStore } from "pinia";

export const useViewerStore = defineStore("viewer", {
    state: () => ({
        selectedId: "",
        mode: "character" as "character" | "ultimate",
        ultimateId: "",
        animation: "",
        skin: "",
        playing: true,
        speed: 1
    }),
    actions: {
        select(id: string) {
            if (this.selectedId === id)
                return;

            this.$patch({
                selectedId: id,
                mode: "character",
                ultimateId: "",
                animation: "",
                skin: "",
                playing: true
            });
        }
    }
});
