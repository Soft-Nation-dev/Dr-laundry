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
  { id: "polo", name: "Polos", basePrice: 300, category: "regular" },
  { id: "tshirt", name: "T-shirts", basePrice: 300, category: "regular" },
  { id: "trouser", name: "Trousers", basePrice: 300, category: "regular" },
  { id: "shorts", name: "Shorts", basePrice: 300, category: "regular" },
  { id: "sportswear", name: "Sportswear", basePrice: 300, category: "regular" },
  {
    id: "undergarments",
    name: "Undergarments",
    basePrice: 300,
    category: "regular",
  },
  {
    id: "jean-trouser",
    name: "Jean trousers",
    basePrice: 500,
    category: "regular",
  },
  {
    id: "jean-jacket",
    name: "Jean jackets",
    basePrice: 500,
    category: "regular",
  },
  {
    id: "thick-jogger",
    name: "Thick joggers",
    basePrice: 500,
    category: "regular",
  },
  { id: "overall", name: "Overalls", basePrice: 600, category: "regular" },
  {
    id: "jean-overall",
    name: "Jean overalls",
    basePrice: 800,
    category: "regular",
  },
  { id: "duvet", name: "Duvet", basePrice: 3000, category: "regular" },
  {
    id: "full-suit",
    name: "Full suit (coat, jacket, trouser)",
    basePrice: 1500,
    category: "regular",
  },
  {
    id: "short-gown",
    name: "Short gowns",
    basePrice: 500,
    category: "regular",
  },
  {
    id: "long-gown",
    name: "Long gowns",
    basePrice: 700,
    category: "regular",
  },
  { id: "bedsheet", name: "Bedsheets", basePrice: 700, category: "regular" },
  { id: "wrapper", name: "Wrappers", basePrice: 500, category: "regular" },
  { id: "jalabia", name: "Jalabia", basePrice: 500, category: "regular" },
  { id: "sock", name: "Socks", basePrice: 100, category: "regular" },
  { id: "cap", name: "Caps", basePrice: 100, category: "regular" },
  { id: "agbada", name: "Agbada", basePrice: 1500, category: "regular" },
  {
    id: "senator",
    name: "Senator / up and down",
    basePrice: 800,
    category: "regular",
  },
  { id: "towel", name: "Towel", basePrice: 700, category: "regular" },
  { id: "curtain", name: "Curtains", basePrice: 1000, category: "regular" },
  {
    id: "ceremonial-gown",
    name: "Ceremonial gowns",
    basePrice: 1500,
    category: "regular",
  },
  { id: "foot-mat", name: "Foot mat", basePrice: 1000, category: "extras" },
  { id: "slippers", name: "Slippers", basePrice: 1000, category: "extras" },
  { id: "palms", name: "Palms", basePrice: 1000, category: "extras" },
  { id: "shoe", name: "Shoe", basePrice: 1000, category: "extras" },
  { id: "canvas", name: "Canvas", basePrice: 1000, category: "extras" },
  { id: "bag", name: "Bags", basePrice: 1000, category: "extras" },
];
