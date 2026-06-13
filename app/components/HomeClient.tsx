"use client";

import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import "leaflet/dist/leaflet.css";
import { MapView } from "./MapView";
import type { Product, CarBootLocation, Auction, ProductBadge, ProductStatus, WeatherStatus } from "../lib/types";
import { PRODUCT_CATEGORIES, CATEGORY_ALL } from "../lib/types";
import { isFirebaseConfigured } from "../lib/firebase";
import {
  listenProducts,
  listenAllProducts,
  listenCarBootLocations,
  listenAuctions,
  createProduct,
  updateProduct,
  deleteProduct,
  createCarBootLocation,
  updateCarBootLocation,
  deleteCarBootLocation,
  toggleGoingToLocation,
  createAuction,
  updateAuction,
  deleteAuction,
} from "../lib/firestore";
import { uploadProductPhotos, uploadLocationPhoto } from "../lib/storage";
import { fetchWeekendForecast, geocodePostcode } from "../lib/weather";
import { sendTelegramNotification } from "../lib/telegram";

const DISCOUNT_THRESHOLD = 100;
const DISCOUNT_PERCENT = 10;

type ProductFormState = {
  title: string;
  description: string;
  category: string;
  retailPrice: number;
  wholesalePrice: number;
  stock: number;
  badge: string;
  status: ProductStatus;
};

type AuctionFormState = {
  title: string;
  startPrice: number;
  currentBid: number;
  endsAt: string;
  status: Auction["status"];
  photos: string[];
};

const emptyProductForm: ProductFormState = {
  title: "",
  description: "",
  category: PRODUCT_CATEGORIES[0],
  retailPrice: 0,
  wholesalePrice: 0,
  stock: 0,
  badge: "",
  status: "active",
};

const emptyLocationForm = {
  name: "",
  postcode: "",
};

const emptyAuctionForm: AuctionFormState = {
  title: "",
  startPrice: 0,
  currentBid: 0,
  endsAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().slice(0, 16),
  status: "active",
  photos: [],
};

function badgeClass(badge: ProductBadge) {
  if (badge === "NEW") return "bg-sky-500/15 text-sky-200";
  if (badge === "SALE") return "bg-emerald-500/15 text-emerald-200";
  if (badge === "HOT") return "bg-orange-500/15 text-orange-200";
  return "";
}

function weatherStatusClass(status: WeatherStatus) {
  if (status === "GOOD") return "text-emerald-300";
  if (status === "BAD") return "text-rose-300";
  return "text-amber-300";
}

function toRadians(degrees: number) {
  return (degrees * Math.PI) / 180;
}

function getDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return 6371 * c;
}

