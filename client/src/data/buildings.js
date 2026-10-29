/**
 * NeuraGrid — Single Source of Truth for Campus Buildings
 *
 * ALL components import from here.  Never define building metadata anywhere else.
 *
 * Fields present in every entry:
 *   Core         — id, name, shortName, type, icon, floors, area, gridX/Y, color, accentColor
 *   Energy       — capacity, currentLoad, baseLoad, occupancy, status, temperature,
 *                  humidity, co2, lighting, hvacLoad, lightingLoad, equipmentLoad,
 *                  todayKwh, weekKwh, monthKwh, savings, carbonKg, alerts,
 *                  renewableContribution
 *   Descriptive  — classroomCount, subtitle, description, deviceList
 *   2-D Map      — baseDevices, baseOccupancy, baseTemp  (Leaflet geometry added in campusData.js)
 *   3-D Scene    — position, size, camPosition, camTarget  (used by useCampusData3D.js)
 *
 * Campus layout (left = west, right = east):
 *
 *   WEST (left)                    EAST (right)
 *   ┌──────────────┐               ┌──────────────┐
 *   │ Green Bldg   │   ROAD        │   A-Block    │  ← North row
 *   └──────────────┘               └──────────────┘
 *   ┌─────────────────────────┐    ┌───────────────────────────┐
 *   │   B-Block  (very wide)  │    │   C-Block  (widest/tallest)│  ← Middle row
 *   └─────────────────────────┘    └───────────────────────────┘
 *   ┌───────────────────────┐      ┌──────────────────┐
 *   │  Steve Jobs Aud.      │      │  Mech & Civil    │  ← South row
 *   └───────────────────────┘      └──────────────────┘
 *
 * Campus totals (South Indian engineering college):
 *   capacity total : 220+380+320+480+350+560 = 2310 kW
 *   baseLoad total : 128+248+195+290+215+318 = 1394 kW  (60% utilisation)
 */

