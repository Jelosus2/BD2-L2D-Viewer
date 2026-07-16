export type CutsceneAnim = string | {
  name: string
  offset?: number
  source?: string
  skin?: string
  hold?: boolean
  playDuration?: number
  /** Lower values render first (behind); equal or omitted values preserve array order. */
  layerOrder?: number
  loop?: boolean
}
export type CutsceneComposite = (CutsceneAnim | CutsceneAnim[])[]
export type CutsceneCompositeDefinition = {
  name?: string
  composite?: CutsceneComposite
  animations?: CutsceneComposite
}
export type CutsceneCompositeEntry = CutsceneComposite | CutsceneCompositeDefinition | CutsceneCompositeDefinition[]

const cutsceneComposites: Record<string, CutsceneCompositeEntry> = {
  "103301": [
    {
      name: "cut_all",
      composite: ["cut_1", "cut_2", "cut_3"]
    }
  ],
  "103201": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_2", playDuration: 1 },
        { name: "cut_1", playDuration: 1 },
        "cut_3"
      ]
    }
  ],
  "103401": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 1.2 },
        { name: "cut_2", playDuration: 0.5 },
        "cut_3"
      ]
    }
  ],
  "100501": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 0.6 },
        { name: "cut_2", playDuration: 0.4 },
        { name: "cut_3", playDuration: 0.7 },
        { name: "cut_4", playDuration: 0.7 }
      ]
    }
  ],
  "103501": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 1 },
        { name: "cut_2", playDuration: 0.9 },
        { name: "cut_3", playDuration: 0.7 }
      ]
    }
  ],
  "000101": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 0.7 },
        { name: "cut_2", playDuration: 1 },
        { name: "cut_3", playDuration: 1 }
      ]
    }
  ],
  "000202": [
    {
      name: "cut_all",
      composite: [
        "cut_1",
        { name: "cut_3", playDuration: 1 },
        { name: "cut_4", playDuration: 1 },
        { name: "cut_5", playDuration: 1 }
      ]
    }
  ],
  "000301": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 1 },
        { name: "cut_2", playDuration: 0.4 },
        { name: "cut_3", playDuration: 0.4 },
        { name: "cut_4", playDuration: 0.8 }
      ]
    }
  ],
  "000401": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 1.2 },
        { name: "cut_2", playDuration: 0.4 },
        { name: "cut_3", playDuration: 1 }
      ]
    }
  ],
  "000204": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 0.7 },
        { name: "cut_1_act", playDuration: 0.15 },
        { name: "cut_2", playDuration: 0.8 },
        { name: "cut_3", playDuration: 1.2 }
      ]
    }
  ],
  "000304": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 0.7 },
        { name: "cut_2", playDuration: 0.6 },
        { name: "cut_3", playDuration: 0.6 },
        { name: "cut_4", playDuration: 1 }
      ]
    }
  ],
  "101102": [
    {
      name: "cut_all",
      composite: [
        { name: "1_cut", playDuration: 1.1 },
        { name: "2_cut", playDuration: 1.1 },
        { name: "3_cut", playDuration: 1 }
      ]
    }
  ],
  "000206": [
    {
      name: "cut_all",
      composite: [
        "1_cut", "1_cut",
        "2_cut",
        { name: "3_cut", playDuration: 1 }
      ]
    }
  ],
  "000306": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 2.8 },
        { name: "cut_2", playDuration: 1.5 }
      ]
    }
  ],
  "066402": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 0.9 },
        { name: "cut_2", playDuration: 0.7 },
        { name: "cut_3", playDuration: 0.8 }
      ]
    }
  ],
  "001004": [
    {
      name: "B_cut_all",
      composite: [["B_cut_02", "B_cut_01"]]
    },
    {
      name: "cut_all",
      composite: ["A_cut", "B_cut_all", "C_cut"]
    }
  ],
  "000804": [
    {
      name: "cut_all",
      composite: [
        "cut_1",
        "cut_2",
        "cut_3",
        { name: "cut_4", playDuration: 1 }
      ]
    }
  ],
  "060501": [
    {
      name: "cut_all",
      composite: [
        "A_cut",
        { name: "B_cut", playDuration: 0.5 },
        { name: "C_cut", playDuration: 0.5 },
        { name: "D_cut_2", playDuration: 1.5 }
      ]
    }
  ],
  "060502": [
    {
      name: "cut_all",
      composite: ["A_cut", "B_cut_idle", "C_cut_idle"]
    }
  ],
  "001206": [
    {
      name: "cut_all",
      composite: ["A_cut", "B_cut", "C_cut"]
    }
  ],
  "066403": [
    {
      name: "cut_all",
      composite: ["cut_1", "cut_2", "cut_3"]
    }
  ],
  "000502": [
    {
      name: "cut_all",
      composite: [
        "cut_1",
        { name: "cut_2", playDuration: 0.5 },
        ["cut_3", "cut_4"]
      ]
    }
  ],
  "067002": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 1.4 },
        { name: "cut_2", playDuration: 1 },
        "cut_3"
      ]
    }
  ],
  "061402": [
    {
      name: "cut_A_all",
      composite: ["cut_A_1", "cut_A_2"]
    },
    {
      name: "cut_B_all",
      composite: [
        "cut_B_1",
        { name: "cut_B_2", playDuration: 1.7 }
      ]
    },
    {
      name: "cut_all",
      composite: [
        "cut_A_all",
        ["cut_B_all", { name: "cut_C_1_mix", offset: 1.5 }, { name: "cut_C_2_clear", offset: 2.5 }]
      ]
    }
  ],
  "000103": [
    {
      name: "cut_all",
      composite: ["cut_1", "cut_3"]
    }
  ],
  "002401": [
    {
      name: "cut_all",
      composite: [
        "cut_1",
        { name: "cut_2", playDuration: 2.5 },
        { name: "cut_3_no_paper", playDuration: 1.5 }
      ]
    }
  ],
  "060602": [
    {
      name: "cut_all",
      composite: [
        "cut_A_all",
        "cut_B",
        { name: "cut_C", playDuration: 2 }
      ]
    }
  ],
  "000604": [
    {
      name: "cut_3_all",
      composite: [["cut_3_dragon_head", "cut_3_dragon_breath", "cut_3_dragon_body_balck"]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "cut_1", playDuration: 2 },
        ["cut_3_dragon_head", "cut_3_dragon_breath", { name: "cut_1_idle_02", playDuration: 4 }, "cut_3_dragon_body_balck"]
      ]
    }
  ],
  "001002": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 1.5 },
        [
          "cut_B_all",
          { name: "cut_weapon_1", playDuration: 0.7, offset: 1 },
          { name: "cut_weapon_2", playDuration: 0.7, offset: 1 },
          { name: "cut_weapon_3", offset: 2 }
        ]
      ]
    }
  ],
  "065102": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_1_grass", playDuration: 1.5 },
        { name: "cut_1", playDuration: 1.5 },
        "cut_2",
        "cut_3"
      ]
    }
  ],
  "061302": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B", "cut_C"]
    }
  ],
  "065802": [
    {
      name: "cut_A_all",
      composite: [
        "A_cut_1",
        { name: "A_cut_2", playDuration: 0.5 }
      ]
    },
    {
      name: "cut_B_all",
      composite: [
        "B_cut",
        { name: "B_cut_idle", playDuration: 1 }
      ]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B_all"]
    }
  ],
  "000706": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B"]
    }
  ],
  "000506": [
    {
      name: "cut_D_all",
      composite: [[
        { name: "D_cut", playDuration: 1.2 },
        { name: "D_cut_glass", playDuration: 1.2 }
      ]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "A_cut", playDuration: 2 },
        { name: "B_cut", playDuration: 1.7 },
        "C_cut",
        "cut_D_all"
      ]
    }
  ],
  "060403": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "cut_A", playDuration: 2.81 },
        { name: "cut_A_tray", offset: 2.6, playDuration: 0.2 }
      ]]
    },
    {
      name: "cut_all",
      composite: [
        "cut_A_all",
        { name: "cut_B", playDuration: 2 }
      ]
    }
  ],
  "002406": [
    {
      name: "cut_B_all",
      composite: [
        { name: "B_cut_1", playDuration: 2 },
        { name: "B_cut_2", playDuration: 1.2 }
      ]
    },
    {
      name: "cut_all",
      composite: ["A_cut", "cut_B_all"]
    }
  ],
  "000504": [
    {
      name: "cut_AB_all",
      composite: ["cut_A", "cut_B"]
    },
    {
      name: "cut_all",
      composite: [[
        "cut_AB_all",
        { name: "cut_butterfly1", playDuration: 4 },
        { name: "cut_butterfly2", playDuration: 4 },
        { name: "cut_butterfly3", playDuration: 4 },
        { name: "cut_butterfly4", playDuration: 4 },
        { name: "cut_butterfly5", playDuration: 4 },
      ]]
    }
  ],
  "065103": [
    {
      name: "cut_A_all",
      composite: [["cut_A_2", "cut_A_1"]]
    },
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut_B_3_2", playDuration: 2.9 },
        { name: "cut_B_3_1", hold: true, playDuration: 2.9 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B_all", "cut_C"]
    }
  ],
  "067102": [
    {
      name: "cut_all",
      composite: ["A_cut", "B_cut"]
    }
  ],
  "067003": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B"]
    }
  ],
  "001207": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "cut_A", playDuration: 3.1 },
        { name: "towel", offset: 3 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B"]
    }
  ],
  "000806": [
    {
      name: "cut_C_all",
      composite: [[
        "C_cut",
        { name: "C_cut_knife", hold: true }
      ]]
    },
    {
      name: "cut_all",
      composite: ["A_cut", "B_cut", "cut_C_all", "D_cut", "E_cut"]
    }
  ],
  "067101": [
    {
      name: "cut_A_all",
      composite: ["cut_A_1", "cut_A_2"]
    },
    {
      name: "cut_all",
      composite: [
        "cut_A_all",
        { name: "cut_B", playDuration: 2 }
      ]
    }
  ],
  "000203": [
    {
      name: "cut_all",
      composite: [[
        { name: "A_cut" },
        { name: "B_cut", offset: 1.8 },
        { name: "C_cut", offset: 3.2 }
      ]]
    }
  ],
  "001201": [
    {
      name: "cut_all",
      composite: [
        "A_cut",
        ["B_cut", { name: "arrow_all", hold: true }]
      ]
    }
  ],
  "001106": [
    {
      name: "cut_A_all",
      composite: [
        "cut_A_1",
        { name: "cut_A_2", playDuration: 2.5 }
      ]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B"]
    }
  ],
  "066906": [
    {
      name: "cut_all",
      composite: [
        "cut_A",
        { name: "cut_B2", playDuration: 4 }
      ]
    }
  ],
  "060706": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 2 },
        "cut_B",
        "cut_C"
      ]
    }
  ],
  "066802": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B"]
    }
  ],
  "066801": [
    {
      name: "cut_all",
      composite: ["cut_a", "cut_b"]
    }
  ],
  "003201": [
    {
      name: "cut_all",
      composite: ["cut_a", "cut_b", "cut_c"]
    }
  ],
  "061001": [
    {
      name: "cut_AB_all",
      composite: ["A_cut", { name: "B_cut", playDuration: 2 }]
    },
    {
      name: "cut_all",
      composite: [[
        "cut_AB_all",
        { name: "ribbon_1", layerOrder: -1, loop: true },
        { name: "ribbon_2", loop: true },
        { name: "ribbon_3", loop: true },
        { name: "ribbon_4", loop: true }
      ]]
    }
  ],
  "020101": [
    {
      name: "cut_A_all",
      composite: [["cut_A_2", "cut_A_1"]]
    },
    {
      name: "cut_B_all",
      composite: [["cut_B", "water_1", "water_2"]]
    },
    {
      name: "cut_C_all",
      composite: [[
        "cut_C",
        { name: "water_1", loop: true },
        { name: "water_2", loop: true }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B_all", "cut_C_all"]
    }
  ],
  "020102": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "B_cut", playDuration: 4.2 },
        { name: "Rudeus_hand", offset: 3, playDuration: 1.2 }
      ]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "A_cut", playDuration: 4 },
        "cut_B_all"
      ]
    }
  ],
  "020001": [
    {
      name: "cut_all",
      composite: ["A_cut", "B_cut"]
    }
  ],
  "020002": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 3 },
        "cut_B"
      ]
    }
  ],
  "067201": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B"]
    }
  ],
  "061305": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B"]
    }
  ],
  "003302": [
    {
      name: "cut_A_all",
      composite: [[
        "cut_a",
        { name: "bubble_1", layerOrder: -1 },
        { name: "bubble_2", hold: true },
        { name: "bubble_3", hold: true },
        { name: "bubble_4", layerOrder: -1, hold: true },
        { name: "bubble_5", layerOrder: -1, hold: true },
        { name: "bubble_6", layerOrder: -1, hold: true },
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", { name: "cut_b", playDuration: 4.5 }]
    }
  ],
  "003501": [
    {
      name: "cut_C_all",
      composite: [[
        { name: "cut_C", playDuration: 6 },
        { name: "cut_C_sword", playDuration: 4 }
      ]]
    },
    {
      name: "cut_all",
      composite: [
        "cut_A",
        { name: "cut_B", playDuration: 2 },
        "cut_C_all"
      ]
    }
  ],
  "067301": [
    {
      name: "cut_A_all",
      composite: [
        "A_cut",
        { name: "A_cut_3", playDuration: 1 }
      ]
    },
    {
      name: "cut_B_all",
      composite: [[
        { name: "B_cut", playDuration: 3.5 },
        { name: "B_cut_2", offset: 2, playDuration: 1.5 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B_all"]
    }
  ],
  "003202": [
    {
      name: "cut_all",
      composite: [
        "cut_A",
        { name: "cut_B", playDuration: 4.5 }
      ]
    }
  ],
  "000501": [
    {
      name: "cut_all",
      composite: [[
        { name: "cut_A", playDuration: 5 },
        { name: "cut_A_mouse", playDuration: 5 }
      ]]
    }
  ],
  "001107": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B", { name: "cut_C", playDuration: 3 }]
    }
  ],
  "003401": [
    {
      name: "cut_B_all",
      composite: [[
        "b_cut",
        { name: "b_camera", playDuration: 1 },
        { name: "b_fan", offset: 1.8, hold: true },
        { name: "b_ice", offset: 1.8, hold: true }
      ]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "a_cut", playDuration: 3.2 },
        "cut_B_all"
      ]
    }
  ],
  "067401": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut_B", playDuration: 3 },
        { name: "Background", layerOrder: -1, playDuration: 3 },
        { name: "cut_B_Bikini", playDuration: 3 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B_all"]
    }
  ],
  "000707": [
    {
      name: "cut_all",
      composite: ["cut_A", { name: "cut_B", playDuration: 3 }]
    }
  ],
  "003301": [
    {
      name: "cut_all",
      composite: ["cut_a", "cut_b"]
    }
  ],
  "020201": [
    {
      name: "cut_all",
      composite: ["A_cut", "B_cut_All"]
    }
  ],
  "020501": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B_all"]
    }
  ],
  "020301": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut_B", playDuration: 3 },
        { name: "cut_B_cloth_B", offset: 1.2 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B_all"]
    }
  ],
  "020401": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B"]
    }
  ],
  "101101": [
    {
      name: "cut_all",
      composite: [["A_cut", "bat_1", "bat_2", "bat_3", "shadow", "Cat"]]
    }
  ],
  "101103": [
    {
      name: "cut_B_all",
      composite: [["cut_B", "cut_B_shoes"]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 2.5 },
        "cut_B_all"
      ]
    }
  ],
  "067502": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_a", playDuration: 4 },
        { name: "cut_b", playDuration: 2.5 }
      ]
    }
  ],
  "067402": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "a_cut", playDuration: 3.5 },
        { name: "cut_a_paper", playDuration: 3.5 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "b_cut"]
    }
  ],
  "003303": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "B_cut", playDuration: 2.2 },
        { name: "B_soldier", layerOrder: -1, playDuration: 2.2 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["A_cut", "cut_B_all"]
    }
  ],
  "067202": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut_B", playDuration: 5.5 },
        { name: "flower", loop: true }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B_all"]
    }
  ],
  "003402": [
    {
      name: "cut_all",
      composite: ["A_cut", { name: "B_cut", playDuration: 3 }]
    }
  ],
  "003203": [
    {
      name: "cut_A_all",
      composite: [["A_cut", "A_cut_robot"]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "B_cut"]
    }
  ],
  "067303": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 4 },
        "cut_B"
      ]
    }
  ],
  "067503": [
    {
      name: "cut_B_all",
      composite: [["cut_b", "cut_b_ef"]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "cut_a", playDuration: 3 },
        "cut_B_all"
      ]
    }
  ],
  "060801": [
    {
      name: "cut_B_all",
      composite: [["cut_B", { name: "cut_B_curtain", layerOrder: -1 }]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 1.5 },
        "cut_B_all"
      ]
    }
  ],
  "067004": [
    {
      name: "cut_A_all",
      composite: [[
        "A_cut",
        "steam_head",
        { name: "steam_1", loop: true },
        { name: "steam_2", loop: true },
        { name: "steam_3", loop: true }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", { name: "B_cut", playDuration: 3 }]
    }
  ],
  "003802": [
    {
      name: "cut_all",
      composite: ["a_cut", "b_cut"]
    }
  ],
  "003801": [
    {
      name: "cut_all",
      composite: [
        { name: "A_cut", playDuration: 2.2 },
        "B_cut"
      ]
    }
  ],
  "067403": [
    {
      name: "cut_AB_all",
      composite: [
        { name: "cut_A", playDuration: 3.7 },
        { name: "cut_B" }
      ]
    },
    {
      name: "cut_all",
      composite: [[
        "cut_AB_all",
        { name: "curtain", offset: 3.2 }
      ]]
    }
  ],
  "067601": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 3.2 },
        { name: "cut_B", playDuration: 2.5 }
      ]
    }
  ],
  "003403": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut_B", playDuration: 5.5 },
        { name: "cut_B_water", playDuration: 5.5 }
      ]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 4.7 },
        "cut_B_all"
      ]
    }
  ],
  "020601": [
    {
      name: "cut_A_all",
      composite: [["cut_A", { name: "cut_A_BG", layerOrder: -1 }]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", { name: "cut_B", playDuration: 3 }]
    }
  ],
  "020701": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "cut_A", playDuration: 3.51 },
        { name: "go1", playDuration: 3.5 },
        { name: "go2", playDuration: 3.5 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B"]
    }
  ],
  "020801": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "B_cut", playDuration: 3 },
        { name: "B_goblin", hold: true }
      ]]
    },
    {
      name: "cut_all",
      composite: ["A_cut", "cut_B_all"]
    }
  ],
  "020901": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "cut_A", playDuration: 3 },
        { name: "A_go1", layerOrder: -1, playDuration: 3 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", { name: "cut_B", playDuration: 4.5 }]
    }
  ],
  "066803": [
    {
      name: "cut_A_all",
      composite: [[
        "cut_A",
        { name: "A_wave1", layerOrder: -1 },
        "A_wave2"
      ]]
    },
    {
      name: "cut_B_all",
      composite: [[
        "cut_B",
        "B_bubble",
        { name: "B_wave", layerOrder: -1 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B_all"]
    }
  ],
  "067603": [
    {
      name: "cut_A_all",
      composite: [["cut_A", { name: "cut_A_water", layerOrder: -1 }]]
    },
    {
      name: "cut_B_all",
      composite: [["cut_B", { name: "cut_B_water", layerOrder: -1 }]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B_all"]
    }
  ],
  "061404": [
    {
      name: "cut_A_all",
      composite: [["cut_A", { name: "cut_A_water", layerOrder: -1 }]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B"]
    }
  ],
  "000708": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 4 },
        { name: "cut_B", playDuration: 4 }
      ]
    }
  ],
  "000296": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut/cut_B", playDuration: 6.5 },
        { name: "cut/cut_B_water", playDuration: 6.5 }
      ]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "cut/cut_A", playDuration: 4 },
        "cut_B_all"
      ]
    }
  ],
  "003603": [
    {
      name: "cut_all",
      composite: ["cut_A", { name: "cut_B", playDuration: 3 }]
    }
  ],
  "003602": [
    {
      name: "cut_all",
      composite: [
        { name: "A_cut", playDuration: 4 },
        { name: "B_cut", playDuration: 3.5 }
      ]
    }
  ],
  "001006": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 4.5 },
        { name: "cut_B", playDuration: 2.5 }
      ]
    }
  ],
  "000807": [
    {
      name: "cut_A_all",
      composite: [[
        "A_cut",
        { name: "A_cut_sausage", offset: 5 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "B_cut"]
    }
  ],
  "001197": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "cut_A", playDuration: 6.5 },
        "cut_A_camera"
      ]]
    },
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut_B", playDuration: 6.5 },
        { name: "cut_B_back", layerOrder: -1, playDuration: 6.5 },
        { name: "cut_B_seal", playDuration: 6.5 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B_all"]
    }
  ],
  "003901": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "cut_A", playDuration: 6 },
        { name: "cut_A_hand", offset: 3.8 }
      ]]
    },
    {
      name: "cut_B_all",
      composite: [[
        "cut_B",
        { name: "cut_B_shadow1", layerOrder: -1 },
        { name: "cut_B_shadow2_1", layerOrder: -1 },
        "cut_B_shadow2_2"
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B_all"]
    }
  ],
  "004001": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B"]
    }
  ],
  "004101": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_A_2", "cut_B"]
    }
  ],
  "060702": [
    {
      name: "cut_C_all",
      composite: [["cut_C_Rafina", { name: "cut_C_Robot", layerOrder: -1 }]]
    },
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B", "cut_C_all"]
    }
  ],
  "003902": [
    {
      name: "cut_all",
      composite: ["A_cut", { name: "B_cut", playDuration: 5 }]
    }
  ],
  "067103": [
    {
      name: "cut_AB_all",
      composite: ["cut_A", "cut_B"]
    },
    {
      name: "cut_all",
      composite: [[
        "cut_AB_all",
        { name: "curtain", offset: 5 }
      ]]
    }
  ],
  "003601": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 4 },
        { name: "cut_B", playDuration: 3 }
      ]
    }
  ],
  "004002": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 5.5 },
        "cut_B"
      ]
    }
  ],
  "061103": [
    {
      name: "cut_all",
      composite: ["A_cut", { name: "B_cut", playDuration: 4 }]
    }
  ],
  "004102": [
    {
      name: "cut_rabbit_all",
      composite: [["rabbit", "avalanche"]]
    },
    {
      name: "cut_all",
      composite: ["A_cut", "cut_rabbit_all", "B_cut"]
    }
  ],
  "067604": [
    {
      name: "cut_all",
      composite: ["A_cut", "B_cut", { name: "C_cut", playDuration: 2 }]
    }
  ],
  "061492": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 4 },
        { name: "cut_B", playDuration: 5 }
      ]
    }
  ],
  "000201": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "B_cut", playDuration: 2 },
        "wind"
      ]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "A_cut", playDuration: 5 },
        "cut_B_all"
      ]
    }
  ],
  "003702": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "B_cut", playDuration: 3 },
        { name: "egg", playDuration: 3 }
      ]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "A_cut", playDuration: 5 },
        "cut_B_all"
      ]
    }
  ],
  "067701": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut_B", playDuration: 3 },
        { name: "cut_B_cloud", playDuration: 2 },
        "cut_B_amulet",
        "cut_B_glutty"
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B_all"]
    }
  ],
  "067702": [
    {
      name: "cut_all",
      composite: ["A_cut", "B_cut"]
    }
  ],
  "003892": [
    {
      name: "cut_B_all",
      composite: [["cut_B", "cut_B_sound1", "cut_B_sound2", "cut_B_sound3"]]
    },
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B_all"]
    }
  ],
  "002403": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 4.5 },
        "cut_B"
      ]
    }
  ],
  "003604": [
    {
      name: "cut_all",
      composite: [
        { name: "A_cut", playDuration: 4 },
        "B_cut"
      ]
    }
  ],
  "004201": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "cut_A", playDuration: 4.5 },
        { name: "cut_A_candle", playDuration: 4.5 }
      ]]
    },
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut_B", playDuration: 5 },
        { name: "cut_B_candle", playDuration: 5 }
      ]]
    }
  ],
  "067801": [
    {
      name: "cut_B_all",
      composite: [[
        "cut_B",
        { name: "skeleton", layerOrder: -1 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B_all"]
    }
  ],
  "061092": [
    {
      name: "cut_all",
      composite: ["cut_A", "cut_B"]
    }
  ],
  "021001": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut_B", playDuration: 4 },
        { name: "cut_B_cloth", offset: 1.2 }
      ]]
    }
  ],
  "003803": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "cut_A", playDuration: 3.5 },
        { name: "cut_A_fx", playDuration: 3.5 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B"]
    }
  ],
  "004202": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 6 },
        { name: "cut_B", playDuration: 3 }
      ]
    }
  ],
  "067803": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "cut_A", playDuration: 5 },
        { name: "cut_A_B_Arm", layerOrder: -1, playDuration: 5 },
        { name: "cut_A_B", source: "cutscene/glow/cutscene_char067803_1", playDuration: 5 },
        { name: "cut_A_F", source: "cutscene/glow/cutscene_char067803_1", playDuration: 5 }
      ]]
    },
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut_B_Ponytail", playDuration: 5 },
        { name: "cut_B_Body", playDuration: 5 },
        { name: "cut_B_Head", playDuration: 5 },
        { name: "cut_B_B", source: "cutscene/glow/cutscene_char067803_1", playDuration: 5 },
        { name: "cut_B_Body", source: "cutscene/glow/cutscene_char067803_1", playDuration: 5 },
        { name: "cut_B_Head", source: "cutscene/glow/cutscene_char067803_1", playDuration: 5 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B_all"]
    }
  ],
  "067504": [
    {
      name: "cut_all",
      composite: ["A_cut", "B_cut"]
    }
  ],
  "004301": [
    {
      name: "cut_B_all",
      composite: [["B_cut", { name: "B_cut_Belt", layerOrder: -1 }]]
    },
    {
      name: "loop_2_all",
      composite: [["loop_2", { name: "loop_2_Belt", layerOrder: -1 }]]
    },
    {
      name: "cut_all",
      composite: ["A_cut", "cut_B_all"]
    }
  ],
  "000396": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "cut_B", playDuration: 6 },
        { name: "cut_B_button", hold: true }
      ]]
    },
    {
      name: "loop_2_all",
      composite: [["loop_2", { name: "loop_2_button", hold: true }]]
    },
    {
      name: "cut_all",
      composite: [
        { name: "cut_A", playDuration: 5 },
        "cut_B_all"
      ]
    }
  ],
  "067491": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "A_cut", playDuration: 4 },
        { name: "A_cut_w1", playDuration: 4 },
        { name: "A_cut_w2", playDuration: 4 }
      ]]
    },
    {
      name: "cut_B_all",
      composite: [[
        { name: "B_cut", playDuration: 4.2 },
        { name: "panties_white", hold: true },
        { name: "panties_black", hold: true },
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B_all"]
    }
  ],
  "004091": [
    {
      name: "cut_A_all",
      composite: [[
        "A_cut",
        "A_cut_hair",
        { name: "A_cut_tera_head", source: "cutscene/tera/cutscene_char004091_1" },
        { name: "A_cut_tera", source: "cutscene/tera/cutscene_char004091_1" }
      ]]
    },
    {
      name: "cut_B_all",
      composite: [["B_cut_bg_back", "B_cut", "B_cut_bg_front"]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", "cut_B_all"]
    }
  ],
  "067104": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "cut_A", playDuration: 4.5 },
        { name: "cut_A_front_body", layerOrder: -1, playDuration: 4.5 },
        { name: "cut_A_front_arm", playDuration: 4.5 },
        { name: "cut_A_curtain", loop: true }
      ]]
    },
    {
      name: "cut_A_all/no-curtain",
      composite: [[
        { name: "cut_A", playDuration: 4.5 },
        { name: "cut_A_front_body", layerOrder: -1, playDuration: 4.5 },
        { name: "cut_A_front_arm", playDuration: 4.5 },
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", { name: "cut_B", playDuration: 5 }]
    }
  ],
  "060804": [
    {
      name: "cut_all",
      composite: ["A_cut", "B_cut"]
    }
  ],
  "003392": [
    {
      name: "cut_A_all",
      composite: [[
        { name: "cut_A_ch", playDuration: 5 },
        { name: "cut_A_slot", layerOrder: -1, playDuration: 5 },
        { name: "cut_A_light", layerOrder: -1, playDuration: 5 },
      ]]
    },
    {
      name: "loop_1_all",
      composite: [[
        { name: "loop_1_ch" },
        { name: "loop_1_slot", layerOrder: -1 },
        { name: "loop_1_light", layerOrder: -1 },
      ]]
    },
    {
      name: "cut_all",
      composite: ["cut_A_all", { name: "cut_B", playDuration: 3 }]
    }
  ],
  "003701": [
    {
      name: "cut_B_all",
      composite: [[
        { name: "B_cut", playDuration: 3.2 },
        { name: "snake_1", layerOrder: -1, playDuration: 3.2 },
        { name: "snake_2", playDuration: 3.2 },
        { name: "snake_3", playDuration: 3.2 }
      ]]
    },
    {
      name: "cut_all",
      composite: ["A_cut", "cut_B_all"]
    }
  ],
  "003703": [
    {
      name: "cut_all",
      composite: [
        { name: "cut_a", playDuration: 2.7 },
        { name: "cut_b", playDuration: 3 }
      ]
    }
  ],
  "060601": [
    {
      name: "cut_A_all",
      composite: [
        { name: "cut_A_2", playDuration: 2.8 },
        { name: "cut_A_3", playDuration: 4 }
      ]
    },
    {
      name: "cut_all",
      composite: [["cut_A_all", "cut_A_closed"]]
    }
  ],
  "061306": [
    {
      name: "cut_all",
      composite: ["cut_A", { name: "cut_B", playDuration: 4 }]
    }
  ]
}

export default cutsceneComposites
