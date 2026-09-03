export const SHARED_STANDARD_PICKUP_AND_DELIVERY_FEE = 1500;
export const SHARED_EXPRESS_SURCHARGE_RATE = 0.5;
export const SHARED_EXPRESS_DELIVERY_FEE = 2500;
export const SHARED_ROUNDING_STEP = 10;

export const SHARED_MODE_MULTIPLIERS = {
  "wash-iron": 1,
  "ironing-only": 0.6,
  "washing-only": 0.5,
} as const;

export type SharedLaundryMode = keyof typeof SHARED_MODE_MULTIPLIERS;

export const SHARED_LAUNDRY_CATALOG = [
  { id: "polo", name: "Polos", basePrice: 300, category: "regular" },
  { id: "long-sleeved-shirt", name: "Long-sleeved Shirts", basePrice: 300, category: "regular" },
  { id: "underwear", name: "Underwear", basePrice: 300, category: "regular" },
  { id: "shorts", name: "Shorts", basePrice: 300, category: "regular" },
  { id: "skirt", name: "Skirts", basePrice: 300, category: "regular" },
  { id: "trouser", name: "Trousers", basePrice: 300, category: "regular" },
  { id: "up-and-down", name: "Up & Down Sets", basePrice: 600, category: "regular" },
  { id: "overall", name: "Overalls", basePrice: 600, category: "regular" },
  { id: "jean-overall", name: "Jean Overalls", basePrice: 800, category: "regular" },
  { id: "duvet", name: "Duvets", basePrice: 2500, category: "regular" },
  { id: "blanket", name: "Blankets", basePrice: 700, category: "regular" },
  { id: "full-suit", name: "Full Suits (Coats, Jackets & Trousers)", basePrice: 1500, category: "regular" },
  { id: "gown", name: "Gowns", basePrice: 600, category: "regular" },
  { id: "bedsheet", name: "Bedsheets", basePrice: 700, category: "regular" },
  { id: "wrapper", name: "Wrappers", basePrice: 500, category: "regular" },
  { id: "jalabia", name: "Jalabias", basePrice: 600, category: "regular" },
  { id: "socks-caps", name: "Socks & Caps", basePrice: 100, category: "regular" },
  { id: "agbada", name: "Agbadas", basePrice: 1500, category: "regular" },
  { id: "towel", name: "Towels", basePrice: 600, category: "regular" },
  { id: "curtains", name: "Curtains", basePrice: 1000, category: "regular" },
  { id: "ceremonial-gown", name: "Ceremonial Gowns (Convocation, Graduation, etc)", basePrice: 1500, category: "regular" },
  { id: "foot-mat", name: "Foot Mats", basePrice: 1000, category: "extras" },
  { id: "slippers-palms", name: "Slippers / Palms", basePrice: 1000, category: "extras" },
  { id: "shoe-canvas", name: "Shoes / Canvas", basePrice: 1000, category: "extras" },
  { id: "bags", name: "Bags", basePrice: 1000, category: "extras" },
] as const;

export function sharedRoundToNearest(value: number, step = SHARED_ROUNDING_STEP) {
  return Number.isFinite(value) ? Math.round(value / step) * step : 0;
}

export function calculateServerPricing(
  items: { id: string; quantity: number; mode?: string }[],
  fallbackMode: string,
  isExpress: boolean,
  pickupDeliveryFee = SHARED_STANDARD_PICKUP_AND_DELIVERY_FEE,
) {
  if (!(fallbackMode in SHARED_MODE_MULTIPLIERS)) {
    throw new Error("Unsupported laundry mode");
  }
  if (!items.length || items.length > SHARED_LAUNDRY_CATALOG.length) {
    throw new Error("Select at least one valid laundry item");
  }

  const catalog = new Map<string, (typeof SHARED_LAUNDRY_CATALOG)[number]>(
    SHARED_LAUNDRY_CATALOG.map((item) => [item.id, item]),
  );
  const seen = new Set<string>();
  const lineItems = items.map((requested) => {
    const item = catalog.get(requested.id);
    const itemMode = requested.mode ?? fallbackMode;
    if (!item || seen.has(requested.id)) throw new Error("The order contains an invalid or duplicate item");
    if (!Number.isInteger(requested.quantity) || requested.quantity < 1 || requested.quantity > 100) {
      throw new Error("Item quantities must be whole numbers between 1 and 100");
    }
    if (!(itemMode in SHARED_MODE_MULTIPLIERS)) throw new Error("Unsupported item laundry mode");
    seen.add(requested.id);
    const unitPrice = sharedRoundToNearest(
      item.basePrice * SHARED_MODE_MULTIPLIERS[itemMode as SharedLaundryMode],
    );
    return { ...item, quantity: requested.quantity, mode: itemMode, unitPrice };
  });

  const modeSubtotal = lineItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
  if (
    !Number.isFinite(pickupDeliveryFee) ||
    pickupDeliveryFee < 0 ||
    pickupDeliveryFee > SHARED_STANDARD_PICKUP_AND_DELIVERY_FEE
  ) {
    throw new Error("Invalid pickup and delivery fee");
  }
  const standardTotal = modeSubtotal + pickupDeliveryFee;
  const expressPremium = sharedRoundToNearest(standardTotal * SHARED_EXPRESS_SURCHARGE_RATE);
  const expressTotal = standardTotal + expressPremium + SHARED_EXPRESS_DELIVERY_FEE;
  return {
    lineItems,
    modeSubtotal,
    pickupDeliveryFee,
    sharedPickupDiscount:
      SHARED_STANDARD_PICKUP_AND_DELIVERY_FEE - pickupDeliveryFee,
    standardTotal,
    expressPremium,
    expressDeliveryFee: SHARED_EXPRESS_DELIVERY_FEE,
    expressTotal,
    finalAmount: isExpress ? expressTotal : standardTotal,
  };
}
