export type CutsceneAnim = string | { name: string; offset?: number; source?: string; skin?: string; hold?: boolean }
export type CutsceneComposite = (CutsceneAnim | CutsceneAnim[])[]
export type CutsceneCompositeDefinition = {
  name?: string
  composite?: CutsceneComposite
  animations?: CutsceneComposite
}
export type CutsceneCompositeEntry = CutsceneComposite | CutsceneCompositeDefinition | CutsceneCompositeDefinition[]

const cutsceneComposites: Record<string, CutsceneCompositeEntry> = {
  "067803": [
    {
      name: "cut_A_all",
      composite: [[
        "cut_A_B_Arm",
        "cut_A",
        { name: "cut_A_B", source: "cutscene/glow/cutscene_char067803_1" },
        { name: "cut_A_F", source: "cutscene/glow/cutscene_char067803_1" }
      ]]
    },
    {
      name: "cut_B_all",
      composite: [[
        "cut_B_Ponytail",
        "cut_B_Body",
        "cut_B_Head",
        { name: "cut_B_B", source: "cutscene/glow/cutscene_char067803_1" },
        { name: "cut_B_Body", source: "cutscene/glow/cutscene_char067803_1" },
        { name: "cut_B_Head", source: "cutscene/glow/cutscene_char067803_1" }
      ]]
    }
  ],
  "000396": [
    {
      name: "cut_B_all",
      composite: [[
        "cut_B_button",
        "cut_B"
      ]]
    },
    {
      name: "loop_2_all",
      composite: [[
        "loop_2_button",
        "loop_2"
      ]]
    }
  ],
  "004091": [
    {
      name: "A_cut_all",
      composite: [[
        "A_cut",
        "A_cut_hair",
        { name: "A_cut_tera_head", source: "cutscene/tera/cutscene_char004091_1" },
        { name: "A_cut_tera", source: "cutscene/tera/cutscene_char004091_1" }
      ]]
    },
    {
      name: "B_cut_all",
      composite: [[
        "B_cut_bg_back",
        "B_cut",
        "B_cut_bg_front"
      ]]
    }
  ],
  "004301": [
    {
      name: "B_cut_all",
      composite: [[
        "B_cut_Belt",
        "B_cut"
      ]]
    },
    {
      name: "loop_2_all",
      composite: [[
        "loop_2_Belt",
        "loop_2"
      ]]
    }
  ],
  "067491": [
    {
      name: "A_cut_all",
      composite: [[
        "A_cut",
        "A_cut_w1",
        "A_cut_w2"
      ]]
    },
    {
      name: "B_cut_all",
      composite: [[
        "panties_white",
        { name: "panties_black", hold: true },
        "B_cut"
      ]]
    }
  ],
  "000296": [
    {
      name: "cut/cut_B_all",
      composite: [[
        "cut/cut_B",
        "cut/cut_B_water"
      ]]
    }
  ],
  "067104": [
    {
      name: "cut_A_all",
      composite: [[
        "cut_A_front_body",
        "cut_A",
        "cut_A_front_arm",
        { name: "cut_A_curtain", hold: true }
      ]]
    },
    {
      name: "cut_A_all/no-curtain",
      composite: [[
        "cut_A_front_body",
        "cut_A",
        "cut_A_front_arm"
      ]]
    }
  ],
  "003392": [
    {
      name: "cut_A_all",
      composite: [[
        "cut_A_slot",
        "cut_A_light",
        "cut_A_ch"
      ]]
    },
    {
      name: "loop_1_all",
      composite: [[
        "loop_1_slot",
        "loop_1_light",
        "loop_1_ch"
      ]]
    }
  ]
}

export default cutsceneComposites