function formatDistanceKm(distanceKm: number) {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} м`;
  }
  return `${distanceKm.toFixed(1)} км`;
}

export function HomeClient() {
  const [products, setProducts] = useState<Product[]>([]);
  const [locations, setLocations] = useState<CarBootLocation[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedAuction, setSelectedAuction] = useState<Auction | null>(null);
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [userLocation, setUserLocation] = useState<{ lat: number; lon: number } | null>(null);
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_ALL);
  const [adminOpen, setAdminOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [adminTab, setAdminTab] = useState<"products" | "locations" | "auctions" | "settings">("products");
  const [status, setStatus] = useState("");
  const [firebaseReady, setFirebaseReady] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState("");

  const [productForm, setProductForm] = useState(emptyProductForm);
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productPhotoFiles, setProductPhotoFiles] = useState<File[]>([]);
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);

  const [auctionForm, setAuctionForm] = useState<AuctionFormState>(emptyAuctionForm);
  const [editingAuctionId, setEditingAuctionId] = useState<string | null>(null);

  const [locationForm, setLocationForm] = useState(emptyLocationForm);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);
  const [locationPhotoFile, setLocationPhotoFile] = useState<File | null>(null);
  const [auctionBid, setAuctionBid] = useState<number>(0);

  const visibleProducts = useMemo(
    () =>
      products.filter((p) => {
        if (p.status === "hidden" && !loggedIn) return false;
        if (categoryFilter === CATEGORY_ALL) return p.status !== "hidden";
        return p.category === categoryFilter && p.status !== "hidden";
      }),
    [products, categoryFilter, loggedIn]
  );

  const visibleAuctions = useMemo(
    () =>
      auctions.filter((auction) => {
        if (!loggedIn) return auction.status === "active";
        return true;
      }),
    [auctions, loggedIn]
  );

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      queueMicrotask(() => setStatus("Firebase не настроен. Заполните .env.local"));
      return;
    }

    queueMicrotask(() => setFirebaseReady(true));

    const unsubProducts = loggedIn
      ? listenAllProducts((items) => {
          setProducts(items);
        })
      : listenProducts((items) => {
          setProducts(items);
        });

    const unsubLocations = listenCarBootLocations((items) => {
      setLocations(items);
    });

    const unsubAuctions = listenAuctions((items) => {
      setAuctions(items);
    });

    return () => {
      unsubProducts();
      unsubLocations();
      unsubAuctions();
    };
  }, [loggedIn]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "a") {
        event.preventDefault();
        setAdminOpen((v) => !v);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({
          lat: position.coords.latitude,
          lon: position.coords.longitude,
        });
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 1000 * 60 * 5 }
    );
  }, []);

  const handleAdminLogin = async () => {
    const res = await fetch("/api/admin/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setLoggedIn(true);
      setAdminOpen(true);
      setStatus("Админ доступ открыт.");
      return;
    }
    setStatus("Неверный пароль.");
  };

  const handleAdminLogout = () => {
    setLoggedIn(false);
    setPassword("");
    setAdminOpen(false);
  };

  const resetProductForm = () => {
    setProductForm(emptyProductForm);
    setEditingProductId(null);
    setProductPhotoFiles([]);
    setExistingPhotos([]);
  };

  const handleProductSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loggedIn) return;
    if (!productForm.title.trim()) {
      setStatus("Укажите название товара.");
      return;
    }

    setStatus("Сохраняем товар...");
    try {
      const payload = {
        title: productForm.title.trim(),
        description: productForm.description.trim(),
        category: productForm.category,
        retailPrice: Number(productForm.retailPrice),
        wholesalePrice: Number(productForm.wholesalePrice),
        stock: Number(productForm.stock),
        badge: (productForm.badge || null) as ProductBadge,
        status: productForm.status,
        photos: [...existingPhotos],
      };

      let id = editingProductId;
      if (!id) {
        id = await createProduct(payload);
      } else {
        await updateProduct(id, payload);
      }

      if (productPhotoFiles.length > 0 && id) {
        const urls = await uploadProductPhotos(id, productPhotoFiles);
        await updateProduct(id, { photos: [...payload.photos, ...urls] });
      }

      await sendTelegramNotification({
        title: editingProductId ? `Обновлён товар: ${payload.title}` : `Новый товар: ${payload.title}`,
        text: `📦 ${payload.title}\nРозница: £${payload.retailPrice}\nОпт: £${payload.wholesalePrice}\nСклад: ${payload.stock}`,
      });

      resetProductForm();
      setStatus(editingProductId ? "Товар обновлён." : "Товар добавлен.");
    } catch (err) {
      setStatus("Ошибка: " + String(err));
    }
  };

  const resetAuctionForm = () => {
    setAuctionForm(emptyAuctionForm);
    setEditingAuctionId(null);
  };

  const handleAuctionSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loggedIn) return;
    if (!auctionForm.title.trim()) {
      setStatus("Укажите название аукциона.");
      return;
    }

    setStatus("Сохраняем аукцион...");
    try {
      const payload = {
        title: auctionForm.title.trim(),
        startPrice: Number(auctionForm.startPrice),
        currentBid: Number(auctionForm.currentBid ?? auctionForm.startPrice) || Number(auctionForm.startPrice),
        endsAt: auctionForm.endsAt,
        status: auctionForm.status,
        photos: auctionForm.photos.filter(Boolean),
      };

      if (editingAuctionId) {
        await updateAuction(editingAuctionId, payload);
      } else {
        await createAuction(payload);
      }

      resetAuctionForm();
      setStatus(editingAuctionId ? "Аукцион обновлён." : "Аукцион создан.");
    } catch (err) {
      setStatus("Ошибка: " + String(err));
    }
  };

  const startEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setProductForm({
      title: p.title,
      description: p.description ?? "",
      category: p.category,
      retailPrice: p.retailPrice,
      wholesalePrice: p.wholesalePrice,
      stock: p.stock,
      badge: p.badge ? String(p.badge) : "",
      status: p.status,
    });
    setExistingPhotos(p.photos);
    setProductPhotoFiles([]);
    setAdminOpen(true);
    setAdminTab("products");
  };

  const startEditAuction = (auction: Auction) => {
    setEditingAuctionId(auction.id);
    setAuctionForm({
      title: auction.title,
      startPrice: auction.startPrice,
      currentBid: auction.currentBid ?? auction.startPrice,
      endsAt: auction.endsAt ?? new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString().slice(0, 16),
      status: auction.status,
      photos: auction.photos,
    });
    setAdminOpen(true);
    setAdminTab("auctions");
  };

  const openAuctionDetails = (auction: Auction) => {
    setSelectedAuction(auction);
    setAuctionBid((auction.currentBid ?? auction.startPrice) + 1);
  };

  const handlePlaceBid = async (auction: Auction) => {
    const nextBid = Number(auctionBid);
    const current = auction.currentBid ?? auction.startPrice;
    if (!nextBid || nextBid <= current) {
      setStatus(`Введите ставку больше текущей (£${current})`);
      return;
    }
    if (auction.status !== "active") {
      setStatus("Аукцион завершён.");
      return;
    }

    setStatus("Отправка ставки...");
    try {
      await updateAuction(auction.id, { currentBid: nextBid });
      setStatus(`Ставка принята: £${nextBid}`);
      setAuctionBid(nextBid + 1);
      setSelectedAuction({ ...auction, currentBid: nextBid });
    } catch (err) {
      setStatus("Ошибка ставки: " + String(err));
    }
  };

  const handleDeleteAuction = async (id: string) => {
    if (!loggedIn || !confirm("Удалить аукцион?")) return;
    await deleteAuction(id);
    setStatus("Аукцион удалён.");
  };

  const handleDeleteProduct = async (id: string) => {
    if (!loggedIn || !confirm("Удалить товар?")) return;
    await deleteProduct(id);
    setStatus("Товар удалён.");
  };

  const handleLocationSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!loggedIn) return;
    if (!locationForm.name.trim() || !locationForm.postcode.trim()) {
      setStatus("Укажите название и postcode.");
      return;
    }

    setStatus("Сохраняем локацию и прогноз...");
    try {
      const geo = await geocodePostcode(locationForm.postcode);
      const lat = geo?.lat ?? 52.49;
      const lon = geo?.lon ?? -0.7;
      const forecast = await fetchWeekendForecast(lat, lon);

      let id = editingLocationId;
      let photoUrl: string | undefined;

      if (!id) {
        id = await createCarBootLocation({
          name: locationForm.name.trim(),
          postcode: locationForm.postcode.trim(),
          lat,
          lon,
          ...forecast,
          goingThisWeekend: false,
          goingCount: 0,
        });
      }

      if (locationPhotoFile && id) {
        photoUrl = await uploadLocationPhoto(id, locationPhotoFile);
      }

      const updatePayload: Partial<CarBootLocation> = {
        name: locationForm.name.trim(),
        postcode: locationForm.postcode.trim(),
        lat,
        lon,
        ...forecast,
      };
      if (photoUrl) updatePayload.photoUrl = photoUrl;

      if (editingLocationId) {
        await updateCarBootLocation(editingLocationId, updatePayload);
      } else if (id && photoUrl) {
        await updateCarBootLocation(id, { photoUrl });
      }

      setLocationForm(emptyLocationForm);
      setEditingLocationId(null);
      setLocationPhotoFile(null);
      setStatus("Локация сохранена.");
    } catch (err) {
      setStatus("Ошибка локации: " + String(err));
    }
  };

  const handleGoing = async (loc: CarBootLocation) => {
    const next = !loc.goingThisWeekend;
    setSelectedLocationId(loc.id);
    await toggleGoingToLocation(loc.id, next);
  };

  const handleDeleteLocation = async (id: string) => {
    if (!loggedIn || !confirm("Удалить локацию?")) return;
    await deleteCarBootLocation(id);
    setStatus("Локация удалена.");
  };

  const handleTestTelegram = async () => {
    const result = await sendTelegramNotification({
      text: "✅ Тест AYLENSALE — уведомление с сервера",
    });
    setStatus(result.success ? "Тест отправлен в Telegram." : result.error ?? "Ошибка");
  };

  const onProductPhotos = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    setProductPhotoFiles((prev) => [...prev, ...Array.from(files)].slice(0, 10));
    e.target.value = "";
  };

  return (
    <div className="page-shell mx-auto max-w-7xl text-slate-100">
      <div className="mb-8 rounded-4xl border border-white/10 bg-slate-950/60 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-6">
            <p className="inline-flex rounded-full bg-sky-500/15 px-4 py-1 text-sm font-semibold text-sky-200">
              AYLENSALE
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Погода, карта, товары и car boot в одном месте
            </h1>
            <p className="max-w-xl text-slate-300 sm:text-lg">
              Данные в Firebase Firestore, фото в Cloud Storage. Синхронизация между устройствами.
            </p>
            <div className="rounded-4xl border border-sky-500/10 bg-sky-500/5 p-6 text-slate-100 shadow-lg shadow-sky-500/5">
              <p className="text-sm uppercase tracking-[0.28em] text-sky-200/80">Акция</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Закажи от £{DISCOUNT_THRESHOLD} и получи {DISCOUNT_PERCENT}% скидки
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass rounded-3xl p-5">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Товары</p>
                <p className="mt-3 text-3xl font-semibold">{visibleProducts.length}</p>
                <p className="mt-2 text-slate-400">{firebaseReady ? "Firestore" : "ожидание Firebase"}</p>
              </div>
              <div className="glass rounded-3xl p-5">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Car boot</p>
                <p className="mt-3 text-3xl font-semibold">{locations.length}</p>
                <p className="mt-2 text-slate-400">локаций</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:max-w-md">
            <MapView locations={locations} selectedId={selectedLocationId} />
          </div>
        </div>
      </div>

      {/* Car Boot */}
      <section className="mb-8 glass rounded-4xl border border-white/10 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-sky-300/80">Car Boot</p>
        <h2 className="text-3xl font-semibold text-white">Погода на выходные</h2>
        <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {locations.length === 0 ? (
            <p className="text-slate-400 col-span-full">Локации появятся после добавления в админке.</p>
          ) : (
            locations.map((loc) => {
              const distanceText = userLocation
                ? `${formatDistanceKm(getDistanceKm(userLocation.lat, userLocation.lon, loc.lat, loc.lon))} от меня`
                : null;

              return (
                <div
                  key={loc.id}
                  className={`card rounded-[1.75rem] p-6 transition ${
                    loc.goingThisWeekend || selectedLocationId === loc.id
                      ? "ring-2 ring-emerald-400/80 bg-emerald-950/30"
                      : ""
                  }`}
                >
                  {loc.photoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={loc.photoUrl}
                      alt={loc.name}
                      loading="lazy"
                      decoding="async"
                      width={640}
                      height={192}
                      className="mb-4 h-32 w-full rounded-2xl object-cover"
                    />
                  ) : null}
                  <h3 className="text-xl font-semibold text-white">{loc.name}</h3>
                  <p className="text-slate-400">{loc.postcode}</p>
                  {distanceText ? <p className="text-slate-400">{distanceText}</p> : null}
                  <div className="mt-4 grid grid-cols-2 gap-2 text-sm">
                    <div>
                      <p className="text-slate-500">Суббота</p>
                      <p className="text-white">{loc.saturdayTemp ?? "—"}°C · дождь {loc.saturdayRainPct ?? "—"}%</p>
                    </div>
                    <div>
                      <p className="text-slate-500">Воскресенье</p>
                      <p className="text-white">{loc.sundayTemp ?? "—"}°C · дождь {loc.sundayRainPct ?? "—"}%</p>
                    </div>
                  </div>
                  <p className={`mt-2 text-sm font-semibold ${weatherStatusClass(loc.weatherStatus)}`}>
                    Статус: {loc.weatherStatus}
                  </p>
                  <button
                    type="button"
                    onClick={() => handleGoing(loc)}
                    className={`mt-4 w-full rounded-3xl px-4 py-3 text-sm font-semibold transition ${
                      loc.goingThisWeekend
                        ? "bg-emerald-500 text-white hover:bg-emerald-400"
                        : "bg-slate-700 text-white hover:bg-slate-600"
                    }`}
                  >
                    {loc.goingThisWeekend ? "✓ Еду на эти выходные" : "I'm going here this weekend"}
                  </button>
                  {loggedIn ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="text-sm text-orange-300"
                        onClick={() => {
                          setEditingLocationId(loc.id);
                          setLocationForm({ name: loc.name, postcode: loc.postcode });
                          setAdminOpen(true);
                          setAdminTab("locations");
                        }}
                      >
                        Изменить
                      </button>
                      <button type="button" className="text-sm text-rose-300" onClick={() => handleDeleteLocation(loc.id)}>
                        Удалить
                      </button>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Products catalog */}
      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6 min-w-0">
          <div className="glass rounded-4xl border border-white/10 p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-sky-300/80">Каталог</p>
                <h2 className="text-3xl font-semibold text-white">Товары AYLENSALE</h2>
                <p className="mt-2 text-sm text-slate-400">Показано {visibleProducts.length}</p>
              </div>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="input rounded-3xl bg-slate-900 px-4 py-3 text-slate-100 outline-none"
              >
                <option value={CATEGORY_ALL}>{CATEGORY_ALL}</option>
                {PRODUCT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="inline-flex rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
                onClick={() => setAdminOpen((v) => !v)}
              >
                {adminOpen ? "Скрыть admin" : "Admin"}
              </button>
            </div>
            <div className="mt-8 grid gap-4">
              {visibleProducts.length === 0 ? (
                <p className="text-slate-400">Товаров пока нет. Добавьте в админ-панели.</p>
              ) : (
                visibleProducts.map((p) => (
                  <div
                    key={p.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedProduct(p)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setSelectedProduct(p);
                      }
                    }}
                    className="card rounded-[1.75rem] p-6 transition hover:-translate-y-1 hover:ring-2 hover:ring-sky-500/30 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xl font-semibold text-white">{p.title}</p>
                      {p.badge ? (
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(p.badge)}`}>
                          {p.badge}
                        </span>
                      ) : null}
                      {p.status === "sold_out" ? (
                        <span className="rounded-full bg-slate-500/20 px-3 py-1 text-xs text-slate-300">SOLD OUT</span>
                      ) : null}
                    </div>
                    <p className="mt-2 text-slate-400">{p.category}</p>
                    <p className="text-slate-300">
                      Розница £{p.retailPrice} · Опт £{p.wholesalePrice} · Склад {p.stock}
                    </p>
                    {p.photos.length > 0 ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {p.photos.slice(0, 4).map((url, i) => (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={i}
                            src={url}
                            alt={`${p.title} фото ${i + 1}`}
                            loading="lazy"
                            decoding="async"
                            width={80}
                            height={80}
                            className="h-20 w-20 rounded-lg object-cover"
                          />
                        ))}
                      </div>
                    ) : null}
                    {loggedIn ? (
                      <div className="mt-4 flex gap-2">
                        <button
                          type="button"
                          className="text-orange-300 text-sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            startEditProduct(p);
                          }}
                        >
                          Изменить
                        </button>
                        <button
                          type="button"
                          className="text-rose-300 text-sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            handleDeleteProduct(p.id);
                          }}
                        >
                          Удалить
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))
              )}
            </div>
          </div>
        </section>

        <section className="mb-8 glass rounded-4xl border border-white/10 p-8">
          <p className="text-sm uppercase tracking-[0.28em] text-sky-300/80">VIP / Аукционы</p>
          <h2 className="text-3xl font-semibold text-white">Лоты и VIP ставки</h2>
          <p className="mt-2 text-sm text-slate-400">Публичные лоты видны всем, админ может управлять аукционами.</p>
          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {visibleAuctions.length === 0 ? (
              <p className="text-slate-400 col-span-full">Аукционов пока нет.</p>
            ) : (
              visibleAuctions.map((auction) => (
                <div
                  key={auction.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => openAuctionDetails(auction)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openAuctionDetails(auction);
                    }
                  }}
                  className="card rounded-[1.75rem] p-6 transition hover:-translate-y-1 hover:ring-2 hover:ring-sky-500/30 focus:outline-none focus:ring-2 focus:ring-sky-500/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold text-white">{auction.title}</p>
                      <p className="mt-1 text-sm text-slate-400">Статус: {auction.status}</p>
                    </div>
                    <div className="rounded-full bg-slate-800 px-3 py-1 text-xs uppercase tracking-[0.24em] text-slate-300">
                      VIP
                    </div>
                  </div>
                  <p className="mt-4 text-slate-300">Ставка: £{auction.currentBid ?? auction.startPrice}</p>
                  <p className="mt-2 text-sm text-slate-400">Окончание: {auction.endsAt ? new Date(auction.endsAt).toLocaleString() : "—"}</p>
                  {auction.photos.length > 0 ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={auction.photos[0]}
                      alt={auction.title}
                      loading="lazy"
                      decoding="async"
                      width={640}
                      height={360}
                      className="mt-4 h-40 w-full rounded-3xl object-cover"
                    />
                  ) : null}
                </div>
              ))
            )}
          </div>
        </section>

        {/* Admin sidebar */}
        <aside className={`space-y-6 min-w-0 ${adminOpen ? "" : "hidden"}`}>
          <div className="glass rounded-4xl border border-white/10 p-8">
            <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Admin</p>
            {!loggedIn ? (
              <div className="mt-6 space-y-4">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Пароль"
                  className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                />
                <button
                  type="button"
                  className="w-full rounded-3xl bg-sky-500 py-3 font-semibold text-white"
                  onClick={handleAdminLogin}
                >
                  Войти
                </button>
              </div>
            ) : (
              <>
                <div className="mt-4 flex gap-2 border-b border-slate-700">
                  {(["products", "locations", "auctions", "settings"] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      className={`px-3 py-2 text-sm ${adminTab === tab ? "border-b-2 border-sky-500 text-sky-300" : "text-slate-400"}`}
                      onClick={() => setAdminTab(tab)}
                    >
                      {tab === "products"
                        ? "Товары"
                        : tab === "locations"
                        ? "Car Boot"
                        : tab === "auctions"
                        ? "VIP / Аукцион"
                        : "Настройки"}
                    </button>
                  ))}
                </div>
                <button type="button" className="mt-2 text-xs text-slate-500" onClick={handleAdminLogout}>
                  Выйти
                </button>

                {adminTab === "products" && (
                  <form onSubmit={handleProductSubmit} className="mt-6 space-y-3">
                    <input
                      className="input w-full rounded-3xl px-4 py-3"
                      placeholder="Название"
                      value={productForm.title}
                      onChange={(e) => setProductForm((f) => ({ ...f, title: e.target.value }))}
                    />
                    <textarea
                      className="textarea w-full rounded-3xl px-4 py-3"
                      placeholder="Описание"
                      rows={2}
                      value={productForm.description}
                      onChange={(e) => setProductForm((f) => ({ ...f, description: e.target.value }))}
                    />
                    <select
                      className="input w-full rounded-3xl px-4 py-3"
                      value={productForm.category}
                      onChange={(e) => setProductForm((f) => ({ ...f, category: e.target.value }))}
                    >
                      {PRODUCT_CATEGORIES.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        className="input rounded-3xl px-4 py-3"
                        placeholder="Розница £"
                        value={productForm.retailPrice}
                        onChange={(e) => setProductForm((f) => ({ ...f, retailPrice: Number(e.target.value) }))}
                      />
                      <input
                        type="number"
                        className="input rounded-3xl px-4 py-3"
                        placeholder="Опт £"
                        value={productForm.wholesalePrice}
                        onChange={(e) => setProductForm((f) => ({ ...f, wholesalePrice: Number(e.target.value) }))}
                      />
                    </div>
                    <input
                      type="number"
                      className="input w-full rounded-3xl px-4 py-3"
                      placeholder="Склад"
                      value={productForm.stock}
                      onChange={(e) => setProductForm((f) => ({ ...f, stock: Number(e.target.value) }))}
                    />
                    <select
                      className="input w-full rounded-3xl px-4 py-3"
                      value={productForm.badge}
                      onChange={(e) =>
                        setProductForm((f) => ({
                          ...f,
                          badge: e.target.value,
                        }))
                      }
                    >
                      <option value="">Без badge</option>
                      <option value="NEW">NEW</option>
                      <option value="SALE">SALE</option>
                      <option value="HOT">HOT</option>
                    </select>
                    <select
                      className="input w-full rounded-3xl px-4 py-3"
                      value={productForm.status}
                      onChange={(e) => setProductForm((f) => ({ ...f, status: e.target.value as ProductStatus }))}
                    >
                      <option value="active">active</option>
                      <option value="hidden">hidden</option>
                      <option value="sold_out">sold out</option>
                    </select>
                    <input type="file" accept="image/*" multiple onChange={onProductPhotos} />
                    <p className="text-xs text-slate-500">До 10 фото → Firebase Storage</p>
                    <button type="submit" className="w-full rounded-3xl bg-sky-500 py-3 font-semibold text-white">
                      {editingProductId ? "Обновить" : "Добавить"}
                    </button>
                    {editingProductId ? (
                      <button type="button" className="w-full text-slate-400" onClick={resetProductForm}>
                        Отменить
                      </button>
                    ) : null}
                  </form>
                )}

                {adminTab === "locations" && (
                  <form onSubmit={handleLocationSubmit} className="mt-6 space-y-3">
                    <input
                      className="input w-full rounded-3xl px-4 py-3"
                      placeholder="Название локации"
                      value={locationForm.name}
                      onChange={(e) => setLocationForm((f) => ({ ...f, name: e.target.value }))}
                    />
                    <input
                      className="input w-full rounded-3xl px-4 py-3"
                      placeholder="Postcode"
                      value={locationForm.postcode}
                      onChange={(e) => setLocationForm((f) => ({ ...f, postcode: e.target.value }))}
                    />
                    <input type="file" accept="image/*" onChange={(e) => setLocationPhotoFile(e.target.files?.[0] ?? null)} />
                    <button type="submit" className="w-full rounded-3xl bg-sky-500 py-3 font-semibold text-white">
                      {editingLocationId ? "Обновить локацию" : "Добавить локацию"}
                    </button>
                  </form>
                )}

                {adminTab === "auctions" && (
                  <form onSubmit={handleAuctionSubmit} className="mt-6 space-y-3">
                    <input
                      className="input w-full rounded-3xl px-4 py-3"
                      placeholder="Название аукциона"
                      value={auctionForm.title}
                      onChange={(e) => setAuctionForm((f) => ({ ...f, title: e.target.value }))}
                    />
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="number"
                        className="input rounded-3xl px-4 py-3"
                        placeholder="Стартовая цена £"
                        value={auctionForm.startPrice}
                        onChange={(e) => setAuctionForm((f) => ({ ...f, startPrice: Number(e.target.value) }))}
                      />
                      <input
                        type="number"
                        className="input rounded-3xl px-4 py-3"
                        placeholder="Текущая ставка £"
                        value={auctionForm.currentBid}
                        onChange={(e) => setAuctionForm((f) => ({ ...f, currentBid: Number(e.target.value) }))}
                      />
                    </div>
                    <input
                      type="datetime-local"
                      className="input w-full rounded-3xl px-4 py-3"
                      value={auctionForm.endsAt}
                      onChange={(e) => setAuctionForm((f) => ({ ...f, endsAt: e.target.value }))}
                    />
                    <select
                      className="input w-full rounded-3xl px-4 py-3"
                      value={auctionForm.status}
                      onChange={(e) => setAuctionForm((f) => ({ ...f, status: e.target.value as Auction["status"] }))}
                    >
                      <option value="active">active</option>
                      <option value="ended">ended</option>
                    </select>
                    <textarea
                      className="textarea w-full rounded-3xl px-4 py-3"
                      rows={3}
                      placeholder="Фото URL через запятую"
                      value={auctionForm.photos.join(", ")}
                      onChange={(e) => setAuctionForm((f) => ({
                        ...f,
                        photos: e.target.value
                          .split(",")
                          .map((item) => item.trim())
                          .filter(Boolean),
                      }))}
                    />
                    <button type="submit" className="w-full rounded-3xl bg-sky-500 py-3 font-semibold text-white">
                      {editingAuctionId ? "Обновить аукцион" : "Добавить аукцион"}
                    </button>
                    {editingAuctionId ? (
                      <button type="button" className="w-full text-slate-400" onClick={resetAuctionForm}>
                        Отменить
                      </button>
                    ) : null}
                    <div className="space-y-3 pt-4">
                      <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Текущие лоты</p>
                      {auctions.length === 0 ? (
                        <p className="text-slate-400">Сейчас нет активных аукционов.</p>
                      ) : (
                        auctions.map((auction) => (
                          <div key={auction.id} className="rounded-3xl border border-slate-700 bg-slate-950/70 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-semibold text-white">{auction.title}</p>
                                <p className="text-sm text-slate-400">£{auction.currentBid ?? auction.startPrice}</p>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  className="text-sky-300 text-sm"
                                  onClick={() => startEditAuction(auction)}
                                >
                                  Изменить
                                </button>
                                <button
                                  type="button"
                                  className="text-rose-300 text-sm"
                                  onClick={() => handleDeleteAuction(auction.id)}
                                >
                                  Удалить
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </form>
                )}

                {adminTab === "settings" && (
                  <div className="mt-6 space-y-3">
                    <input
                      className="input w-full rounded-3xl px-4 py-3"
                      placeholder="WhatsApp (4477...)"
                      value={whatsappNumber}
                      onChange={(e) => {
                        setWhatsappNumber(e.target.value);
                      }}
                    />
                    <button
                      type="button"
                      className="w-full rounded-3xl border border-slate-600 py-3"
                      onClick={handleTestTelegram}
                    >
                      Тест Telegram (сервер)
                    </button>
                    <p className="text-xs text-slate-500">TELEGRAM_BOT_TOKEN и TELEGRAM_CHAT_ID только на Vercel.</p>
                  </div>
                )}
              </>
            )}
            {status ? <p className="mt-4 text-sm text-slate-300">{status}</p> : null}
          </div>
        </aside>
      </div>
      {selectedProduct ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="product-detail-title"
          onClick={() => setSelectedProduct(null)}
        >
          <div
            className="w-full max-w-4xl rounded-4xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="product-detail-title" className="text-3xl font-semibold text-white">
                  {selectedProduct.title}
                </h2>
                <p className="mt-2 text-slate-400">{selectedProduct.category}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
                onClick={() => setSelectedProduct(null)}
              >
                Закрыть
              </button>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.65fr_0.35fr]">
              <div className="space-y-4">
                <p className="text-slate-300">{selectedProduct.description || "Описание отсутствует."}</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-3xl bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Розница</p>
                    <p className="mt-2 text-xl font-semibold text-white">£{selectedProduct.retailPrice}</p>
                  </div>
                  <div className="rounded-3xl bg-slate-950/80 p-4">
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Опт</p>
                    <p className="mt-2 text-xl font-semibold text-white">£{selectedProduct.wholesalePrice}</p>
                  </div>
                </div>
                <p className="text-sm text-slate-400">Склад: {selectedProduct.stock}</p>
                {selectedProduct.badge ? (
                  <p className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${badgeClass(selectedProduct.badge)}`}>
                    {selectedProduct.badge}
                  </p>
                ) : null}
              </div>
              <div className="space-y-4">
                {selectedProduct.photos.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedProduct.photos.slice(0, 4).map((url, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={index}
                        src={url}
                        alt={`${selectedProduct.title} фото ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        width={320}
                        height={240}
                        className="h-40 w-full rounded-3xl object-cover"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl bg-slate-950/80 p-6 text-sm text-slate-400">Фото отсутствуют</div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
      {selectedAuction ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="auction-detail-title"
          onClick={() => {
            setSelectedAuction(null);
            setAuctionBid(0);
          }}
        >
          <div
            className="w-full max-w-4xl rounded-4xl border border-slate-700 bg-slate-900 p-6 shadow-2xl shadow-black/60"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 id="auction-detail-title" className="text-3xl font-semibold text-white">
                  {selectedAuction.title}
                </h2>
                <p className="mt-2 text-slate-400">Статус: {selectedAuction.status}</p>
              </div>
              <button
                type="button"
                className="rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-200 transition hover:border-slate-500"
                  onClick={() => {
                    setSelectedAuction(null);
                    setAuctionBid(0);
                  }}
              >
                Закрыть
              </button>
            </div>
            <div className="mt-6 grid gap-6 lg:grid-cols-[0.65fr_0.35fr]">
              <div className="space-y-4">
                <p className="text-slate-300">Ставка: £{selectedAuction.currentBid ?? selectedAuction.startPrice}</p>
                <p className="text-sm text-slate-400">Окончание: {selectedAuction.endsAt ? new Date(selectedAuction.endsAt).toLocaleString() : "—"}</p>
                <p className="text-sm uppercase tracking-[0.24em] text-slate-500">Фотографии</p>
                {selectedAuction.photos.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {selectedAuction.photos.map((url, index) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={index}
                        src={url}
                        alt={`${selectedAuction.title} фото ${index + 1}`}
                        loading="lazy"
                        decoding="async"
                        width={320}
                        height={240}
                        className="h-40 w-full rounded-3xl object-cover"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="rounded-3xl bg-slate-950/80 p-6 text-sm text-slate-400">Фото отсутствуют</div>
                )}
              </div>
              <div className="space-y-4">
                <div className="rounded-3xl bg-slate-950/80 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">VIP</p>
                  <p className="mt-2 text-xl font-semibold text-white">Доступно всем покупателям</p>
                </div>
                <div className="rounded-3xl bg-slate-950/80 p-4">
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Состояние</p>
                  <p className="mt-2 text-xl font-semibold text-white">{selectedAuction.status === "active" ? "Активен" : "Завершён"}</p>
                </div>
                {selectedAuction.status === "active" ? (
                  <div className="rounded-3xl bg-slate-950/80 p-4">
                    <label className="text-xs uppercase tracking-[0.24em] text-slate-500" htmlFor="auction-bid">
                      Ваша ставка
                    </label>
                    <div className="mt-3 flex items-center gap-2">
                      <input
                        id="auction-bid"
                        type="number"
                        min={(selectedAuction.currentBid ?? selectedAuction.startPrice) + 1}
                        value={auctionBid}
                        onChange={(e) => setAuctionBid(Number(e.target.value))}
                        className="input w-full rounded-3xl bg-slate-900 px-4 py-3 text-slate-100 outline-none"
                      />
                      <button
                        type="button"
                        className="rounded-3xl bg-sky-500 px-4 py-3 text-sm font-semibold text-white"
                        onClick={() => handlePlaceBid(selectedAuction)}
                      >
                        Поставить
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}