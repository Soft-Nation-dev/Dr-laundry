import {
    CatalogItem,
    LaundryMode,
    PickupDayCode,
    PickupWindowCode,
} from "@/types/order";
import {
  SHARED_EXPRESS_DELIVERY_FEE,
  SHARED_EXPRESS_SURCHARGE_RATE,
  SHARED_LAUNDRY_CATALOG,
  SHARED_MODE_MULTIPLIERS,
  SHARED_ROUNDING_STEP,
  SHARED_STANDARD_PICKUP_AND_DELIVERY_FEE,
} from "@/shared/pricing-catalog";

export const STANDARD_PICKUP_AND_DELIVERY_FEE = SHARED_STANDARD_PICKUP_AND_DELIVERY_FEE;
export const EXPRESS_SURCHARGE_RATE = SHARED_EXPRESS_SURCHARGE_RATE;
export const EXPRESS_DELIVERY_FEE = SHARED_EXPRESS_DELIVERY_FEE;
export const ROUNDING_STEP = SHARED_ROUNDING_STEP;

export const MODE_OPTIONS: Record<
  LaundryMode,
  { label: string; multiplier: number; detail: string }
> = {
  "wash-iron": {
    label: "Washing + Ironing",
    multiplier: SHARED_MODE_MULTIPLIERS["wash-iron"],
    detail: "Full care",
  },
  "ironing-only": {
    label: "Ironing Only",
    multiplier: SHARED_MODE_MULTIPLIERS["ironing-only"],
    detail: "60% of full care",
  },
  "washing-only": {
    label: "Washing Only",
    multiplier: SHARED_MODE_MULTIPLIERS["washing-only"],
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
  { code: "morning", label: "8am to 10am", startHour: 8, endHour: 10 },
  { code: "afternoon", label: "5pm to 7pm", startHour: 17, endHour: 19 },
  { code: "asap", label: "Immediate pickup", startHour: 0, endHour: 0 },
];

export const LAUNDRY_CATALOG: CatalogItem[] = SHARED_LAUNDRY_CATALOG.map((item) => ({ ...item }));

// Enugu address suggestions (used as hints — any free-text Enugu location is accepted)
export const ADDRESS_SUGGESTIONS = [
  "UNEC Male Hostel, Enugu",
  "UNEC Female Hostel, Enugu",
  "UNEC Staff Quarters, Enugu",
  "Marianna Gate, UNEC, Enugu",
  "Agbani Road, Enugu",
  "New Haven, Enugu",
  "Chime Avenue, New Haven, Enugu",
  "Trans-Ekulu, Enugu",
  "Independence Layout, Enugu",
  "GRA, Enugu",
  "Ogui Road, Enugu",
  "Uwani, Enugu",
  "Achara Layout, Enugu",
  "Coal Camp, Enugu",
  "Abakpa Nike, Enugu",
  "Emene, Enugu",
  "Presidential Road, Enugu",
  "Kenyatta Market, Enugu",
  "Mayor Bus Stop, Enugu",
  "Okpara Avenue, Enugu",
  "Asata, Enugu",
  "Obiagu, Enugu",
  "Ngwo, Enugu",
  "9th Mile Corner, Enugu",
  "Udi, Enugu",
];

export const DEFAULT_ADDRESS_SUGGESTION = "";

