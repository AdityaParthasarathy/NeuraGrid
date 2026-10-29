const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, HeadingLevel, BorderStyle,
  WidthType, ShadingType, VerticalAlign, PageNumber, PageBreak,
  TableOfContents
} = require('docx');
const fs = require('fs');

// ─── Colour constants ───────────────────────────────────────────────────────
const BLUE_HDR   = "D5E8F0";
const YELLOW_ROW = "FFF9C4";
const ORANGE_ROW = "FFE0B2";
const RED_ROW    = "FFCDD2";
const GREEN_ROW  = "C8E6C9";
const WHITE      = "FFFFFF";

// ─── Border helper ──────────────────────────────────────────────────────────
function border(color = "AAAAAA") {
  return { style: BorderStyle.SINGLE, size: 1, color };
}
const stdBorders = { top: border(), bottom: border(), left: border(), right: border() };
const boldBorders = { top: border("4472C4"), bottom: border("4472C4"), left: border("4472C4"), right: border("4472C4") };

// ─── Cell helper ────────────────────────────────────────────────────────────
function cell(text, w, opts = {}) {
  const { bold = false, fill = WHITE, align = AlignmentType.LEFT, italic = false, color } = opts;
  const runOpts = { text, bold, font: "Arial", size: 20, italic };
  if (color) runOpts.color = color;
  return new TableCell({
    borders: stdBorders,
    width: { size: w, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align, children: [new TextRun(runOpts)] })]
  });
}

// ─── Multi-run cell helper ───────────────────────────────────────────────────
function cellRuns(runs, w, opts = {}) {
  const { fill = WHITE, align = AlignmentType.LEFT } = opts;
  return new TableCell({
    borders: stdBorders,
    width: { size: w, type: WidthType.DXA },
    shading: { fill, type: ShadingType.CLEAR },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ alignment: align, children: runs })]
  });
}

// ─── Header row helper ──────────────────────────────────────────────────────
function hdrRow(texts, widths) {
  return new TableRow({
    tableHeader: true,
    children: texts.map((t, i) => cell(t, widths[i], { bold: true, fill: BLUE_HDR }))
  });
}

// ─── Paragraph helpers ──────────────────────────────────────────────────────
function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    spacing: { before: 360, after: 120 },
    children: [new TextRun({ text, font: "Arial", size: 36, bold: true, color: "1F4E79" })]
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 280, after: 80 },
    children: [new TextRun({ text, font: "Arial", size: 28, bold: true, color: "2E75B6" })]
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    spacing: { before: 200, after: 60 },
    children: [new TextRun({ text, font: "Arial", size: 24, bold: true, color: "2F5496" })]
  });
}
function para(text, opts = {}) {
  const { bold = false, italic = false, color, size = 22, spaceBefore = 0, spaceAfter = 120 } = opts;
  const runOpts = { text, font: "Arial", size, bold, italic };
  if (color) runOpts.color = color;
  return new Paragraph({
    spacing: { before: spaceBefore, after: spaceAfter },
    children: [new TextRun(runOpts)]
  });
}
function paraRuns(runs, opts = {}) {
  const { spaceBefore = 0, spaceAfter = 120, align = AlignmentType.LEFT } = opts;
  return new Paragraph({ spacing: { before: spaceBefore, after: spaceAfter }, alignment: align, children: runs });
}
function run(text, opts = {}) {
  const { bold = false, italic = false, color, size = 22 } = opts;
  const r = { text, font: "Arial", size, bold, italic };
  if (color) r.color = color;
  return new TextRun(r);
}
function bullet(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: "Arial", size: 22 })]
  });
}
function bulletRuns(runs, level = 0) {
  return new Paragraph({
    numbering: { reference: "bullets", level },
    spacing: { before: 40, after: 40 },
    children: runs
  });
}
function numbered(text, level = 0) {
  return new Paragraph({
    numbering: { reference: "numbers", level },
    spacing: { before: 40, after: 40 },
    children: [new TextRun({ text, font: "Arial", size: 22 })]
  });
}
function spacer(n = 1) {
  return Array.from({ length: n }, () => new Paragraph({ children: [new TextRun("")] }));
}
function divider() {
  return new Paragraph({
    spacing: { before: 120, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: "2E75B6", space: 1 } },
    children: [new TextRun("")]
  });
}
function callout(text, fill = YELLOW_ROW) {
  return new Table({
    width: { size: 9026, type: WidthType.DXA },
    columnWidths: [9026],
    rows: [new TableRow({ children: [new TableCell({
      borders: { top: border("F5A623"), bottom: border("F5A623"), left: { style: BorderStyle.SINGLE, size: 12, color: "F5A623" }, right: border("F5A623") },
      width: { size: 9026, type: WidthType.DXA },
      shading: { fill, type: ShadingType.CLEAR },
      margins: { top: 100, bottom: 100, left: 180, right: 180 },
      children: [new Paragraph({ children: [new TextRun({ text, font: "Arial", size: 22, italic: true })] })]
    })]})],
  });
}

// ─── Page break ─────────────────────────────────────────────────────────────
function pageBreak() {
  return new Paragraph({ children: [new PageBreak()] });
}

// ════════════════════════════════════════════════════════════════════════════
//  DOCUMENT BUILD
// ════════════════════════════════════════════════════════════════════════════