export const BUILDINGS = [

  // ══════════════════ WEST / LEFT CLUSTER ════════════════════════════════════

  {
    // ── Core ─────────────────────────────────────────────────────────────────
    id:          'green',
    name:        'Green Building',
    shortName:   'GREEN',
    type:        'academic',
    icon:        '🌿',
    floors:      6,
    area:        '32,000 sq ft',
    gridX:       0,
    gridY:       0,
    color:       '#059669',
    accentColor: '#0284C7',

    // ── Capacity & base load ─────────────────────────────────────────────────
    capacity:    220,
    baseLoad:    128,      // ~58 % — highly efficient eco-hub

    // ── Live energy telemetry (initial values; live-updated by EnergyContext) ──
    currentLoad:      128,
    occupancy:        62,
    status:           'normal',
    temperature:      78,
    humidity:         64,
    co2:              510,
    lighting:         70,
    hvacLoad:          52,
    lightingLoad:      28,
    equipmentLoad:     48,
    todayKwh:        1088,
    weekKwh:         7616,
    monthKwh:       29376,
    savings:            9,  // % below baseline — best on campus
    carbonKg:         105,
    renewableContribution: 22,   // % of load met by on-site solar
    alerts:           [],

    // ── Descriptive ──────────────────────────────────────────────────────────
    classroomCount: 35,
    subtitle:       'Sustainability & Admin',
    description:    'Eco-research hub, administration & sustainability initiatives. Houses solar control systems and campus-wide energy management centre.',
    baseDevices:    62,
    baseOccupancy:  62,
    baseTemp:       78,
    deviceList: [
      { name: 'Solar Array Inverters', count: 12, status: 'active'  },
      { name: 'HVAC Units',            count:  8, status: 'active'  },
      { name: 'Admin Workstations',    count: 34, status: 'active'  },
      { name: 'Energy Monitors',       count:  8, status: 'active'  },
    ],

    // ── 3-D scene ─────────────────────────────────────────────────────────────
    position:    [-15, 0, -12],
    size:        [9, 12, 8],       // standard width, medium height
    camPosition: [-15, 20,   4],
    camTarget:   [-15,  6, -12],
  },

  // ─────────────────────────────────────────────────────────────────────────────

  {
    id:          'bblock',
    name:        'B-Block',
    shortName:   'B-BLK',
    type:        'lab',
    icon:        '⚗️',
    floors:      7,
    area:        '58,000 sq ft',
    gridX:       1,
    gridY:       0,
    color:       '#7C3AED',
    accentColor: '#EA580C',

    capacity:    320,
    baseLoad:    195,      // ~61 % — heavy lab loads

    currentLoad:      195,
    occupancy:        74,
    status:           'warning',
    temperature:      77,
    humidity:         65,
    co2:              780,
    lighting:         85,
    hvacLoad:          74,
    lightingLoad:      46,
    equipmentLoad:     75,
    todayKwh:        1658,
    weekKwh:        11606,
    monthKwh:       44754,
    savings:           -2,
    carbonKg:         160,
    renewableContribution: 6,
    alerts: [
      'HVAC units 3 & 4 above efficiency threshold',
      'High CO₂ detected in Chemistry Lab B-204',
    ],

    classroomCount: 42,
    subtitle:       'Physics & Chemistry Labs',
    description:    'Physics, chemistry, material science & spectroscopy labs. Largest lab block on the west campus side — heavy equipment drives high base load.',
    baseDevices:    122,
    baseOccupancy:   74,
    baseTemp:        77,
    deviceList: [
      { name: 'Mass Spectrometers', count: 18, status: 'active'  },
      { name: 'Lab Instruments',    count: 56, status: 'active'  },
      { name: 'HVAC Systems',       count: 14, status: 'warning' },
      { name: 'Safety Systems',     count: 34, status: 'active'  },
    ],

    position:    [-14, 0,  1],
    size:        [18, 14, 8],      // VERY WIDE (18 units)
    camPosition: [-14, 22, 18],
    camTarget:   [-14,  7,  1],
  },

  // ─────────────────────────────────────────────────────────────────────────────

  {
    id:          'stevejobs',
    name:        'Steve Jobs Auditorium',
    shortName:   'SJ-AUD',
    type:        'auditorium',
    icon:        '🎭',
    floors:      3,
    area:        '41,000 sq ft',
    gridX:       0,
    gridY:       1,
    color:       '#EA580C',
    accentColor: '#EA580C',

    capacity:    350,
    baseLoad:    215,      // ~61 % — moderate

    currentLoad:      215,
    occupancy:        55,
    status:           'normal',
    temperature:      75,
    humidity:         57,
    co2:              580,
    lighting:         80,
    hvacLoad:          80,
    lightingLoad:      52,
    equipmentLoad:     83,
    todayKwh:        1828,
    weekKwh:        12796,
    monthKwh:       49364,
    savings:            6,
    carbonKg:         176,
    renewableContribution: 10,
    alerts:           [],

    classroomCount: 15,
    subtitle:       'Advanced CS & Innovation Hub',
    description:    'Advanced computing, AR/VR studios & campus innovation hub. Wide, low-profile inspired by iconic auditorium design. Hosts major tech events.',
    baseDevices:     78,
    baseOccupancy:   55,
    baseTemp:        75,
    deviceList: [
      { name: 'Stage AV Systems',  count: 24, status: 'active' },
      { name: 'AR/VR Rigs',        count: 18, status: 'active' },
      { name: 'Workstations',      count: 32, status: 'active' },
      { name: 'Ambient Lighting',  count:  4, status: 'active' },
    ],

    position:    [-15, 0, 16],
    size:        [16, 7, 13],      // WIDE and LOW (Apple-style)
    camPosition: [-15, 14, 34],
    camTarget:   [-15,  3, 16],
  },

  // ══════════════════ EAST / RIGHT CLUSTER ═══════════════════════════════════

  {
    id:          'ablock',
    name:        'A-Block',
    shortName:   'A-BLK',
    type:        'lab',
    icon:        '💻',
    floors:      7,
    area:        '52,000 sq ft',
    gridX:       2,
    gridY:       0,
    color:       '#0284C7',
    accentColor: '#7C3AED',

    capacity:    380,
    baseLoad:    248,      // ~65 % — highest load on campus (servers + workstations)

    currentLoad:      248,
    occupancy:        88,
    status:           'warning',
    temperature:      78,
    humidity:         60,
    co2:              845,
    lighting:         92,
    hvacLoad:          92,
    lightingLoad:      58,
    equipmentLoad:     98,
    todayKwh:        2108,
    weekKwh:        14756,
    monthKwh:       56916,
    savings:           -5,
    carbonKg:         203,
    renewableContribution: 4,
    alerts: [
      'Server room temperature elevated — 78°F',
      'HVAC Unit A-3 running at 94% load',
    ],

    classroomCount: 42,
    subtitle:       'Computer Science Labs',
    description:    'Programming, AI, networking & robotics laboratories. Tallest academic block; houses primary server infrastructure and GPU compute cluster.',
    baseDevices:    148,
    baseOccupancy:   88,
    baseTemp:        78,
    deviceList: [
      { name: 'Workstations & PCs', count: 82, status: 'active'  },
      { name: 'Server Racks',       count: 24, status: 'active'  },
      { name: 'HVAC',               count: 12, status: 'warning' },
      { name: 'Networking Gear',    count: 30, status: 'active'  },
    ],

    position:    [14, 0, -12],
    size:        [10, 16, 8],      // TALL (16 units)
    camPosition: [14, 22,   4],
    camTarget:   [14,  8, -12],
  },

  // ─────────────────────────────────────────────────────────────────────────────

  {
    id:          'cblock',
    name:        'C-Block',
    shortName:   'C-BLK',
    type:        'auditorium',
    icon:        '🏛️',
    floors:      8,
    area:        '88,000 sq ft',
    gridX:       2,
    gridY:       1,
    color:       '#EA580C',
    accentColor: '#DB2777',

    capacity:    480,
    baseLoad:    290,      // ~60 % — large but well managed

    currentLoad:      290,
    occupancy:         80,
    status:           'normal',
    temperature:       76,
    humidity:          61,
    co2:              720,
    lighting:          88,
    hvacLoad:         108,
    lightingLoad:      66,
    equipmentLoad:    116,
    todayKwh:        2465,
    weekKwh:        17255,
    monthKwh:       66555,
    savings:            1,
    carbonKg:         238,
    renewableContribution: 8,
    alerts:           [],

    classroomCount: 50,
    subtitle:       'Main Auditorium & Central Hub',
    description:    'Campus main auditorium, central hub & highest classroom density block. Widest and tallest building on campus — hosts all-hands events and large lectures.',
    baseDevices:    196,
    baseOccupancy:   80,
    baseTemp:        76,
    deviceList: [
      { name: 'Main HVAC Plant',      count:  8, status: 'active'  },
      { name: 'Stage & AV',           count: 42, status: 'active'  },
      { name: 'Smart Lighting',       count: 86, status: 'active'  },
      { name: 'Lifts & Escalators',   count: 12, status: 'warning' },
      { name: 'Security Systems',     count: 48, status: 'active'  },
    ],

    position:    [14, 0,  2],
    size:        [20, 20, 11],     // WIDEST (20) and TALLEST (20)
    camPosition: [14, 32, 24],
    camTarget:   [14, 10,  2],
  },

  // ─────────────────────────────────────────────────────────────────────────────

  {
    id:          'mechlabs',
    name:        'Mech & Civil Labs',
    shortName:   'MECH',
    type:        'lab',
    icon:        '🔧',
    floors:      4,
    area:        '44,000 sq ft',
    gridX:       1,
    gridY:       1,
    color:       '#DB2777',
    accentColor: '#EA580C',

    capacity:    560,
    baseLoad:    318,      // ~57 % — industrial machines drive high load

    currentLoad:      318,
    occupancy:        68,
    status:           'warning',
    temperature:      84,
    humidity:         70,
    co2:              920,
    lighting:         90,
    hvacLoad:         118,
    lightingLoad:      68,
    equipmentLoad:    132,
    todayKwh:        2703,
    weekKwh:        18921,
    monthKwh:       72969,
    savings:           -3,
    carbonKg:         261,
    renewableContribution: 3,
    alerts: [
      'Industrial exhaust fan 2 running above rated capacity',
    ],

    classroomCount: 18,
    subtitle:       'Engineering Workshop',
    description:    'Mechanical & civil engineering workshops, fabrication bays & structural testing facilities. Chunky industrial build — CNC, hydraulic presses, 3D metal printing.',
    baseDevices:     96,
    baseOccupancy:   68,
    baseTemp:        84,
    deviceList: [
      { name: 'CNC Machines',      count: 14, status: 'active'  },
      { name: 'Hydraulic Presses', count:  8, status: 'active'  },
      { name: 'Industrial HVAC',   count: 10, status: 'warning' },
      { name: '3D Metal Printers', count:  6, status: 'active'  },
      { name: 'Welding Stations',  count: 18, status: 'active'  },
      { name: 'Test Rigs',         count: 12, status: 'active'  },
    ],

    position:    [14, 0, 16],
    size:        [12, 9, 12],      // CHUNKY SQUARE — near-square, industrial
    camPosition: [14, 18, 34],
    camTarget:   [14,  4, 16],
  },
]

// ─── Convenience lookups ──────────────────────────────────────────────────────
export const BUILDING_BY_ID = Object.fromEntries(BUILDINGS.map(b => [b.id, b]))
