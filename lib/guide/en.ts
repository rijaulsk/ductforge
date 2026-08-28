import type { Guide } from "./types";

export const en: Guide = {
  locale: "en",
  htmlLang: "en",
  path: "/guide",
  label: "English",

  metaTitle: "How to use DuctForge — a duct takeoff, step by step",
  metaDescription:
    "A step-by-step guide to taking off ductwork with DuctForge: choosing between the billing and shop measurement standards, entering fittings, reading the drawing, and exporting a schedule.",

  eyebrow: "Guide",
  title: "How to take off a duct job",
  lede: [
    "Eight steps, about five minutes to read, and you will not need it twice. The one part worth reading properly is the first: which measurement standard you are working to decides every number that follows.",
    "Nothing here is stored anywhere but your own device, so you can experiment with a job freely — there is nothing to break and nothing to undo.",
  ],

  standardsHeading: "First, the one decision that matters",
  standardsLede:
    "The same duct is a different quantity depending on who is asking. Pick the wrong one and every figure below it is wrong in a way that looks completely reasonable.",
  standards: [
    {
      name: "Billing",
      body: "Nominal measurement — mean perimeter multiplied by centreline length, the BOQ / IS 655 / DW 144 practice. Use this when you are claiming against a client, a consultant or a quantity surveyor. It is what they will check your invoice against.",
    },
    {
      name: "Shop",
      body: "The true unfolded blank a fabricator cuts, including slant heights on transitions, heel arc expansion on bends and the gore development on round elbows. Use this when you are buying sheet or setting a shop to work. It is not a billing quantity and should never be claimed as one.",
    },
  ],

  stepsHeading: "The workflow",
  steps: [
    {
      title: "Set the standard, the units and the material",
      body: [
        "The billing/shop switch and the metric/imperial switch are both in the bar at the top, and both apply to the whole takeoff. Switch units whenever you like — the geometry is stored in millimetres, so nothing is lost or rounded in the process.",
        "Sheet material lives in the Material and allowances panel below the schedule. Galvanised steel is the default; stainless and aluminium change the weight and nothing else, because a gauge is a thickness.",
      ],
      figure: "standard",
      callouts: [
        "Units. Everything on screen switches; your dimensions are converted, not retyped.",
        "The measurement standard. This is the decision above — get it right before anything else.",
        "Material, in the panel below the schedule. Changes the weight, never the area.",
      ],
    },
    {
      title: "Pick the fitting",
      body: [
        "Six rectangular fittings and four round ones. If your run is plain duct, use Straight; if it changes size, Transition; if it turns, Elbow; if it steps sideways, Offset; if it branches, Collar or Y-piece. Coming off an air-handling unit into spiral, use Square to round.",
        "The picker keeps whichever zone you were working in, so you can move through a dozen fittings in AHU-1 without retyping it.",
      ],
      figure: "picker",
      callouts: [
        "Rectangular: straight duct, transition, elbow, offset, collar and Y-piece.",
        "Round and spiral: plain duct, a gored elbow, a concentric cone, and a square-to-round transition.",
      ],
    },
    {
      title: "Type the dimensions",
      body: [
        "Every field is labelled with the symbol it uses in the formula, so the working shown under the result reads back against the boxes you filled.",
        "Two of them catch people out. On a rectangular elbow, R is the inside (throat) radius, not the centreline. On a round elbow it is the centreline radius, which is the convention for round duct — usually 1.5 times the diameter.",
      ],
      figure: "params",
      callouts: [
        "The symbol beside each label is the one used in the formula.",
        "R on a rectangular elbow is the INSIDE radius. On a round elbow it is the centreline.",
        "The working, with your numbers in it. Check any line against the calculator on your desk.",
      ],
    },
    {
      title: "Check the drawing",
      body: [
        "Blueprint shows the fitting dimensioned, and every dimension in its formula appears on it. Flat pattern shows the blanks a shop would cut: solid lines are cuts, dashed lines are folds. Isometric shows the object, which is the fastest way to notice you picked an offset when you meant a transition.",
        "Seam laps and flange material are deliberately not drawn into the flat pattern — the waste allowance covers them numerically, and drawing them too would count them twice.",
      ],
      figure: "drawing",
      callouts: [
        "Three views. Your choice sticks — changing a dimension will not switch it back.",
        "Every dimension in the formula is on the drawing, and nothing is on the drawing that is not in the formula.",
      ],
    },
    {
      title: "Set the quantity and the waste allowance",
      body: [
        "Pieces multiplies the line. The allowance is your decision: 0% for a net BOQ claim, 8% for factory-run straight duct, 12% for standard flanged work, 15–20% for complex fittings and heavy gauge.",
        "Gauge is chosen for you from the largest dimension, but you can override it on any line — and you should, wherever the specification says something different.",
      ],
      figure: "quantity",
      callouts: [
        "Pieces. One line can be any number of identical fittings.",
        "The allowance, as a preset or typed. 12% is the standard flanged figure.",
        "Gauge. Left to the table, or set by hand where your specification differs.",
      ],
    },
    {
      title: "Add it to the takeoff",
      body: [
        "Nothing enters the schedule until you press Add. Until then the fitting is a draft: change it, watch the numbers move, and only commit when it is right.",
        "Every line can be edited, duplicated or removed afterwards. Duplicating is the quick way to take off a run of similar fittings at different lengths.",
      ],
      figure: "schedule",
      callouts: [
        "The one orange button on the screen. Nothing is scheduled until it is pressed.",
        "Each line can be edited, duplicated or removed. Duplicate, then change the length.",
      ],
    },
    {
      title: "Zones, insulation, flanges and hangers",
      body: [
        "A zone is whatever you bill by — AHU-1, Level 3, Kitchen. Give lines the same zone name and they total together.",
        "In Material and allowances you can also have it count insulation on the outer face, flange ends from the length your duct is supplied in, and hangers at your spacing. All three are off until you switch them on, because a quantity nobody asked for is a quantity nobody checked.",
      ],
      figure: "zones",
      callouts: [
        "The zone. Type it once — it carries to the next fitting you pick.",
        "Insulation, flanges and hangers, all off until you set them.",
      ],
    },
    {
      title: "Read the totals and get it out",
      body: [
        "Totals give you net area, waste, gross area and weight, then material by gauge with an estimated sheet count for each. Put in your rate per kg or per m² and it prices the job at your own figures.",
        "CSV exports every input alongside every result, so the file still explains itself in a year. Save writes a project file you can reopen or hand to someone else. Print produces a quantity sheet you can issue, with the standard, the units, the allowance and every assumption printed on it.",
      ],
      figure: "totals",
      callouts: [
        "The bottom line. Gross is net plus your allowance; weight is gross times the density shown.",
        "By gauge, because 22 ga cannot be cut from a 24 ga sheet. Sheet counts are an estimate.",
        "Save keeps the job as a file, CSV goes to a spreadsheet, Print issues a quantity sheet.",
      ],
    },
  ],

  watchHeading: "Worth knowing",
  watch: [
    {
      title: "Gauge is chosen by size alone",
      body: "Real SMACNA selection also depends on pressure class and reinforcement spacing. Treat the table as a starting point and check it against the specification.",
    },
    {
      title: "Round duct is graded on the rectangular table",
      body: "SMACNA publishes a separate and generally lighter table for round and spiral duct, which this app does not carry — so round comes out over-specified. Override the gauge where your spec differs.",
    },
    {
      title: "Sheet counts are an estimate",
      body: "Gross area divided by one sheet, rounded up, per gauge. It cannot know how your shop nests, and offcut reuse moves it in both directions.",
    },
    {
      title: "Everything lives on this device",
      body: "Clearing your browser data clears your takeoffs. If a job matters, Save it to a file — that file is the copy you can move between machines.",
    },
  ],

  openApp: "Open the calculator",
  seeStandards: "Every formula and constant",
  switcherLabel: "Read this guide in",
  nav: { calculator: "Calculator", guide: "Guide", standards: "Standards" },
  figureLabel: "What you'll see",
};
