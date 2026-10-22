import type { MediaFile } from "./media";

export interface CatalogOption {
    id: string;
    label: string;
    designId?: string;
    sceneUrl: string;
    sceneSha256: string;
}

export interface CatalogItem {
    id: string;
    name: string;
    categoryId: string;
    characterId?: string;
    costumeId?: string;
    thumbnail?: MediaFile;
    options: CatalogOption[];
}

export interface ViewerCatalog {
    schemaVersion: 1;
    revision: string;
    categories: Array<{ id: string; label: string }>;
    items: CatalogItem[];
}
