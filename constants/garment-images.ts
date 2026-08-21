export const GARMENT_IMAGES: Record<string, number> = {
  polo: require("../assets/images/garments/polo.webp"),
  tshirt: require("../assets/images/garments/tshirt.webp"),
  blouse: require("../assets/images/garments/blouse.webp"),
  shorts: require("../assets/images/garments/shorts.webp"),
  skirt: require("../assets/images/garments/skirt.webp"),
  trouser: require("../assets/images/garments/trouser.webp"),
  "up-and-down": require("../assets/images/garments/up-and-down.webp"),
  overall: require("../assets/images/garments/overall.webp"),
  "jean-overall": require("../assets/images/garments/jean-overall.webp"),
  duvet: require("../assets/images/garments/duvet.webp"),
  blanket: require("../assets/images/garments/blanket.webp"),
  "full-suit": require("../assets/images/garments/full-suit.webp"),
  gown: require("../assets/images/garments/gown.webp"),
  bedsheet: require("../assets/images/garments/bedsheet.webp"),
  wrapper: require("../assets/images/garments/wrapper.webp"),
  jalabia: require("../assets/images/garments/jalabia.webp"),
  "socks-caps": require("../assets/images/garments/socks-caps.webp"),
  agbada: require("../assets/images/garments/agbada.webp"),
  towel: require("../assets/images/garments/towel.webp"),
  curtains: require("../assets/images/garments/curtains.webp"),
  "ceremonial-gown": require("../assets/images/garments/ceremonial-gown.webp"),
  "foot-mat": require("../assets/images/garments/foot-mat.webp"),
  "slippers-palms": require("../assets/images/garments/slippers-palms.webp"),
  "shoe-canvas": require("../assets/images/garments/shoe-canvas.webp"),
  bags: require("../assets/images/garments/bags.webp"),
};

export function getGarmentImage(itemId: string): number | undefined {
  return GARMENT_IMAGES[itemId];
}
