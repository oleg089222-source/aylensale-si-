import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  Timestamp,
  query,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { Product, CarBootLocation, Order, Auction, ProductStatus } from "./types";

const productsCol = () => collection(getDb(), "products");
const locationsCol = () => collection(getDb(), "carBootLocations");
const ordersCol = () => collection(getDb(), "orders");
const auctionsCol = () => collection(getDb(), "auctions");

function mapProduct(id: string, data: Record<string, unknown>): Product {
  return {
    id,
    title: String(data.title ?? ""),
    description: data.description ? String(data.description) : "",
    category: String(data.category ?? "Смешанное"),
    retailPrice: Number(data.retailPrice ?? data.price ?? 0),
    wholesalePrice: Number(data.wholesalePrice ?? 0),
    stock: Number(data.stock ?? 0),
    badge: (data.badge as Product["badge"]) ?? null,
    status: (data.status as Product["status"]) ?? "active",
    photos: Array.isArray(data.photos) ? (data.photos as string[]) : [],
    createdAt: data.createdAt ? String(data.createdAt) : undefined,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  };
}

function mapLocation(id: string, data: Record<string, unknown>): CarBootLocation {
  return {
    id,
    name: String(data.name ?? data.title ?? ""),
    postcode: String(data.postcode ?? ""),
    photoUrl: data.photoUrl ? String(data.photoUrl) : undefined,
    lat: Number(data.lat ?? 52.49),
    lon: Number(data.lon ?? -0.7),
    saturdayTemp: data.saturdayTemp != null ? Number(data.saturdayTemp) : undefined,
    sundayTemp: data.sundayTemp != null ? Number(data.sundayTemp) : undefined,
    saturdayRainPct: data.saturdayRainPct != null ? Number(data.saturdayRainPct) : undefined,
    sundayRainPct: data.sundayRainPct != null ? Number(data.sundayRainPct) : undefined,
    weatherStatus: (data.weatherStatus as CarBootLocation["weatherStatus"]) ?? "OK",
    goingThisWeekend: Boolean(data.goingThisWeekend),
    goingCount: data.goingCount != null ? Number(data.goingCount) : 0,
    updatedAt: data.updatedAt ? String(data.updatedAt) : undefined,
  };
}

// ——— Products ———

export async function createProduct(
  data: Omit<Product, "id" | "createdAt" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(productsCol(), {
    ...data,
    createdAt: Timestamp.now(),
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateProduct(id: string, data: Partial<Product>): Promise<void> {
  const { id: _id, ...rest } = data;
  await updateDoc(doc(getDb(), "products", id), {
    ...rest,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteProduct(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "products", id));
}

export function listenProducts(
  callback: (products: Product[]) => void,
  options?: { includeHidden?: boolean }
): Unsubscribe {
  const q = options?.includeHidden
    ? productsCol()
    : query(productsCol(), where("status", "in", ["active", "sold_out"]));

  return onSnapshot(q, (snap) => {
    const items = snap.docs.map((d) => mapProduct(d.id, d.data() as Record<string, unknown>));
    callback(items);
  });
}

export function listenAllProducts(callback: (products: Product[]) => void): Unsubscribe {
  return onSnapshot(productsCol(), (snap) => {
    callback(snap.docs.map((d) => mapProduct(d.id, d.data() as Record<string, unknown>)));
  });
}

// ——— Car boot locations ———

export async function createCarBootLocation(
  data: Omit<CarBootLocation, "id" | "updatedAt">
): Promise<string> {
  const ref = await addDoc(locationsCol(), {
    ...data,
    goingCount: data.goingCount ?? 0,
    updatedAt: Timestamp.now(),
  });
  return ref.id;
}

export async function updateCarBootLocation(
  id: string,
  data: Partial<CarBootLocation>
): Promise<void> {
  const { id: _id, ...rest } = data;
  await updateDoc(doc(getDb(), "carBootLocations", id), {
    ...rest,
    updatedAt: Timestamp.now(),
  });
}

export async function deleteCarBootLocation(id: string): Promise<void> {
  await deleteDoc(doc(getDb(), "carBootLocations", id));
}

export function listenCarBootLocations(callback: (locations: CarBootLocation[]) => void): Unsubscribe {
  return onSnapshot(locationsCol(), (snap) => {
    callback(snap.docs.map((d) => mapLocation(d.id, d.data() as Record<string, unknown>)));
  });
}

export async function toggleGoingToLocation(id: string, going: boolean): Promise<void> {
  await updateDoc(doc(getDb(), "carBootLocations", id), {
    goingThisWeekend: going,
    updatedAt: Timestamp.now(),
  });
}

// ——— Orders ———

export async function createOrder(data: Omit<Order, "id" | "createdAt">): Promise<string> {
  const ref = await addDoc(ordersCol(), {
    ...data,
    createdAt: Timestamp.now(),
  });
  return ref.id;
}

export async function getOrders(): Promise<Order[]> {
  const snap = await getDocs(ordersCol());
  return snap.docs.map((d) => ({
    id: d.id,
    ...(d.data() as Omit<Order, "id">),
  }));
}

// ——— Auctions ———

export function listenAuctions(callback: (auctions: Auction[]) => void): Unsubscribe {
  return onSnapshot(auctionsCol(), (snap) => {
    callback(
      snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as Omit<Auction, "id">),
      }))
    );
  });
}