const doc = new Document({
  numbering: {
    config: [
      { reference: "bullets",
        levels: [
          { level: 0, format: LevelFormat.BULLET, text: "\u2022", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
          { level: 1, format: LevelFormat.BULLET, text: "\u25E6", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 1080, hanging: 360 } } } },
        ]
      },
      { reference: "numbers",
        levels: [
          { level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT,
            style: { paragraph: { indent: { left: 720, hanging: 360 } } } },
        ]
      },
    ]
  },
  styles: {
    default: {
      document: { run: { font: "Arial", size: 22 } }
    },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 36, bold: true, font: "Arial", color: "1F4E79" },
        paragraph: { spacing: { before: 360, after: 120 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 28, bold: true, font: "Arial", color: "2E75B6" },
        paragraph: { spacing: { before: 280, after: 80 }, outlineLevel: 1 } },
      { id: "Heading3", name: "Heading 3", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: "2F5496" },
        paragraph: { spacing: { before: 200, after: 60 }, outlineLevel: 2 } },
    ]
  },
  sections: [
    // ──────────────────────────────────────────────────────────────────────
    // SECTION 0: Cover Page (no header/footer)
    // ──────────────────────────────────────────────────────────────────────
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      children: [
        ...spacer(6),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 240 },
          children: [new TextRun({ text: "NeuraGrid", font: "Arial", size: 72, bold: true, color: "1F4E79" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: "Smart Campus Energy Twin", font: "Arial", size: 48, bold: true, color: "2E75B6" })]
        }),
        divider(),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 240 },
          children: [new TextRun({ text: "A Complete Guide to Understanding the Project", font: "Arial", size: 32, italic: true, color: "595959" })]
        }),
        ...spacer(2),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: "Written in plain, simple English", font: "Arial", size: 24, italic: true, color: "7F7F7F" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 120 },
          children: [new TextRun({ text: "For students presenting their final project", font: "Arial", size: 24, italic: true, color: "7F7F7F" })]
        }),
        ...spacer(4),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 80 },
          children: [new TextRun({ text: "April 2026", font: "Arial", size: 24, color: "595959" })]
        }),
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [new TextRun({ text: "Version 1.0", font: "Arial", size: 22, color: "7F7F7F" })]
        }),
        pageBreak(),
      ]
    },

    // ──────────────────────────────────────────────────────────────────────
    // SECTION 1: Table of Contents + all body content
    // ──────────────────────────────────────────────────────────────────────
    {
      properties: {
        page: {
          size: { width: 11906, height: 16838 },
          margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 }
        }
      },
      headers: {
        default: new Header({
          children: [
            new Paragraph({
              alignment: AlignmentType.RIGHT,
              border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: "2E75B6", space: 1 } },
              spacing: { after: 60 },
              children: [
                new TextRun({ text: "NeuraGrid ", font: "Arial", size: 18, color: "2E75B6", bold: true }),
                new TextRun({ text: "— Smart Campus Energy Twin", font: "Arial", size: 18, color: "595959" }),
              ]
            })
          ]
        })
      },
      footers: {
        default: new Footer({
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              border: { top: { style: BorderStyle.SINGLE, size: 4, color: "2E75B6", space: 1 } },
              spacing: { before: 60 },
              children: [
                new TextRun({ text: "Page ", font: "Arial", size: 18, color: "595959" }),
                new TextRun({ children: [PageNumber.CURRENT], font: "Arial", size: 18, color: "595959" }),
              ]
            })
          ]
        })
      },
      children: [

        // TABLE OF CONTENTS
        h1("Table of Contents"),
        new TableOfContents("Table of Contents", {
          hyperlink: true,
          headingStyleRange: "1-3",
          stylesWithLevels: [
            { styleName: "Heading1", level: 1 },
            { styleName: "Heading2", level: 2 },
            { styleName: "Heading3", level: 3 },
          ]
        }),
        pageBreak(),

        // ─────────────────────────────────────────────────────────────────
        // SECTION 1: What is NeuraGrid?
        // ─────────────────────────────────────────────────────────────────
        h1("Section 1: What is NeuraGrid?"),
        divider(),

        h2("1.1  The Problem — Why Does This App Exist?"),
        para("Imagine a large university campus with six different buildings — labs, lecture halls, auditoriums, and offices. All of them use electricity all day long. But here is the problem: nobody knows exactly how much power each building is using at any given moment. Nobody gets an instant warning when a building is about to overload. Nobody can tell if the air conditioning is wasting energy at 3 AM when the building is empty."),
        para("The result? Universities waste enormous amounts of electricity and money every year. They also produce more carbon pollution than they need to, because inefficiency means burning more fuel at power stations."),
        para("NeuraGrid was built to fix this. It is a real-time monitoring and management dashboard that watches every building on campus at once, spots problems automatically, and gives smart recommendations to save energy and money."),

        h2("1.2  What Does NeuraGrid Do — In One Sentence?"),
        callout("NeuraGrid is a web application that monitors electricity use across 6 university buildings in real time, detects problems, predicts future issues using AI, and recommends actions to save energy and reduce costs.", BLUE_HDR),
        ...spacer(1),

        h2("1.3  Who Would Use NeuraGrid?"),
        para("NeuraGrid is designed for the people responsible for running a campus efficiently:"),
        bullet("Campus Energy Managers — the people whose job it is to keep electricity costs down and systems running smoothly"),
        bullet("University Facilities Teams — engineers and technicians who maintain air conditioning, lighting, and machinery"),
        bullet("University Administration — the decision-makers who want to understand how much energy is being used and where to cut costs"),
        bullet("Sustainability Officers — staff trying to reduce the campus's carbon footprint and increase use of renewable energy"),
        bullet("Students and Researchers — anyone studying energy management or smart building technology"),
        ...spacer(1),

        h2("1.4  What Makes NeuraGrid \"Smart\"?"),
        para("The word \"smart\" means it does not just show you numbers — it thinks for you. NeuraGrid uses artificial intelligence (AI) to:"),
        numbered("Predict when a building will hit its electricity limit before it actually happens"),
        numbered("Detect unusual patterns (like a lab left running overnight) automatically"),
        numbered("Suggest specific actions with exact money and carbon savings calculated"),
        numbered("Show a 3D visual model of the campus where you can click on buildings to explore their data"),
        numbered("Generate a digital twin — a live virtual copy of the real campus that mirrors what is happening in reality"),
        ...spacer(1),
        pageBreak(),

        // ─────────────────────────────────────────────────────────────────
        // SECTION 2: Energy Basics
        // ─────────────────────────────────────────────────────────────────
        h1("Section 2: Energy Basics — Everything You Need to Know"),
        divider(),
        para("This section explains all the energy words and concepts you will see in the app. Do not worry if this is new to you — each concept is explained with a simple everyday analogy."),
        ...spacer(1),

        h2("2.1  kW vs kWh — Power vs Energy"),
        para("These two terms look similar but mean very different things. Here is the easiest way to remember them:"),
        ...spacer(1),

        // kW vs kWh table
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 3513, 3513],
          rows: [
            hdrRow(["Term", "What It Means", "Everyday Analogy"], [2000, 3513, 3513]),
            new TableRow({ children: [
              cell("kW (kilowatt)", 2000, { bold: true }),
              cell("How fast electricity is being used RIGHT NOW. It is the rate of power flow.", 3513),
              cell("The speed of your car on the speedometer (e.g. 60 km/h). It tells you how fast you are going at this instant.", 3513),
            ]}),
            new TableRow({ children: [
              cell("kWh (kilowatt-hour)", 2000, { bold: true, fill: YELLOW_ROW }),
              cell("The total amount of electricity used over a period of time.", 3513, { fill: YELLOW_ROW }),
              cell("The distance shown on your odometer — the total kilometres you have driven. It adds up over time.", 3513, { fill: YELLOW_ROW }),
            ]}),
          ]
        }),
        ...spacer(1),
        para("Example from NeuraGrid: The A-Block building is currently using 762 kW (that is its speed right now). Over today, the whole campus has used 30,000 kWh (that is the total distance travelled today)."),
        ...spacer(1),

        h2("2.2  Capacity vs Current Load"),
        para("Every building has two important numbers:"),
        bullet("Capacity — the maximum amount of electricity a building CAN use. Think of it as the size of a water pipe. It tells you how much could flow through in theory."),
        bullet("Current Load — the amount of electricity the building IS using right now. This is how much is actually flowing through that pipe at this moment."),
        ...spacer(1),
        para("Example: The A-Block building has a capacity of 880 kW and a current load of 762 kW. The pipe can handle 880, but 762 is flowing through it right now."),
        ...spacer(1),

        h2("2.3  Utilisation % — How Full Is the Building?"),
        para("Utilisation percentage tells you what fraction of a building's capacity it is currently using. The formula is simple:"),
        callout("Utilisation % = (Current Load / Capacity) x 100", YELLOW_ROW),
        ...spacer(1),
        para("Example: A-Block uses 762 kW out of a maximum of 880 kW. So: 762 / 880 x 100 = 87%. That means A-Block is using 87% of its maximum capacity — which is dangerously high."),
        para("As a rule of thumb:"),
        bullet("Under 60% — comfortable, efficient"),
        bullet("60 to 80% — moderate, keep an eye on it"),
        bullet("Over 80% — high risk, needs attention"),
        bullet("Over 90% — critical, could cause outages"),
        ...spacer(1),

        h2("2.4  HVAC — The Biggest Energy Eater"),
        para("HVAC stands for Heating, Ventilation, and Air Conditioning. It is the system that keeps buildings at a comfortable temperature — cooling them in summer, heating them in winter, and keeping fresh air circulating."),
        para("HVAC is almost always the single biggest consumer of electricity in any building. In NeuraGrid's campus, HVAC systems in B-Block and A-Block are flagged as warnings because they are running at very high loads."),
        para("Think of HVAC like a large refrigerator for an entire building. The bigger the building, the bigger the \"fridge\", and the more electricity it needs. If it starts working less efficiently (like a refrigerator that needs its coils cleaned), it uses even more power to achieve the same cooling."),
        ...spacer(1),

        h2("2.5  CO2 in a Room — Air Quality"),
        para("CO2 stands for carbon dioxide — the gas that humans breathe out. In a sealed room with many people, CO2 levels build up over time."),
        para("CO2 in rooms is measured in ppm — parts per million. This means: out of every million air molecules in the room, how many are CO2?"),
        bullet("400 ppm — normal outdoor air, perfectly healthy"),
        bullet("700 to 1000 ppm — typical occupied classroom, acceptable"),
        bullet("Above 1000 ppm — poor air quality; people feel drowsy and find it hard to concentrate"),
        bullet("Above 2000 ppm — very poor; headaches, fatigue, health concerns"),
        para("In NeuraGrid, an alert has been triggered for Chemistry Lab B-204 in B-Block because CO2 levels are elevated. This is dangerous for the people in that room and indicates the ventilation system may not be working properly."),
        ...spacer(1),

        h2("2.6  Renewable Energy Contribution"),
        para("Renewable energy comes from sources that never run out — like the sun (solar panels) and wind (wind turbines). Unlike burning coal or gas, renewables produce no pollution."),
        para("The renewable contribution percentage tells you how much of the electricity being used is coming from clean sources rather than the city power grid."),
        para("NeuraGrid campus statistics:"),
        bullet("Solar generation: 340 kW (from solar panels on the Green Building)"),
        bullet("Wind generation: 118 kW"),
        bullet("Total renewable: 458 kW out of 3,532 kW total — that is 13%"),
        bullet("Campus target: 30% renewable (the campus is currently falling short)"),
        ...spacer(1),

        h2("2.7  Grid Draw — Buying Electricity from the City"),
        para("The \"grid\" refers to the national electricity network — the massive system of power stations, cables, and transformers that delivers electricity to homes and businesses across the country."),
        para("When a building uses more power than its own solar or wind sources can supply, it \"draws from the grid\" — meaning it buys electricity from the city's supply."),
        para("The campus currently draws 3,074 kW from the grid. This is the power the university has to pay for. The goal of NeuraGrid is to reduce this number by being more efficient and using more renewables."),
        ...spacer(1),

        h2("2.8  Peak vs Off-Peak Electricity"),
        para("Electricity does not cost the same all day. Utility companies charge more during \"peak hours\" — the times when the most people and businesses are using power at the same time — because it strains the grid."),
        ...spacer(1),

        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2500, 2263, 2263, 2000],
          rows: [
            hdrRow(["Time Period", "Hours", "Rate Multiplier", "What It Means"], [2500, 2263, 2263, 2000]),
            new TableRow({ children: [
              cell("Peak Hours", 2500, { bold: true, fill: RED_ROW }),
              cell("9 AM to 5 PM", 2263, { fill: RED_ROW }),
              cell("1.42x (42% more expensive)", 2263, { fill: RED_ROW }),
              cell("Most expensive — avoid running heavy equipment", 2000, { fill: RED_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Mid-Peak Hours", 2500, { bold: true, fill: YELLOW_ROW }),
              cell("6 AM to 9 AM, 5 PM to 10 PM", 2263, { fill: YELLOW_ROW }),
              cell("1.15x (15% more expensive)", 2263, { fill: YELLOW_ROW }),
              cell("Medium cost — use with care", 2000, { fill: YELLOW_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Off-Peak Hours", 2500, { bold: true, fill: GREEN_ROW }),
              cell("10 PM to 6 AM", 2263, { fill: GREEN_ROW }),
              cell("0.72x (28% cheaper)", 2263, { fill: GREEN_ROW }),
              cell("Cheapest — best time to run heavy tasks", 2000, { fill: GREEN_ROW }),
            ]}),
          ]
        }),
        ...spacer(1),
        para("The base electricity rate on campus is Rs 12.284 per kWh. During peak hours, this becomes Rs 17.43 per kWh. During off-peak hours, it drops to Rs 8.84 per kWh."),
        ...spacer(1),

        h2("2.9  Load Shifting — Doing Tasks at the Right Time"),
        para("Load shifting simply means moving energy-intensive tasks to cheaper times of day. Instead of running heavy lab equipment during expensive peak hours, you schedule it to run overnight when electricity is cheap."),
        para("Example from NeuraGrid: The Steve Jobs Auditorium's AV (audio-visual) systems could be shifted to run from 2 AM to 4 AM instead of during the day. This simple change would save Rs 21,340 per month — without any physical upgrades!"),
        ...spacer(1),

        h2("2.10  Pre-Cooling — Be Smart About Air Conditioning"),
        para("Pre-cooling is a clever energy-saving trick. Instead of running air conditioning hard during expensive peak hours (9 AM to 5 PM), you cool the building down before peak hours begin — when electricity is cheap."),
        para("Buildings hold their temperature well (like a thermos flask), so if you cool them down at 7 AM when electricity is cheap, the building stays cool enough through the morning peak without needing the AC to work as hard."),
        para("Example from NeuraGrid: The AI predicts A-Block will spike in power use between 6 PM and 8 PM. The recommendation is to pre-cool A-Block starting at 4:30 PM (before peak pricing kicks in) to reduce the load during the expensive window."),
        ...spacer(1),

        h2("2.11  Carbon kg/hr — How Much CO2 Are We Producing?"),
        para("Every unit of electricity that comes from the grid (not from renewables) produces carbon dioxide (CO2) as a byproduct — because most grid electricity comes from burning coal, gas, or oil at power stations."),
        para("NeuraGrid uses a carbon factor of 0.386 kg of CO2 per kWh of electricity used. Multiply this by the power being used and you get the CO2 being emitted per hour."),
        para("The campus is currently producing 1.23 tonnes of CO2 per hour. That is 1,230 kg every single hour — just from electricity use. Over a full day, that adds up enormously."),
        para("Reducing energy waste is not just about saving money — it directly reduces pollution and helps fight climate change."),
        ...spacer(1),

        h2("2.12  Savings % — Better or Worse Than Normal?"),
        para("Each building's \"savings %\" shows how it is performing compared to its historical average. This average is called the baseline — it is calculated from months of past data to show what the building normally uses."),
        bullet("A positive savings % means the building is doing BETTER than normal. Example: Green Building is 14% below baseline — it is using 14% less energy than usual. Great!"),
        bullet("A negative savings % means the building is doing WORSE than normal. Example: A-Block is -7% — it is using 7% MORE energy than it typically does. This is a red flag."),
        ...spacer(1),

        h2("2.13  Demand Charge — The Surprise Bill"),
        para("Most people know that electricity is billed per kWh. But there is a second charge that many people do not know about: the demand charge."),
        para("Utility companies monitor the highest peak power you draw in a billing month — even if it only lasts for 15 minutes. They charge you extra for that spike, because they had to have that capacity available for you."),
        para("Example: If A-Block normally uses 600 kW but one afternoon it briefly spikes to 850 kW, the utility charges a premium on that 850 kW peak for the entire month — even though it only happened once."),
        para("This is why NeuraGrid watches for capacity spikes so carefully. Preventing a brief overload can save thousands of rupees in monthly charges."),
        ...spacer(1),

        h2("2.14  BMS — The Building's Automatic Brain"),
        para("BMS stands for Building Management System. It is the automated control system that manages a building's mechanical and electrical equipment — including HVAC, lighting, elevators, fire systems, and access control."),
        para("Think of it like a smart thermostat, but for an entire building. The BMS can automatically turn off lights in empty rooms, adjust the temperature based on occupancy, and shut down systems outside working hours."),
        para("NeuraGrid works alongside the BMS — it reads data from it and can send recommendations or even automated commands back to it to optimise energy use without anyone needing to manually intervene."),
        ...spacer(1),
        pageBreak(),

        // ─────────────────────────────────────────────────────────────────
        // SECTION 3: The 6 Buildings
        // ─────────────────────────────────────────────────────────────────
        h1("Section 3: The Campus — All 6 Buildings Explained"),
        divider(),
        para("The NeuraGrid system monitors six buildings across the university campus. Each building has a different function, size, and energy profile. Let us go through them one by one."),
        ...spacer(1),

        h2("3.1  Green Building — The Sustainability Star"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2400, 6626],
          rows: [
            hdrRow(["Detail", "Information"], [2400, 6626]),
            new TableRow({ children: [cell("Full Name", 2400, { bold: true }), cell("Green Building", 6626)] }),
            new TableRow({ children: [cell("Type", 2400, { bold: true, fill: YELLOW_ROW }), cell("Academic and Administration", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Floors / Size", 2400, { bold: true }), cell("6 floors, 32,000 sq ft, 35 classrooms", 6626)] }),
            new TableRow({ children: [cell("Purpose", 2400, { bold: true, fill: YELLOW_ROW }), cell("Sustainability hub, solar control systems, campus energy management centre", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Capacity", 2400, { bold: true }), cell("650 kW", 6626)] }),
            new TableRow({ children: [cell("Current Load", 2400, { bold: true, fill: GREEN_ROW }), cell("285 kW (44% utilisation — most efficient on campus)", 6626, { fill: GREEN_ROW })] }),
            new TableRow({ children: [cell("Solar Panels", 2400, { bold: true }), cell("Yes — 35% of its own load comes from its on-site solar panels", 6626)] }),
            new TableRow({ children: [cell("Alerts", 2400, { bold: true, fill: GREEN_ROW }), cell("None — running perfectly", 6626, { fill: GREEN_ROW })] }),
            new TableRow({ children: [cell("Performance", 2400, { bold: true }), cell("14% below baseline — the BEST performing building on campus", 6626)] }),
          ]
        }),
        ...spacer(1),
        para("Why is it so efficient? The Green Building is the campus sustainability hub — energy efficiency is literally its job. It has its own solar panels which generate some of its own electricity, reducing how much it needs from the grid. At only 44% utilisation, it has a lot of spare capacity and is not straining any systems. It is the star performer."),
        ...spacer(1),

        h2("3.2  B-Block (Physics and Chemistry Labs) — The Heavy Lab"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2400, 6626],
          rows: [
            hdrRow(["Detail", "Information"], [2400, 6626]),
            new TableRow({ children: [cell("Full Name", 2400, { bold: true }), cell("B-Block — Physics and Chemistry Laboratories", 6626)] }),
            new TableRow({ children: [cell("Type", 2400, { bold: true, fill: YELLOW_ROW }), cell("Laboratory", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Floors / Size", 2400, { bold: true }), cell("7 floors, 58,000 sq ft, 42 classrooms", 6626)] }),
            new TableRow({ children: [cell("Equipment", 2400, { bold: true, fill: YELLOW_ROW }), cell("18 mass spectrometers, 56 lab instruments, 14 HVAC units, 34 safety systems", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Capacity", 2400, { bold: true }), cell("920 kW", 6626)] }),
            new TableRow({ children: [cell("Current Load", 2400, { bold: true, fill: ORANGE_ROW }), cell("665 kW (72% utilisation — heavy)", 6626, { fill: ORANGE_ROW })] }),
            new TableRow({ children: [cell("Alerts", 2400, { bold: true, fill: RED_ROW }), cell("2 alerts: HVAC units 3 and 4 above efficiency threshold; High CO2 in Chemistry Lab B-204", 6626, { fill: RED_ROW })] }),
            new TableRow({ children: [cell("Performance", 2400, { bold: true }), cell("-3% over baseline (using 3% MORE energy than normal)", 6626)] }),
          ]
        }),
        ...spacer(1),
        para("Why is B-Block under stress? Physics and chemistry labs use extremely power-hungry equipment. Mass spectrometers (instruments that identify chemical compounds) draw large amounts of electricity. The HVAC must run continuously to maintain safe chemical vapour control — and two of the 14 HVAC units are now flagged as running inefficiently. There is also a dangerous CO2 buildup in Chemistry Lab B-204, likely from centrifuges that were left running overnight."),
        ...spacer(1),

        h2("3.3  Steve Jobs Auditorium — The Innovation Hub"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2400, 6626],
          rows: [
            hdrRow(["Detail", "Information"], [2400, 6626]),
            new TableRow({ children: [cell("Full Name", 2400, { bold: true }), cell("Steve Jobs Auditorium", 6626)] }),
            new TableRow({ children: [cell("Type", 2400, { bold: true, fill: YELLOW_ROW }), cell("Auditorium and Innovation Centre", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Floors / Size", 2400, { bold: true }), cell("3 floors, 41,000 sq ft, 15 rooms", 6626)] }),
            new TableRow({ children: [cell("Purpose", 2400, { bold: true, fill: YELLOW_ROW }), cell("Advanced computing, AR/VR studios, campus innovation hub, hosts major tech events", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Equipment", 2400, { bold: true }), cell("24 stage AV systems, 18 AR/VR rigs, 32 workstations, 4 ambient lighting rigs", 6626)] }),
            new TableRow({ children: [cell("Capacity", 2400, { bold: true, fill: YELLOW_ROW }), cell("580 kW", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Current Load", 2400, { bold: true }), cell("295 kW (51% utilisation — moderate)", 6626)] }),
            new TableRow({ children: [cell("Alerts", 2400, { bold: true, fill: GREEN_ROW }), cell("None — operating normally", 6626, { fill: GREEN_ROW })] }),
            new TableRow({ children: [cell("Performance", 2400, { bold: true }), cell("8% below baseline — performing well", 6626)] }),
          ]
        }),
        ...spacer(1),
        para("The Steve Jobs Auditorium is a tech showcase space. It has powerful AR and VR equipment, professional stage lighting, and high-end AV systems. Despite all this impressive technology, it only runs at 51% capacity because events do not happen every hour of every day. When there is no event, most of these systems can be powered down. NeuraGrid's AI recommends shifting the AV systems to run maintenance and charging cycles at night, saving Rs 21,340 per month."),
        ...spacer(1),

        h2("3.4  A-Block (Computer Science Labs) — The Most Stressed Building"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2400, 6626],
          rows: [
            hdrRow(["Detail", "Information"], [2400, 6626]),
            new TableRow({ children: [cell("Full Name", 2400, { bold: true }), cell("A-Block — Computer Science Laboratories", 6626)] }),
            new TableRow({ children: [cell("Type", 2400, { bold: true, fill: YELLOW_ROW }), cell("Laboratory (Computing)", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Floors / Size", 2400, { bold: true }), cell("7 floors, 52,000 sq ft, 42 classrooms", 6626)] }),
            new TableRow({ children: [cell("Purpose", 2400, { bold: true, fill: YELLOW_ROW }), cell("Programming, AI, networking and robotics labs; primary server infrastructure and GPU cluster", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Equipment", 2400, { bold: true }), cell("82 workstations and PCs, 24 server racks, 12 HVAC units, 30 networking devices", 6626)] }),
            new TableRow({ children: [cell("Capacity", 2400, { bold: true, fill: YELLOW_ROW }), cell("880 kW", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Current Load", 2400, { bold: true, fill: RED_ROW }), cell("762 kW (87% utilisation — HIGHEST on campus, danger zone)", 6626, { fill: RED_ROW })] }),
            new TableRow({ children: [cell("Alerts", 2400, { bold: true, fill: RED_ROW }), cell("2 alerts: Server room temperature elevated at 74 degrees F; HVAC Unit A-3 running at 94% load", 6626, { fill: RED_ROW })] }),
            new TableRow({ children: [cell("Performance", 2400, { bold: true }), cell("-7% over baseline — WORST performing building on campus", 6626)] }),
          ]
        }),
        ...spacer(1),
        para("A-Block is the most critical building in the system right now. It hosts the university's main servers and GPU cluster — machines that run 24 hours a day and generate enormous heat. The server room is overheating (74 degrees F and rising). One of its 12 HVAC units is running at 94% capacity — that means it is working almost flat-out to try to keep things cool, and could fail at any moment. If the servers get too hot, they will shut down automatically, which could interrupt the entire university's digital infrastructure."),
        ...spacer(1),

        h2("3.5  C-Block (Main Auditorium) — The Largest Building"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2400, 6626],
          rows: [
            hdrRow(["Detail", "Information"], [2400, 6626]),
            new TableRow({ children: [cell("Full Name", 2400, { bold: true }), cell("C-Block — Main University Auditorium", 6626)] }),
            new TableRow({ children: [cell("Type", 2400, { bold: true, fill: YELLOW_ROW }), cell("Auditorium and Central Hub", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Floors / Size", 2400, { bold: true }), cell("8 floors, 88,000 sq ft, 50 classrooms — LARGEST building on campus", 6626)] }),
            new TableRow({ children: [cell("Purpose", 2400, { bold: true, fill: YELLOW_ROW }), cell("Campus main auditorium, central hub, highest classroom density", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Equipment", 2400, { bold: true }), cell("8 main HVAC plant units, 42 stage/AV systems, 86 smart lighting rigs, 12 lifts/escalators, 48 security systems", 6626)] }),
            new TableRow({ children: [cell("Capacity", 2400, { bold: true, fill: YELLOW_ROW }), cell("1,350 kW — highest capacity on campus", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Current Load", 2400, { bold: true }), cell("905 kW (67% utilisation — well managed for its size)", 6626)] }),
            new TableRow({ children: [cell("Alerts", 2400, { bold: true, fill: GREEN_ROW }), cell("None — operating normally", 6626, { fill: GREEN_ROW })] }),
            new TableRow({ children: [cell("Performance", 2400, { bold: true }), cell("2% below baseline — performing slightly better than normal", 6626)] }),
          ]
        }),
        ...spacer(1),
        para("C-Block is the largest building on campus — 88,000 square feet across 8 floors with 50 classrooms. Despite its massive size, it is running at a reasonable 67% utilisation and has no active alerts. Its 86 smart lighting rigs help save energy by automatically dimming when areas are unoccupied. The one item flagged as a watch item is the lifts and escalators — their energy consumption is being monitored."),
        ...spacer(1),

        h2("3.6  Mech and Civil Labs — The Industrial Powerhouse"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2400, 6626],
          rows: [
            hdrRow(["Detail", "Information"], [2400, 6626]),
            new TableRow({ children: [cell("Full Name", 2400, { bold: true }), cell("Mechanical and Civil Engineering Laboratories", 6626)] }),
            new TableRow({ children: [cell("Type", 2400, { bold: true, fill: YELLOW_ROW }), cell("Industrial Laboratory", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Floors / Size", 2400, { bold: true }), cell("4 floors, 44,000 sq ft, 18 rooms", 6626)] }),
            new TableRow({ children: [cell("Purpose", 2400, { bold: true, fill: YELLOW_ROW }), cell("Mechanical and civil engineering workshops, fabrication bays, structural testing facilities", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Equipment", 2400, { bold: true }), cell("14 CNC machines, 8 hydraulic presses, 10 industrial HVAC units, 6 3D metal printers, 18 welding stations, 12 test rigs", 6626)] }),
            new TableRow({ children: [cell("Capacity", 2400, { bold: true, fill: YELLOW_ROW }), cell("720 kW", 6626, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Current Load", 2400, { bold: true, fill: ORANGE_ROW }), cell("620 kW (86% utilisation — very high due to industrial machines)", 6626, { fill: ORANGE_ROW })] }),
            new TableRow({ children: [cell("Alerts", 2400, { bold: true, fill: RED_ROW }), cell("1 alert: Industrial exhaust fan 2 running above its rated capacity", 6626, { fill: RED_ROW })] }),
            new TableRow({ children: [cell("Performance", 2400, { bold: true }), cell("-2% over baseline — slightly worse than normal", 6626)] }),
          ]
        }),
        ...spacer(1),
        para("The Mech and Civil labs are a different kind of energy challenge. This building contains heavy industrial machinery — CNC machines (computer-controlled cutting tools), hydraulic presses (machines that use fluid pressure to bend metal), 3D metal printers, and welding stations. These machines individually draw enormous amounts of power. Running at 86% utilisation is expected for this type of building. The current concern is an exhaust fan running above its rated limit, which creates a risk of mechanical failure."),
        ...spacer(1),

        h2("3.7  Campus Building Comparison Table"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [1800, 1100, 1200, 1300, 1100, 1200, 1326],
          rows: [
            hdrRow(["Building", "Type", "Capacity (kW)", "Current Load (kW)", "Util. %", "Status", "Savings %"], [1800, 1100, 1200, 1300, 1100, 1200, 1326]),
            new TableRow({ children: [
              cell("Green Building", 1800),
              cell("Academic", 1100),
              cell("650", 1200, { align: AlignmentType.CENTER }),
              cell("285", 1300, { align: AlignmentType.CENTER }),
              cell("44%", 1100, { align: AlignmentType.CENTER, fill: GREEN_ROW }),
              cell("Normal", 1200, { fill: GREEN_ROW }),
              cell("+14%", 1326, { fill: GREEN_ROW, bold: true }),
            ]}),
            new TableRow({ children: [
              cell("Steve Jobs Aud.", 1800, { fill: YELLOW_ROW }),
              cell("Auditorium", 1100, { fill: YELLOW_ROW }),
              cell("580", 1200, { align: AlignmentType.CENTER, fill: YELLOW_ROW }),
              cell("295", 1300, { align: AlignmentType.CENTER, fill: YELLOW_ROW }),
              cell("51%", 1100, { align: AlignmentType.CENTER, fill: GREEN_ROW }),
              cell("Normal", 1200, { fill: GREEN_ROW }),
              cell("+8%", 1326, { fill: GREEN_ROW, bold: true }),
            ]}),
            new TableRow({ children: [
              cell("C-Block Aud.", 1800),
              cell("Auditorium", 1100),
              cell("1,350", 1200, { align: AlignmentType.CENTER }),
              cell("905", 1300, { align: AlignmentType.CENTER }),
              cell("67%", 1100, { align: AlignmentType.CENTER, fill: YELLOW_ROW }),
              cell("Normal", 1200, { fill: GREEN_ROW }),
              cell("+2%", 1326, { fill: GREEN_ROW, bold: true }),
            ]}),
            new TableRow({ children: [
              cell("B-Block Labs", 1800, { fill: YELLOW_ROW }),
              cell("Lab", 1100, { fill: YELLOW_ROW }),
              cell("920", 1200, { align: AlignmentType.CENTER, fill: YELLOW_ROW }),
              cell("665", 1300, { align: AlignmentType.CENTER, fill: YELLOW_ROW }),
              cell("72%", 1100, { align: AlignmentType.CENTER, fill: YELLOW_ROW }),
              cell("Warning", 1200, { fill: ORANGE_ROW }),
              cell("-3%", 1326, { fill: ORANGE_ROW, bold: true }),
            ]}),
            new TableRow({ children: [
              cell("Mech/Civil Labs", 1800, { fill: ORANGE_ROW }),
              cell("Lab", 1100, { fill: ORANGE_ROW }),
              cell("720", 1200, { align: AlignmentType.CENTER, fill: ORANGE_ROW }),
              cell("620", 1300, { align: AlignmentType.CENTER, fill: ORANGE_ROW }),
              cell("86%", 1100, { align: AlignmentType.CENTER, fill: ORANGE_ROW }),
              cell("Warning", 1200, { fill: ORANGE_ROW }),
              cell("-2%", 1326, { fill: ORANGE_ROW, bold: true }),
            ]}),
            new TableRow({ children: [
              cell("A-Block CS Labs", 1800, { fill: RED_ROW }),
              cell("Lab", 1100, { fill: RED_ROW }),
              cell("880", 1200, { align: AlignmentType.CENTER, fill: RED_ROW }),
              cell("762", 1300, { align: AlignmentType.CENTER, fill: RED_ROW }),
              cell("87%", 1100, { align: AlignmentType.CENTER, fill: RED_ROW }),
              cell("Warning", 1200, { fill: RED_ROW }),
              cell("-7%", 1326, { fill: RED_ROW, bold: true }),
            ]}),
            new TableRow({ children: [
              cell("CAMPUS TOTAL", 1800, { bold: true, fill: BLUE_HDR }),
              cell("Mixed", 1100, { bold: true, fill: BLUE_HDR }),
              cell("5,100", 1200, { align: AlignmentType.CENTER, bold: true, fill: BLUE_HDR }),
              cell("3,532", 1300, { align: AlignmentType.CENTER, bold: true, fill: BLUE_HDR }),
              cell("69%", 1100, { align: AlignmentType.CENTER, bold: true, fill: BLUE_HDR }),
              cell("5 Alerts", 1200, { bold: true, fill: ORANGE_ROW }),
              cell("Mixed", 1326, { fill: BLUE_HDR }),
            ]}),
          ]
        }),
        ...spacer(1),
        pageBreak(),

        // ─────────────────────────────────────────────────────────────────
        // SECTION 4: The Dashboard
        // ─────────────────────────────────────────────────────────────────
        h1("Section 4: The Dashboard — What You Are Looking At"),
        divider(),
        para("The Dashboard is the first page you see when you open NeuraGrid. It gives you a complete at-a-glance view of the entire campus energy situation right now. Let us walk through every number and chart on the screen."),
        ...spacer(1),

        h2("4.1  The Big Number Cards at the Top"),
        para("When you open the dashboard, you see a row of large metric cards. Here is what each one means:"),
        ...spacer(1),

        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [1800, 1600, 5626],
          rows: [
            hdrRow(["Card Label", "Value Shown", "What It Means in Simple English"], [1800, 1600, 5626]),
            new TableRow({ children: [
              cell("Total Campus Load", 1800, { bold: true }),
              cell("3,532 kW", 1600, { fill: YELLOW_ROW }),
              cell("Right now, the campus is using 3,532 kW of electricity. That is like 35,320 one-bar electric heaters all running simultaneously.", 5626),
            ]}),
            new TableRow({ children: [
              cell("Total Capacity", 1800, { bold: true, fill: YELLOW_ROW }),
              cell("5,100 kW", 1600, { fill: YELLOW_ROW }),
              cell("The maximum electricity all 6 buildings combined can handle before the systems trip and fail.", 5626, { fill: YELLOW_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Utilisation", 1800, { bold: true }),
              cell("69%", 1600, { fill: YELLOW_ROW }),
              cell("The campus is using 69% of its total capacity. There is 31% headroom (1,568 kW of spare capacity available).", 5626),
            ]}),
            new TableRow({ children: [
              cell("Solar Generation", 1800, { bold: true, fill: GREEN_ROW }),
              cell("340 kW", 1600, { fill: GREEN_ROW }),
              cell("The solar panels on the Green Building are generating 340 kW of free, clean electricity right now.", 5626, { fill: GREEN_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Wind Generation", 1800, { bold: true, fill: GREEN_ROW }),
              cell("118 kW", 1600, { fill: GREEN_ROW }),
              cell("Wind turbines are contributing 118 kW of clean power.", 5626, { fill: GREEN_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Total Renewable", 1800, { bold: true, fill: GREEN_ROW }),
              cell("458 kW", 1600, { fill: GREEN_ROW }),
              cell("Solar + Wind = 458 kW coming from clean sources (340 + 118 = 458).", 5626, { fill: GREEN_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Grid Draw", 1800, { bold: true, fill: ORANGE_ROW }),
              cell("3,074 kW", 1600, { fill: ORANGE_ROW }),
              cell("The amount being purchased from the city power grid: 3,532 - 458 = 3,074 kW. This is what the university pays for.", 5626, { fill: ORANGE_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Renewable %", 1800, { bold: true }),
              cell("13%", 1600, { fill: YELLOW_ROW }),
              cell("Only 13% of the electricity comes from clean sources. The campus target is 30% — so there is a long way to go.", 5626),
            ]}),
            new TableRow({ children: [
              cell("CO2 per Hour", 1800, { bold: true, fill: RED_ROW }),
              cell("1.23 t/hr", 1600, { fill: RED_ROW }),
              cell("The campus produces 1.23 tonnes (1,230 kg) of carbon dioxide every hour from its electricity use.", 5626, { fill: RED_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Today's Energy", 1800, { bold: true, fill: YELLOW_ROW }),
              cell("30,000 kWh", 1600, { fill: YELLOW_ROW }),
              cell("The total amount of energy used today so far across the entire campus.", 5626, { fill: YELLOW_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Today's Savings", 1800, { bold: true, fill: GREEN_ROW }),
              cell("Rs 89,540", 1600, { fill: GREEN_ROW }),
              cell("The money saved today compared to if the campus had operated at its inefficient baseline level.", 5626, { fill: GREEN_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Active Buildings", 1800, { bold: true }),
              cell("6/6", 1600, { fill: GREEN_ROW }),
              cell("All 6 buildings are online and being monitored. None have gone offline.", 5626),
            ]}),
            new TableRow({ children: [
              cell("Total Alerts", 1800, { bold: true, fill: RED_ROW }),
              cell("5 Alerts", 1600, { fill: RED_ROW }),
              cell("There are 5 active warnings across 3 buildings that need attention.", 5626, { fill: RED_ROW }),
            ]}),
            new TableRow({ children: [
              cell("System Uptime", 1800, { bold: true, fill: GREEN_ROW }),
              cell("99.7%", 1600, { fill: GREEN_ROW }),
              cell("The NeuraGrid monitoring system has been running without failures for 99.7% of its uptime — nearly perfect reliability.", 5626, { fill: GREEN_ROW }),
            ]}),
          ]
        }),
        ...spacer(1),

        h2("4.2  The 24-Hour Energy Usage Chart"),
        para("One of the most important elements on the dashboard is a line chart showing energy use across the past 24 hours. It has three lines:"),
        bullet("Blue line (Actual Usage): What the campus actually consumed hour by hour. You can see peaks during working hours and dips at night when buildings are quieter."),
        bullet("Orange dashed line (Predicted Usage): What NeuraGrid's AI predicted the campus would use, based on historical patterns. If the blue line matches the orange line closely, predictions are accurate."),
        bullet("Red dotted line (Peak Threshold): The maximum safe load level. If the blue line ever touches or crosses this red line, there is a risk of overload. This is the alarm level."),
        para("This chart is useful for spotting unusual spikes — for example, if the energy use at 2 AM is much higher than the predicted line, it means something unexpected is running in the middle of the night."),
        ...spacer(1),

        h2("4.3  The Energy Source Pie Chart"),
        para("Next to the 24-hour chart is a pie chart showing where the campus electricity is currently coming from:"),
        bullet("Green slice: Solar power (340 kW, roughly 10% of the pie)"),
        bullet("Light blue slice: Wind power (118 kW, roughly 3% of the pie)"),
        bullet("Grey/dark slice: Grid (3,074 kW, roughly 87% of the pie)"),
        para("Ideally, the green and blue slices would be much larger. The goal is to grow the renewable portion from 13% to at least 30%."),
        ...spacer(1),

        h2("4.4  The Building Cards"),
        para("Below the charts, there are six cards — one for each building. Each card shows:"),
        bullet("The building name and type"),
        bullet("Its current load and capacity as a progress bar"),
        bullet("Its utilisation percentage"),
        bullet("Whether it has any active alerts (shown as a red warning badge)"),
        bullet("Its current status (Normal or Warning)"),
        para("You can click on any building card to go to a detailed view of that building."),
        ...spacer(1),

        h2("4.5  The Top Energy Wasting Building Spotlight"),
        para("In the corner of the dashboard there is a special \"spotlight\" card that identifies the building currently performing worst compared to its baseline. Right now, this is A-Block, which is consuming 7% more energy than it normally should."),
        para("This card is useful because it immediately directs attention to where the biggest problem is — you do not need to scan all 6 buildings individually."),
        ...spacer(1),
        pageBreak(),

        // ─────────────────────────────────────────────────────────────────
        // SECTION 5: The 5 Pages
        // ─────────────────────────────────────────────────────────────────
        h1("Section 5: The App Pages — What Each One Does"),
        divider(),
        para("NeuraGrid has six main pages, each serving a different purpose. Here is a simple guide to each one."),
        ...spacer(1),

        h2("5.1  Dashboard (Home Page)"),
        para("This is the starting point — the overview. It shows everything happening on campus right now in one place: total load, renewable percentage, alerts, and a building-by-building status summary. If you only had 30 seconds to understand the campus, the dashboard tells you everything you need to know."),
        para("Think of it like the dashboard in a car — it gives you speed, fuel level, warning lights, all at once."),
        ...spacer(1),

        h2("5.2  Analytics — Deep Dive Into the Numbers"),
        para("The Analytics page is where you go when you want to understand trends and compare buildings in detail. It contains:"),
        bullet("Bar charts comparing all 6 buildings side by side — by energy use, by efficiency score, and by carbon output"),
        bullet("A 7-day trend chart showing how each building performed over the past week"),
        bullet("A 30-day monthly trend to spot long-term patterns"),
        bullet("A detailed comparison table with efficiency scores ranked from best to worst"),
        para("This page is useful for presentations because you can show \"A-Block is consistently the highest consumer\" or \"Green Building improved its efficiency this week.\""),
        ...spacer(1),

        h2("5.3  Digital Twin — The 3D Campus Map"),
        para("This is perhaps the most visually impressive part of NeuraGrid. The Digital Twin page shows a three-dimensional model of the entire campus, with each building represented as a 3D block."),
        bullet("Buildings are colour-coded based on their energy status: green for efficient, yellow for moderate, orange for high, red for critical"),
        bullet("Buildings pulse and glow based on how heavily loaded they are — A-Block glows intensely, Green Building glows softly"),
        bullet("Click on any building to see a pop-up with its live data"),
        bullet("Switch to 2D map view to see an overhead satellite-style layout of the campus"),
        para("The concept of a \"digital twin\" means you have created a virtual copy of the real campus that mirrors what is happening in reality, updated in real time. In industry, digital twins are used for factories, power stations, and entire cities."),
        ...spacer(1),

        h2("5.4  AI Insights — The Smart Brain"),
        para("The AI Insights page is where artificial intelligence analyses all the data and generates conclusions that a human might miss. It shows insights such as predicted problems, detected anomalies, and missed savings opportunities — each explained in plain English with a confidence percentage."),
        para("This page is described in full detail in Section 6 of this guide."),
        ...spacer(1),

        h2("5.5  Optimization — The Action Plan"),
        para("The Optimization page takes the AI insights and turns them into specific, actionable recommendations grouped into five categories. Each recommendation shows:"),
        bullet("What action to take"),
        bullet("How many kW it would save"),
        bullet("How much money it would save per day"),
        bullet("How much CO2 it would reduce"),
        para("This page is described in full detail in Section 7 of this guide."),
        ...spacer(1),

        h2("5.6  Alerts — The Warning Centre"),
        para("The Alerts page lists all active warnings across the campus in one place. Each alert shows which building it is from, what the problem is, how severe it is (info, warning, or critical), and when it was first detected."),
        para("Think of it like the notifications panel on your phone — it gathers all the things that need your attention in one place."),
        para("This page is described in detail in Section 8 of this guide."),
        ...spacer(1),
        pageBreak(),

        // ─────────────────────────────────────────────────────────────────
        // SECTION 6: AI Insights
        // ─────────────────────────────────────────────────────────────────
        h1("Section 6: The AI Brain — How AI Insights Work"),
        divider(),
        para("The AI Insights page shows what NeuraGrid's artificial intelligence engine has detected and predicted. Currently there are six active AI insights. Here is each one explained in plain English."),
        ...spacer(1),

        h2("6.1  Insight 1: Peak Load Forecast for A-Block"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 7026],
          rows: [
            hdrRow(["Field", "Details"], [2000, 7026]),
            new TableRow({ children: [cell("What AI Detected", 2000, { bold: true }), cell("A-Block will hit a dangerous energy spike between 6 PM and 8 PM today", 7026)] }),
            new TableRow({ children: [cell("Confidence", 2000, { bold: true, fill: YELLOW_ROW }), cell("94% — the AI is almost certain this will happen", 7026, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Why It Matters", 2000, { bold: true }), cell("A-Block is already at 87% capacity. A 6-8 PM spike could push it over 100%, triggering an outage that shuts down the servers and all CS labs.", 7026)] }),
            new TableRow({ children: [cell("Recommended Action", 2000, { bold: true, fill: GREEN_ROW }), cell("Pre-cool A-Block starting at 4:30 PM (while electricity is still cheaper) and shift some server tasks to off-peak hours. This prevents the spike.", 7026, { fill: GREEN_ROW })] }),
          ]
        }),
        ...spacer(1),

        h2("6.2  Insight 2: Server Room Thermal Spike (Anomaly)"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 7026],
          rows: [
            hdrRow(["Field", "Details"], [2000, 7026]),
            new TableRow({ children: [cell("What AI Detected", 2000, { bold: true }), cell("A-Block server room temperature is rising at 0.8 degrees F per hour — above normal", 7026)] }),
            new TableRow({ children: [cell("Why It Matters", 2000, { bold: true, fill: YELLOW_ROW }), cell("Servers must stay below a safe temperature or they automatically shut down to protect themselves. If this trend continues, the university network and AI/CS lab systems could go offline within hours.", 7026, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Recommended Action", 2000, { bold: true }), cell("A maintenance ticket has been automatically created (no human needed to log it). A technician should check and service HVAC Unit A-3, which is running at 94% load and may be failing.", 7026)] }),
          ]
        }),
        ...spacer(1),

        h2("6.3  Insight 3: Solar Surplus Available (Opportunity)"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 7026],
          rows: [
            hdrRow(["Field", "Details"], [2000, 7026]),
            new TableRow({ children: [cell("What AI Detected", 2000, { bold: true }), cell("The Green Building's solar panels are generating more electricity than the building is currently using — 95 kW of solar power is going uncaptured", 7026)] }),
            new TableRow({ children: [cell("Why It Matters", 2000, { bold: true, fill: GREEN_ROW }), cell("This is free, clean electricity being wasted. If it were routed to other buildings, it could reduce the campus grid draw and lower costs.", 7026, { fill: GREEN_ROW })] }),
            new TableRow({ children: [cell("Recommended Action", 2000, { bold: true }), cell("Route the surplus 95 kW to C-Block or Steve Jobs Auditorium, reducing their grid draw and saving money.", 7026)] }),
          ]
        }),
        ...spacer(1),

        h2("6.4  Insight 4: HVAC Compressor Degradation in B-Block"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 7026],
          rows: [
            hdrRow(["Field", "Details"], [2000, 7026]),
            new TableRow({ children: [cell("What AI Detected", 2000, { bold: true }), cell("B-Block's HVAC system efficiency has dropped by 14%. The AI calculates a 68% chance of compressor failure within the next 12 days.", 7026)] }),
            new TableRow({ children: [cell("Why It Matters", 2000, { bold: true, fill: ORANGE_ROW }), cell("HVAC failure in a chemistry lab is dangerous — chemicals must be stored at controlled temperatures and the ventilation system must work properly for safety. Emergency repairs are far more expensive than planned maintenance.", 7026, { fill: ORANGE_ROW })] }),
            new TableRow({ children: [cell("Recommended Action", 2000, { bold: true }), cell("Fix the HVAC compressor proactively (before it fails). This saves Rs 6,80,600 compared to emergency breakdown repair costs.", 7026)] }),
          ]
        }),
        ...spacer(1),

        h2("6.5  Insight 5: Load Shifting Opportunity at Steve Jobs Auditorium"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 7026],
          rows: [
            hdrRow(["Field", "Details"], [2000, 7026]),
            new TableRow({ children: [cell("What AI Detected", 2000, { bold: true }), cell("The Steve Jobs Auditorium's AV (audio-visual) systems could be operated during off-peak hours (2 AM to 4 AM) instead of during the day", 7026)] }),
            new TableRow({ children: [cell("Why It Matters", 2000, { bold: true, fill: YELLOW_ROW }), cell("The AV systems need to run maintenance cycles and charge batteries regardless — so when they run does not affect users. Running them at night cuts the electricity cost by 28%.", 7026, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Savings", 2000, { bold: true, fill: GREEN_ROW }), cell("Rs 21,340 per month — just from this one simple scheduling change, with no hardware upgrades needed.", 7026, { fill: GREEN_ROW })] }),
          ]
        }),
        ...spacer(1),

        h2("6.6  Insight 6: Unusual After-Hours Consumption in B-Block"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 7026],
          rows: [
            hdrRow(["Field", "Details"], [2000, 7026]),
            new TableRow({ children: [cell("What AI Detected", 2000, { bold: true }), cell("At 2:30 AM, B-Block was consuming 38% more electricity than its predicted baseline for that hour", 7026)] }),
            new TableRow({ children: [cell("Root Cause", 2000, { bold: true, fill: RED_ROW }), cell("Chemistry Lab B-204 had centrifuges left running overnight. Nobody had turned them off at the end of the working day.", 7026, { fill: RED_ROW })] }),
            new TableRow({ children: [cell("Why It Matters", 2000, { bold: true }), cell("This is both a safety issue (unattended centrifuges can overheat) and a financial waste (running expensive equipment for no reason at peak hours).", 7026)] }),
            new TableRow({ children: [cell("Recommended Action", 2000, { bold: true, fill: GREEN_ROW }), cell("Implement an automatic shutoff policy for lab equipment after-hours. Alert the lab supervisor.", 7026, { fill: GREEN_ROW })] }),
          ]
        }),
        ...spacer(1),
        pageBreak(),

        // ─────────────────────────────────────────────────────────────────
        // SECTION 7: Optimization Engine
        // ─────────────────────────────────────────────────────────────────
        h1("Section 7: The Optimization Engine — How Recommendations Are Made"),
        divider(),
        para("The Optimization page goes one step further than AI Insights — it turns observations into a ranked, prioritised action plan. Recommendations are grouped into five categories. Here is what each category means and what specific actions NeuraGrid recommends right now."),
        ...spacer(1),

        h2("7.1  Category 1 — Load Redistribution"),
        para("The idea here is simple: if one building is dangerously overloaded while another building has plenty of spare capacity, move some work from the overloaded building to the underloaded one."),
        callout("Think of it like a busy road (A-Block) and a quieter road running alongside it. Load redistribution means diverting some traffic to the quieter road to ease congestion.", YELLOW_ROW),
        ...spacer(1),
        bullet("Overloaded buildings (above 74% capacity): A-Block (87%), Mech Labs (86%), B-Block (72%)"),
        bullet("Underloaded buildings (below 50% capacity): Green Building (44%), Steve Jobs Auditorium (51%)"),
        bullet("Recommended action: Shift non-critical computing workloads from A-Block to the Green Building's spare capacity, reducing A-Block's load and risk of outage"),
        bullet("Estimated saving: Reduces peak demand charge risk — potentially thousands of rupees per billing cycle"),
        ...spacer(1),

        h2("7.2  Category 2 — Optimal Timing (Load Shifting)"),
        para("This category identifies tasks that do not need to happen during expensive peak hours. By rescheduling them to off-peak times, you do exactly the same work but pay less for the electricity."),
        bullet("EV charging stations — charge electric vehicles overnight (10 PM to 5 AM) instead of during the day"),
        bullet("Water heating systems — heat water storage tanks at night when electricity is cheap"),
        bullet("Lab equipment charging cycles — recharge battery backups and UPS systems during off-peak hours"),
        bullet("Auditorium AV maintenance cycles — run at 2 AM to 4 AM (saves Rs 21,340 per month)"),
        ...spacer(1),
        para("Time-of-use pricing reminder: The same kWh of electricity costs 1.42x during peak hours (9 AM to 5 PM) but only 0.72x during off-peak hours (10 PM to 6 AM). That is a difference of almost 50% — by just changing when you do something, you nearly halve the cost."),
        ...spacer(1),

        h2("7.3  Category 3 — Renewable Energy Capture"),
        para("This category focuses on making the most of the solar and wind energy available on campus. Currently 95 kW of solar from the Green Building is going uncaptured."),
        bullet("Route excess solar from Green Building to buildings with high grid draw"),
        bullet("Pre-cool buildings using solar power between 10 AM and 2 PM (when solar generation peaks) so less grid power is needed in the afternoon"),
        bullet("Coordinate EV charging with solar availability — charge cars using solar power during the midday solar peak"),
        bullet("Target: raise renewable share from 13% towards the 30% campus goal"),
        ...spacer(1),

        h2("7.4  Category 4 — HVAC Optimization"),
        para("HVAC is the single biggest energy consumer in almost every building. Optimising it gives the biggest savings."),
        bullet("If occupancy sensors detect a room is empty, raise the thermostat setpoint by 2 degrees F automatically. Air conditioning does not need to work as hard in an empty room."),
        bullet("Isolate empty zones — if one wing of a building has no occupancy, seal off its HVAC zone and stop conditioning that area"),
        bullet("Service flagged HVAC units before they fail (B-Block units 3 and 4, A-Block unit A-3 at 94%)"),
        bullet("Pre-cool A-Block at 4:30 PM using cheap off-peak electricity before the predicted 6-8 PM spike"),
        para("Even a 1 to 2 degree temperature adjustment in an empty zone can save 3 to 5% on HVAC energy use — across a 5,100 kW campus, this adds up quickly."),
        ...spacer(1),

        h2("7.5  Category 5 — Smart Lighting"),
        para("Lighting accounts for a significant portion of energy use, especially in large buildings like C-Block (which has 86 smart lighting rigs)."),
        bullet("The rule: if lighting is running above 72% brightness BUT occupancy sensors show fewer than 62% of the maximum people, automatically dim the lights"),
        bullet("Auto-off in unoccupied corridors and meeting rooms after a set time period"),
        bullet("Daylight harvesting: near windows, automatically reduce artificial lighting when natural daylight is sufficient"),
        bullet("Estimated saving: 8 to 12% reduction in lighting energy use campus-wide"),
        ...spacer(1),

        h2("7.6  How to Read the Savings Numbers"),
        para("Every recommendation in the Optimization page shows three savings figures. Here is what they mean:"),
        ...spacer(1),

        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 3513, 3513],
          rows: [
            hdrRow(["Saving Shown", "What It Measures", "Example"], [2000, 3513, 3513]),
            new TableRow({ children: [
              cell("kW saved", 2000, { bold: true }),
              cell("The reduction in power draw if this action is taken", 3513),
              cell("Shifting AV systems saves 45 kW of peak demand", 3513),
            ]}),
            new TableRow({ children: [
              cell("Rs/day saved", 2000, { bold: true, fill: YELLOW_ROW }),
              cell("The money saved each day by implementing this change", 3513, { fill: YELLOW_ROW }),
              cell("Load shifting saves Rs 711 per day for that recommendation", 3513, { fill: YELLOW_ROW }),
            ]}),
            new TableRow({ children: [
              cell("kg CO2 saved", 2000, { bold: true, fill: GREEN_ROW }),
              cell("The carbon dioxide emissions avoided per day", 3513, { fill: GREEN_ROW }),
              cell("Using 10 fewer kWh saves 3.86 kg CO2 (at 0.386 kg per kWh)", 3513, { fill: GREEN_ROW }),
            ]}),
          ]
        }),
        ...spacer(1),
        pageBreak(),

        // ─────────────────────────────────────────────────────────────────
        // SECTION 8: Alerts
        // ─────────────────────────────────────────────────────────────────
        h1("Section 8: Alerts — What Triggers Them and Why They Matter"),
        divider(),
        para("The Alerts page lists every active warning on campus. Currently there are 5 alerts across 3 buildings. Here is each one explained:"),
        ...spacer(1),

        h2("8.1  Alert 1: A-Block Near Capacity"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 7026],
          rows: [
            new TableRow({ children: [cell("Building", 2000, { bold: true, fill: BLUE_HDR }), cell("A-Block (CS Labs)", 7026, { fill: BLUE_HDR, bold: true })] }),
            new TableRow({ children: [cell("Severity", 2000, { bold: true }), cell("Critical Warning", 7026, { fill: RED_ROW })] }),
            new TableRow({ children: [cell("What It Means", 2000, { bold: true, fill: YELLOW_ROW }), cell("A-Block is at 87% of its maximum capacity. There is only 13% headroom (about 118 kW) before it hits its limit. Any additional load — a batch of computers starting up, additional lab equipment turning on — could push it over.", 7026, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Why It Matters", 2000, { bold: true }), cell("Exceeding capacity triggers automatic circuit breakers that cut power to the building. This would shut down the university's servers, network, and all CS lab computers suddenly — potentially corrupting data and disrupting exams or research.", 7026)] }),
          ]
        }),
        ...spacer(1),

        h2("8.2  Alert 2: A-Block Server Room High Temperature"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 7026],
          rows: [
            new TableRow({ children: [cell("Building", 2000, { bold: true, fill: BLUE_HDR }), cell("A-Block (CS Labs)", 7026, { fill: BLUE_HDR, bold: true })] }),
            new TableRow({ children: [cell("Severity", 2000, { bold: true }), cell("Warning", 7026, { fill: ORANGE_ROW })] }),
            new TableRow({ children: [cell("What It Means", 2000, { bold: true, fill: YELLOW_ROW }), cell("The server room temperature is at 74 degrees F and rising at 0.8 degrees F per hour. HVAC Unit A-3 is working at 94% of its maximum capacity trying to keep up.", 7026, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Why It Matters", 2000, { bold: true }), cell("Servers have built-in thermal protection that automatically shuts them down if they overheat. This protects the hardware but causes a sudden outage. The server room must be cooled before the temperature reaches the shutdown threshold.", 7026)] }),
          ]
        }),
        ...spacer(1),

        h2("8.3  Alert 3: Mech Labs Energy Spike"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 7026],
          rows: [
            new TableRow({ children: [cell("Building", 2000, { bold: true, fill: BLUE_HDR }), cell("Mechanical and Civil Labs", 7026, { fill: BLUE_HDR, bold: true })] }),
            new TableRow({ children: [cell("Severity", 2000, { bold: true }), cell("Warning", 7026, { fill: ORANGE_ROW })] }),
            new TableRow({ children: [cell("What It Means", 2000, { bold: true, fill: YELLOW_ROW }), cell("Industrial exhaust fan 2 is running above its rated capacity. This is the fan that removes fumes and particles from the workshop area.", 7026, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Why It Matters", 2000, { bold: true }), cell("An industrial fan running above its rated speed wears out faster and can fail suddenly. In a mechanical workshop with metal dust and chemical fumes, a failed exhaust system is a safety hazard.", 7026)] }),
          ]
        }),
        ...spacer(1),

        h2("8.4  Alert 4: B-Block HVAC Efficiency Threshold"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 7026],
          rows: [
            new TableRow({ children: [cell("Building", 2000, { bold: true, fill: BLUE_HDR }), cell("B-Block (Physics and Chemistry Labs)", 7026, { fill: BLUE_HDR, bold: true })] }),
            new TableRow({ children: [cell("Severity", 2000, { bold: true }), cell("Warning", 7026, { fill: ORANGE_ROW })] }),
            new TableRow({ children: [cell("What It Means", 2000, { bold: true, fill: YELLOW_ROW }), cell("HVAC units 3 and 4 are consuming more energy than they should for the amount of cooling they are producing. They have dropped 14% in efficiency, meaning they now need 14% more electricity to achieve the same cooling effect.", 7026, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Why It Matters", 2000, { bold: true }), cell("This is both a cost issue (more electricity wasted) and a reliability issue (the AI predicts 68% chance of compressor failure within 12 days). Chemistry labs must maintain strict temperature and air quality for safety and for experiment accuracy.", 7026)] }),
          ]
        }),
        ...spacer(1),

        h2("8.5  Alert 5: B-Block High CO2 in Chemistry Lab B-204"),
        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2000, 7026],
          rows: [
            new TableRow({ children: [cell("Building", 2000, { bold: true, fill: BLUE_HDR }), cell("B-Block — Chemistry Lab B-204", 7026, { fill: BLUE_HDR, bold: true })] }),
            new TableRow({ children: [cell("Severity", 2000, { bold: true }), cell("Elevated Risk", 7026, { fill: ORANGE_ROW })] }),
            new TableRow({ children: [cell("What It Means", 2000, { bold: true, fill: YELLOW_ROW }), cell("CO2 levels in Lab B-204 are above the safe threshold. Centrifuges were left running overnight, contributing to poor air quality. The HVAC ventilation may not be keeping up.", 7026, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Why It Matters", 2000, { bold: true }), cell("High CO2 levels cause drowsiness, reduced concentration, and in severe cases, health risks. In a chemistry lab, poor ventilation can also allow other harmful gases to accumulate. The lab should not be occupied until ventilation is restored and equipment is checked.", 7026)] }),
          ]
        }),
        ...spacer(1),
        pageBreak(),

        // ─────────────────────────────────────────────────────────────────
        // SECTION 9: Key Numbers
        // ─────────────────────────────────────────────────────────────────
        h1("Section 9: Key Numbers to Remember for Your Presentation"),
        divider(),
        para("If you are presenting NeuraGrid, these are the most important numbers to know and be able to quote confidently. Print this page and keep it in front of you during your presentation."),
        ...spacer(1),

        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [3500, 2000, 3526],
          rows: [
            hdrRow(["What You Are Quoting", "The Number", "Why It Is Impressive / Important"], [3500, 2000, 3526]),
            new TableRow({ children: [
              cell("Total campus electricity capacity", 3500, { bold: true }),
              cell("5,100 kW", 2000, { fill: YELLOW_ROW, bold: true }),
              cell("The system monitors this entire infrastructure in real time", 3526),
            ]}),
            new TableRow({ children: [
              cell("Current total campus load", 3500, { bold: true, fill: YELLOW_ROW }),
              cell("3,532 kW", 2000, { fill: YELLOW_ROW, bold: true }),
              cell("That is live data — not historical, not estimated", 3526, { fill: YELLOW_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Campus utilisation", 3500, { bold: true }),
              cell("69%", 2000, { fill: YELLOW_ROW, bold: true }),
              cell("Manageable but 3 buildings are in the danger zone", 3526),
            ]}),
            new TableRow({ children: [
              cell("Total renewable generation", 3500, { bold: true, fill: GREEN_ROW }),
              cell("458 kW", 2000, { fill: GREEN_ROW, bold: true }),
              cell("Solar 340 kW + Wind 118 kW = 458 kW of clean power", 3526, { fill: GREEN_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Current renewable share", 3500, { bold: true, fill: YELLOW_ROW }),
              cell("13%", 2000, { fill: YELLOW_ROW, bold: true }),
              cell("Target is 30% — shows there is room to improve", 3526, { fill: YELLOW_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Grid electricity being purchased", 3500, { bold: true }),
              cell("3,074 kW", 2000, { fill: ORANGE_ROW, bold: true }),
              cell("This is what the university pays for — the goal is to reduce it", 3526),
            ]}),
            new TableRow({ children: [
              cell("CO2 produced per hour", 3500, { bold: true, fill: RED_ROW }),
              cell("1.23 tonnes", 2000, { fill: RED_ROW, bold: true }),
              cell("1,230 kg of CO2 every hour — shows why efficiency matters", 3526, { fill: RED_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Total energy used today", 3500, { bold: true }),
              cell("30,000 kWh", 2000, { fill: YELLOW_ROW, bold: true }),
              cell("Equivalent to powering about 1,000 average homes for a day", 3526),
            ]}),
            new TableRow({ children: [
              cell("Today's savings vs baseline", 3500, { bold: true, fill: GREEN_ROW }),
              cell("Rs 89,540", 2000, { fill: GREEN_ROW, bold: true }),
              cell("The app has already saved nearly Rs 90,000 just today", 3526, { fill: GREEN_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Number of buildings monitored", 3500, { bold: true }),
              cell("6 buildings", 2000, { fill: YELLOW_ROW, bold: true }),
              cell("All active, all monitored live, 24/7", 3526),
            ]}),
            new TableRow({ children: [
              cell("Active alerts right now", 3500, { bold: true, fill: ORANGE_ROW }),
              cell("5 alerts", 2000, { fill: ORANGE_ROW, bold: true }),
              cell("Across 3 buildings — the system detected all of these automatically", 3526, { fill: ORANGE_ROW }),
            ]}),
            new TableRow({ children: [
              cell("System uptime reliability", 3500, { bold: true }),
              cell("99.7%", 2000, { fill: GREEN_ROW, bold: true }),
              cell("Near-perfect uptime — the monitoring never misses anything", 3526),
            ]}),
            new TableRow({ children: [
              cell("Electricity rate (blended)", 3500, { bold: true, fill: YELLOW_ROW }),
              cell("Rs 12.284/kWh", 2000, { fill: YELLOW_ROW, bold: true }),
              cell("Peak rate is Rs 17.43/kWh; off-peak is Rs 8.84/kWh", 3526, { fill: YELLOW_ROW }),
            ]}),
            new TableRow({ children: [
              cell("Proactive HVAC fix saves", 3500, { bold: true, fill: GREEN_ROW }),
              cell("Rs 6,80,600", 2000, { fill: GREEN_ROW, bold: true }),
              cell("Just one AI recommendation prevents an emergency breakdown worth this much", 3526, { fill: GREEN_ROW }),
            ]}),
            new TableRow({ children: [
              cell("AV load shifting saves", 3500, { bold: true, fill: GREEN_ROW }),
              cell("Rs 21,340/month", 2000, { fill: GREEN_ROW, bold: true }),
              cell("Without any hardware changes — just rescheduling", 3526, { fill: GREEN_ROW }),
            ]}),
          ]
        }),
        ...spacer(1),
        pageBreak(),

        // ─────────────────────────────────────────────────────────────────
        // SECTION 10: Q&A
        // ─────────────────────────────────────────────────────────────────
        h1("Section 10: Possible Presentation Questions and Answers"),
        divider(),
        para("Here are 10 questions your audience or examiners are likely to ask, with clear and confident answers ready for you."),
        ...spacer(1),

        h2("Q1: What exactly is a \"digital twin\"?"),
        callout("A digital twin is a live virtual copy of something real that mirrors what is happening in reality. In NeuraGrid, the digital twin is a 3D model of the university campus where each building is updated in real time with its actual energy data. If A-Block starts overloading, the 3D model shows it glowing red immediately. It is used in industries like aerospace and manufacturing to monitor and test systems without touching the real equipment.", BLUE_HDR),
        ...spacer(1),

        h2("Q2: How does the AI know something is wrong?"),
        callout("The AI learns from historical data — it studies months of normal energy patterns to understand what is typical for each building at each hour of the day. When something deviates significantly from that learned pattern, it flags it as an anomaly. For example, if B-Block normally uses 400 kW at 2 AM but suddenly uses 665 kW, the AI detects this as unusual and raises an alert. It also uses predictive models trained on patterns like temperature-load correlations and equipment degradation rates.", BLUE_HDR),
        ...spacer(1),

        h2("Q3: Is the data real or simulated?"),
        callout("In this version of NeuraGrid, the data is simulated but based on realistic values for a real Indian university campus. The numbers, building types, equipment lists, and energy behaviours are all designed to reflect what a real campus energy monitoring system would see. The architecture of the app is fully real and ready to connect to actual IoT sensors and building management systems.", BLUE_HDR),
        ...spacer(1),

        h2("Q4: How much money does this actually save?"),
        callout("On the current day shown in the dashboard, NeuraGrid has already saved Rs 89,540 compared to the unoptimised baseline. The AI has identified specific actions that would save an additional Rs 6,80,600 by preventing a HVAC breakdown, plus Rs 21,340 per month from simple load shifting. Across a full year, the total savings from all recommendations could easily reach several crore rupees for a large campus.", BLUE_HDR),
        ...spacer(1),

        h2("Q5: Why is A-Block so stressed compared to other buildings?"),
        callout("A-Block houses the university's primary server infrastructure and GPU cluster. Servers and high-performance GPUs run 24 hours a day and generate enormous heat. This means both the servers themselves and the air conditioning required to cool them are consuming power continuously. Unlike classrooms that are empty at night, server rooms never switch off. Additionally, the AI has detected that A-Block's HVAC unit A-3 is running at 94% load, which means it is struggling to keep up with the heat — pushing the building's total load even higher.", BLUE_HDR),
        ...spacer(1),

        h2("Q6: What happens if an alert is ignored?"),
        callout("Different alerts have different consequences. If the A-Block near-capacity alert is ignored and the building exceeds 880 kW, the circuit protection systems will trip and cut power to the entire building — shutting down all servers and computers suddenly. If the B-Block HVAC alert is ignored and the compressor fails, chemistry labs may lose temperature and ventilation control, creating both a safety hazard and an emergency repair bill of nearly Rs 7 lakh. NeuraGrid is designed to prevent these scenarios by giving advance warning.", BLUE_HDR),
        ...spacer(1),

        h2("Q7: Why is the renewable share only 13% when the target is 30%?"),
        callout("The campus currently only has solar panels on the Green Building, generating 340 kW, plus 118 kW from wind — a total of 458 kW out of a total demand of 3,532 kW. To reach 30%, the campus would need approximately 1,060 kW from renewables. This would require expanding solar installations to other building rooftops, potentially adding more wind capacity, or installing battery storage to capture and use solar power more efficiently. NeuraGrid identifies these opportunities and helps prioritise where to invest.", BLUE_HDR),
        ...spacer(1),

        h2("Q8: Could this system work at a real university?"),
        callout("Yes, absolutely. Systems exactly like NeuraGrid are already deployed at universities, hospitals, airports, and corporate campuses around the world. They connect to real IoT (Internet of Things) sensors in every room, to HVAC control panels, smart electricity meters, and building management systems. The NeuraGrid codebase uses modern web technologies and a realistic data architecture that is ready to be connected to real hardware with appropriate engineering work.", BLUE_HDR),
        ...spacer(1),

        h2("Q9: What is the most impressive technical feature of NeuraGrid?"),
        callout("The most impressive feature is the combination of the AI Insights engine with the Digital Twin. Most energy dashboards just show you live data — NeuraGrid's AI analyses patterns, predicts future failures with confidence percentages, auto-creates maintenance tickets, and calculates exact savings figures for each recommendation. The Digital Twin gives the whole system a spatial context you cannot get from spreadsheets or charts — you can instantly see which building has a problem and click into it. Together, these features represent a significant step beyond simple monitoring towards intelligent, predictive energy management.", BLUE_HDR),
        ...spacer(1),

        h2("Q10: What would be the next steps to improve NeuraGrid?"),
        callout("Several enhancements would make it even more powerful. First, connecting to real sensor data by integrating with actual IoT devices and building management systems. Second, adding battery storage monitoring so the system can track when to store excess solar power and when to release it. Third, building a mobile app version so energy managers can receive alerts and approve recommendations from their phones. Fourth, implementing automated control — not just recommending actions but automatically adjusting thermostats, scheduling equipment, and managing lighting through direct BMS integration. Fifth, expanding the renewable energy tracking to include future-planned solar capacity and giving the university a roadmap to reach the 30% renewable target.", BLUE_HDR),
        ...spacer(1),

        pageBreak(),

        // ─────────────────────────────────────────────────────────────────
        // FINAL PAGE: Quick Reference Glossary
        // ─────────────────────────────────────────────────────────────────
        h1("Appendix: Quick Reference Glossary"),
        divider(),
        para("A handy reference for all the technical terms used in NeuraGrid:"),
        ...spacer(1),

        new Table({
          width: { size: 9026, type: WidthType.DXA },
          columnWidths: [2200, 6826],
          rows: [
            hdrRow(["Term", "Simple Definition"], [2200, 6826]),
            new TableRow({ children: [cell("kW (kilowatt)", 2200, { bold: true }), cell("How fast electricity is being used right now. Like the speedometer reading in a car.", 6826)] }),
            new TableRow({ children: [cell("kWh (kilowatt-hour)", 2200, { bold: true, fill: YELLOW_ROW }), cell("The total amount of electricity used over time. Like the distance on an odometer.", 6826, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Capacity", 2200, { bold: true }), cell("The maximum electricity a building can handle. The size of the pipe.", 6826)] }),
            new TableRow({ children: [cell("Current Load", 2200, { bold: true, fill: YELLOW_ROW }), cell("How much electricity a building is using right now. How full the pipe currently is.", 6826, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Utilisation %", 2200, { bold: true }), cell("Current load divided by capacity, shown as a percentage. How full the building is.", 6826)] }),
            new TableRow({ children: [cell("HVAC", 2200, { bold: true, fill: YELLOW_ROW }), cell("Heating, Ventilation, Air Conditioning. The climate control system. The biggest energy user.", 6826, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("CO2 / ppm", 2200, { bold: true }), cell("Carbon dioxide concentration in a room. Above 1,000 ppm means poor air quality.", 6826)] }),
            new TableRow({ children: [cell("Renewable Energy", 2200, { bold: true, fill: GREEN_ROW }), cell("Electricity from solar or wind — clean and free once the equipment is installed.", 6826, { fill: GREEN_ROW })] }),
            new TableRow({ children: [cell("Grid Draw", 2200, { bold: true }), cell("Electricity bought from the city power network. What you pay for.", 6826)] }),
            new TableRow({ children: [cell("Peak Hours", 2200, { bold: true, fill: RED_ROW }), cell("9 AM to 5 PM. Most expensive electricity. Avoid running heavy equipment then.", 6826, { fill: RED_ROW })] }),
            new TableRow({ children: [cell("Off-Peak Hours", 2200, { bold: true, fill: GREEN_ROW }), cell("10 PM to 6 AM. Cheapest electricity. Best time to run energy-heavy tasks.", 6826, { fill: GREEN_ROW })] }),
            new TableRow({ children: [cell("Load Shifting", 2200, { bold: true }), cell("Moving tasks from expensive peak hours to cheap off-peak hours. Same work, less cost.", 6826)] }),
            new TableRow({ children: [cell("Pre-Cooling", 2200, { bold: true, fill: YELLOW_ROW }), cell("Cooling a building before peak hours using cheap electricity, so AC runs less during expensive hours.", 6826, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Carbon Factor", 2200, { bold: true }), cell("0.386 kg of CO2 produced per kWh from grid electricity. Used to calculate pollution.", 6826)] }),
            new TableRow({ children: [cell("Baseline", 2200, { bold: true, fill: YELLOW_ROW }), cell("The historical average — what a building normally uses. Used to calculate savings %.", 6826, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Demand Charge", 2200, { bold: true }), cell("Extra fee from utilities for your peak power spike in the billing month — even briefly.", 6826)] }),
            new TableRow({ children: [cell("BMS", 2200, { bold: true, fill: YELLOW_ROW }), cell("Building Management System. Automated control brain for HVAC, lights, elevators, etc.", 6826, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("Digital Twin", 2200, { bold: true }), cell("A live virtual 3D copy of the real campus, updated in real time with actual energy data.", 6826)] }),
            new TableRow({ children: [cell("Anomaly Detection", 2200, { bold: true, fill: YELLOW_ROW }), cell("AI spotting unusual patterns that deviate from normal — like a lab running at 3 AM.", 6826, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("IoT Sensor", 2200, { bold: true }), cell("Internet of Things — small connected devices that measure temperature, power, occupancy, etc.", 6826)] }),
            new TableRow({ children: [cell("GPU Cluster", 2200, { bold: true, fill: YELLOW_ROW }), cell("A group of graphics processing units used for AI computation. Very high power draw.", 6826, { fill: YELLOW_ROW })] }),
            new TableRow({ children: [cell("CNC Machine", 2200, { bold: true }), cell("Computer Numerical Control machine — automated cutting/shaping tool. High power draw.", 6826)] }),
            new TableRow({ children: [cell("Mass Spectrometer", 2200, { bold: true, fill: YELLOW_ROW }), cell("Scientific instrument that identifies chemical compounds. Common in chemistry labs. High power draw.", 6826, { fill: YELLOW_ROW })] }),
          ]
        }),
        ...spacer(2),

        para("This guide was prepared to help you present NeuraGrid with confidence. You built something genuinely impressive — a working smart energy management system with real-time monitoring, AI-powered predictions, 3D visualization, and a detailed optimization engine. Good luck with your presentation!", { bold: false, italic: true, color: "595959" }),

      ]
    }
  ]
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync("C:\\NeuraGrid\\NeuraGrid_Guide.docx", buffer);
  console.log("SUCCESS: NeuraGrid_Guide.docx written to C:\\NeuraGrid\\");
}).catch(err => {
  console.error("ERROR:", err);
  process.exit(1);
});
