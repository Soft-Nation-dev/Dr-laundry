import {
    CatalogItem,
    LaundryMode,
    PickupDayCode,
    PickupWindowCode,
} from "@/types/order";

export const STANDARD_PICKUP_AND_DELIVERY_FEE = 1500;
export const EXPRESS_SURCHARGE_RATE = 0.5;
export const EXPRESS_DELIVERY_FEE = 2500;
export const ROUNDING_STEP = 10;

export const MODE_OPTIONS: Record<
  LaundryMode,
  { label: string; multiplier: number; detail: string }
> = {
  "wash-iron": {
    label: "Washing + Ironing",
    multiplier: 1,
    detail: "Full care",
  },
  "ironing-only": {
    label: "Ironing Only",
    multiplier: 0.6,
    detail: "60% of full care",
  },
  "washing-only": {
    label: "Washing Only",
    multiplier: 0.5,
    detail: "50% of full care",
  },
};

export const PICKUP_DAY_OPTIONS: Array<{
  code: PickupDayCode;
  label: string;
  offsetDays: number;
}> = [
  { code: "today", label: "Today", offsetDays: 0 },
  { code: "tomorrow", label: "Tomorrow", offsetDays: 1 },
  { code: "next-day", label: "Next day", offsetDays: 2 },
];

export const PICKUP_WINDOW_OPTIONS: Array<{
  code: PickupWindowCode;
  label: string;
  startHour: number;
  endHour: number;
}> = [
  { code: "morning", label: "10am to 12pm", startHour: 10, endHour: 12 },
  { code: "afternoon", label: "3pm to 5pm", startHour: 15, endHour: 17 },
  { code: "asap", label: "Immediate pickup", startHour: 0, endHour: 0 },
];

export const LAUNDRY_CATALOG: CatalogItem[] = [
  { id: "polo", name: "Polos", basePrice: 1500, category: "regular" },
  { id: "tshirt", name: "T-shirts", basePrice: 1500, category: "regular" },
  { id: "trouser", name: "Trousers", basePrice: 1500, category: "regular" },
  { id: "shorts", name: "Shorts", basePrice: 1200, category: "regular" },
  { id: "sportswear", name: "Sportswear", basePrice: 1500, category: "regular" },
  {
    id: "undergarments",
    name: "Undergarments",
    basePrice: 1000,
    category: "regular",
  },
  {
    id: "jean-trouser",
    name: "Jean trousers",
    basePrice: 2000,
    category: "regular",
  },
  {
    id: "jean-jacket",
    name: "Jean jackets",
    basePrice: 2500,
    category: "regular",
  },
  {
    id: "thick-jogger",
    name: "Thick joggers",
    basePrice: 2000,
    category: "regular",
  },
  { id: "overall", name: "Overalls", basePrice: 2500, category: "regular" },
  {
    id: "jean-overall",
    name: "Jean overalls",
    basePrice: 3000,
    category: "regular",
  },
  { id: "duvet", name: "Duvet", basePrice: 7500, category: "regular" },
  {
    id: "full-suit",
    name: "Full suit (coat, jacket, trouser)",
    basePrice: 5000,
    category: "regular",
  },
  {
    id: "short-gown",
    name: "Short gowns",
    basePrice: 2500,
    category: "regular",
  },
  {
    id: "long-gown",
    name: "Long gowns",
    basePrice: 3500,
    category: "regular",
  },
  { id: "bedsheet", name: "Bedsheets", basePrice: 2500, category: "regular" },
  { id: "wrapper", name: "Wrappers", basePrice: 2000, category: "regular" },
  { id: "jalabia", name: "Jalabia", basePrice: 2500, category: "regular" },
  { id: "sock", name: "Socks", basePrice: 500, category: "regular" },
  { id: "cap", name: "Caps", basePrice: 800, category: "regular" },
  { id: "agbada", name: "Agbada", basePrice: 5000, category: "regular" },
  {
    id: "senator",
    name: "Senator / up and down",
    basePrice: 3500,
    category: "regular",
  },
  { id: "towel", name: "Towel", basePrice: 2000, category: "regular" },
  { id: "curtain", name: "Curtains", basePrice: 4000, category: "regular" },
  {
    id: "ceremonial-gown",
    name: "Ceremonial gowns",
    basePrice: 5000,
    category: "regular",
  },
  { id: "foot-mat", name: "Foot mat", basePrice: 2500, category: "extras" },
  { id: "slippers", name: "Slippers", basePrice: 2000, category: "extras" },
  { id: "palms", name: "Palms", basePrice: 2500, category: "extras" },
  { id: "shoe", name: "Shoe", basePrice: 3500, category: "extras" },
  { id: "canvas", name: "Canvas", basePrice: 3500, category: "extras" },
  { id: "bag", name: "Bags", basePrice: 3500, category: "extras" },
];

export const ADDRESS_SUGGESTIONS = [
  "UNEC Male Hostel, Enugu",
  "UNEC Female Hostel, Enugu",
  "UNEC Staff Quarters, Enugu",
  "Marianna Gate, UNEC, Enugu",
  "Chime Avenue, New Haven, Enugu",
  "Kenyatta Market, Enugu",
  "Presidential Road, Enugu",
  "Achara Layout, Enugu",
  "Ogulurite Street, Enugu",
];

export const DEFAULT_ADDRESS_SUGGESTION = ADDRESS_SUGGESTIONS[0];

