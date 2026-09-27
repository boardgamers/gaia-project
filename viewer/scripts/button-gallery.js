// Local visual catalogue only: render the real MoveButton component without submitting moves.
window.showButtonGallery = async function (host) {
  await Vue.nextTick();
  const source = document.querySelector(".has-mobile-icon").__vue__;
  const MoveButton = source.constructor;
  const mobileIcons = {
    "Form federation": "federation",
    "Re-score federation": "rescore-federation",
    Explore: "explore",
    "Ship Action": "ship-action",
    "Instant Gaiaforming": "instant-gaiaforming",
    "Place Power Ring": "power-ring",
    "Choose Artifact": "artifact",
    "Pick tech tile": "tech",
    "Pick booster": "booster",
    "Swap Planetary Institute": "swap-PI",
  };
  const button = (label, extra = {}) => ({
    label,
    tooltip: label,
    command: label,
    mobileIcon: mobileIcons[label],
    ...extra,
  });
  const building = (label, type) =>
    button(label, { richText: [{ building: { type, faction: "terrans", count: 1, skipResource: true } }] });
  const groups = [
    [
      "Actions principales",
      [
        building("Build a Mine", "m"),
        building("Upgrade to Trading Station", "ts"),
        building("Upgrade to Research Lab", "lab"),
        building("Upgrade to Planetary Institute", "PI"),
        building("Upgrade to Academy", "ac1"),
        building("Start a Gaia Project", "gf"),
        button("Research", { mobileIcon: "research" }),
        button("Power/Q.I.C / Ship Action", { mobileIcon: "board-actions" }),
        button("Special Action", { mobileIcon: "special-actions" }),
        button("Form federation"),
        button("Free action / Burn power", { mobileIcon: "conversions" }),
        button("Pass"),
        button("End Turn"),
      ],
    ],
    [
      "Lost Fleet — actions et choix",
      [
        ...["Explore", "Instant Gaiaforming", "Place Power Ring", "Choose Artifact", "Choose Tinkering Tile"].map((x) =>
          button(x)
        ),
        button("Examine Artifact (1 Q.I.C.)", {
          richText: [
            { text: "Examine Artifact (" },
            { rewards: [{ type: "q", count: 1 }], noPlus: true },
            { text: ")" },
          ],
        }),
      ],
    ],
    [
      "Actions conditionnelles et réactions",
      [
        button("Swap Planetary Institute"),
        button("Place Lost Planet"),
        building("Build a Space Station", "sp"),
        button("Re-score federation"),
        button("Pick booster"),
        button("Pick tech tile"),
        button("Pick tech tile to cover"),
        button("Charge 3 Power for 2 VP", {
          richText: [
            { text: "Charge" },
            { rewards: [{ type: "pw", count: 3 }] },
            { text: "for" },
            { rewards: [{ type: "vp", count: 2 }] },
          ],
        }),
        button("Decline charge"),
        ...["area1", "area2", "area3", "gaia"].map((x) => button("Brainstone " + x)),
        button("Income 1o"),
        button("Undo"),
      ],
    ],
    ["Lost Fleet — actions des vaisseaux (sous-menu)", []],
    [
      "Lost Fleet — artefacts (sous-menu)",
      [
        "knowledgeore",
        "credit",
        "knowledgeqic",
        "creditlarge",
        "power",
        "asteroid",
        "protoplanet",
        "researchlevel",
        "researchtracks",
        "federation",
        "gaiaproject",
        "planettypes",
        "deepspace",
      ].map((type) => button("Artifact: " + type, { richText: [{ artifactToken: "artifact-" + type }] })),
    ],
    [
      "Lost Fleet — bricolage (sous-menu)",
      ["Terraform 1 Step", "Charge 4 Power", "Gain 1 QIC", "Terraform 3 Steps", "Gain 3 Knowledge", "Gain 2 QIC"].map(
        (x) => button(x)
      ),
    ],
    [
      "Installation et confirmations",
      [
        "Rotate sectors",
        "Sector rotations finished",
        "Choose Booster 1",
        "Choose Terraforming Federation",
        "Choose Round Scoring 1",
        "Choose Final Scoring 1",
        "Choose Map Tile 1 (for red circle)",
        "Bid 0 for terrans",
        "Custom location",
        "Custom federation: select planets and empty space",
        "End Selection",
        "Previous",
        "Next",
        "OK",
      ].map((x) => button(x)),
    ],
  ];
  // The rendered ship actions are defined by the actual ship board, not a Cartesian product.
  const response = await fetch("/gallery-data");
  const data = await response.json();
  groups[3][1] = data.shipActions.map(({ ship, type }) =>
    button(ship + " / " + type, { richText: [{ spaceshipAction: { ship, type } }] })
  );
  groups.splice(1, 0, [
    "Choix unique — effet directement accessible",
    [
      button("Special Action: 3 Ore", { command: "special 3o", richText: [{ specialAction: "3o" }] }),
      button("Special Action: Power Ring", {
        command: "special power-ring",
        richText: [{ specialAction: "power-ring" }],
      }),
      button("Power action: 3 Knowledge", { command: "action power1", richText: [{ boardAction: "power1" }] }),
    ],
  ]);
  document.querySelector("#app")?.setAttribute("hidden", "");
  // launch replaces #app with its root node.
  source.$root.$el.style.display = "none";
  source.$root.$el.querySelector("#move-buttons")?.removeAttribute("id");
  const target = document.createElement("div");
  document.body.appendChild(target);
  new Vue({
    store: host.store,
    data: { selected: "" },
    render(h) {
      const controller = {
        isActiveButton: () => false,
        handleButtonClick: (b) => {
          this.selected = b.tooltip || b.label;
        },
        emitButtonCommand: (b) => {
          this.selected = b.label;
        },
      };
      return h("main", { attrs: { id: "button-gallery" }, class: "gaia-viewer-game" }, [
        h("h1", "Catalogue des boutons"),
        h(
          "p",
          "Rendu réel, avec légendes. Les actions dépendent de la faction, du tour et des ressources. Les actions de vaisseau sont regroupées avec Power/QIC. Les coûts et cibles variables sont représentés par des exemples ; les panneaux de choix de faction et d’enchères ne sont pas des boutons de cette barre."
        ),
        h(
          "p",
          { attrs: { role: "status" } },
          this.selected
            ? "Sélection : " + this.selected
            : "Touchez un bouton pour lire son nom. Aucun coup ne sera joué."
        ),
        h(
          "div",
          { attrs: { id: "move-buttons" }, class: "mobile-sticky-actions gallery-buttons" },
          groups.map(([title, buttons]) =>
            h("section", [
              h("h2", title),
              h(
                "div",
                { class: "gallery-grid" },
                buttons.map((b) =>
                  h("div", { class: "gallery-item" }, [
                    h(MoveButton, { props: { button: b, controller } }),
                    h("small", b.tooltip),
                  ])
                )
              ),
            ])
          )
        ),
      ]);
    },
  }).$mount(target);
};
