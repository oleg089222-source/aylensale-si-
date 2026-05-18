export type ProductBadge = "NEW" | "SALE" | "HOT" | null;
export type ProductStatus = "active" | "hidden" | "sold_out";
export type WeatherStatus = "GOOD" | "OK" | "BAD";

export type Product = {
  id: string;
  title: string;
  description?: string;
  category: string;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  badge: ProductBadge;
  status: ProductStatus;
  photos: string[];
  createdAt?: string;
  updatedAt?: string;
};

export type CarBootLocation = {
  id: string;
  name: string;
  postcode: string;
  photoUrl?: string;
  lat: number;
  lon: number;
  saturdayTemp?: number;
  sundayTemp?: number;
  saturdayRainPct?: number;
  sundayRainPct?: number;
  weatherStatus: WeatherStatus;
  goingThisWeekend: boolean;
  goingCount?: number;
  updatedAt?: string;
};

export type Order = {
  id: string;
  customerName: string;
  customerPhone: string;
  items: { productId: string; title: string; qty: number; price: number }[];
  total: number;
  createdAt?: string;
};

export type Auction = {
  id: string;
  title: string;
  startPrice: number;
  currentBid?: number;
  endsAt?: string;
  photos: string[];
  status: "active" | "ended";
};

export const PRODUCT_CATEGORIES = [
  "Одежда",
  "Электроника",
  "Дом",
  "Антиквариат",
  "Смешанное",
] as const;

export const CATEGORY_ALL = "Все категории";
