import { defineStore } from 'pinia'
import character_list from '@/utils/character_list'

type AnimationCategory = 'character' | 'ultimate' | 'dating'
export interface Character {
  id: string
  charName: string
  costumeName: string
  spine: string
  cutscene: string
  dating: string
  icon: string,
  datingHasNoBg?: boolean,
  datingUsesTracks?: boolean,
  customFiles?: {
    skel?: string,
    json?: string,
    atlas: string,
    images: Record<string, string>
  }
}

const characterArray: Character[] = Object.entries(character_list).map(([id, char]) => ({
  id,
  datingHasNoBg: true,
  datingUsesTracks: false,
  icon: id,
  ...char,
}))

export const useCharacterStore = defineStore('characterStore', {
  state: () => ({
    characters: characterArray as Character[],
    selectedCharacterId: characterArray.length ? characterArray[0].id : '',
    selectedAnimation: '',
    selectedSkin: '',
    animationCategory: 'character' as AnimationCategory,
    playing: true,
    animationSpeed: 1,
    backgroundColor: '#1f2937',
    useCurrentCamera: false,
    showDatingBg: true,
    customBackgroundImage: null as string | null,
    layerNames: [] as string[],
    layerVisibility: {} as Record<string, boolean>,
    layerSelectionEnabled: false as boolean,
    selectedLayerName: null as string | null,
    hiddenLayerStack: [] as string[],
  }),
})
