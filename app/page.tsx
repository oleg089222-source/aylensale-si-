"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import "leaflet/dist/leaflet.css";

type WeatherLocation = {
  id: string;
  city: string;
  lat: number;
  lon: number;
};

type WeatherData = {
  temperature: number;
  windspeed: number;
  winddirection: number;
  weathercode: number;
  time: string;
};

type SaleItem = {
  id: number;
  title: string;
  address: string;
  postcode: string;
  day: string;
  time: string;
  note: string;
  google: string;
  category: string;
  orderAmount: number;
  customerPhone: string;
  referralCode: string;
  referrerCode?: string; // Код пригласившего
  lat: number;
  lon: number;
};

type NotificationSettings = {
  telegramToken: string;
  telegramChatId: string;
  whatsappNumber: string;
};

const DEFAULT_SETTINGS: NotificationSettings = {
  telegramToken: "",
  telegramChatId: "",
  whatsappNumber: "",
};

const WEATHER_LOCATIONS: WeatherLocation[] = [
  { id: "corby", city: "Corby", lat: 52.4922, lon: -0.7038 },
  { id: "london", city: "London", lat: 51.5074, lon: -0.1278 },
  { id: "oakham", city: "Oakham", lat: 52.6697, lon: -0.7264 },
];

const PRODUCT_CATEGORIES = [
  "Одежда",
  "Электроника",
  "Дом",
  "Антиквариат",
  "Смешанное",
];

const CATEGORY_ALL = "Все категории";
const DISCOUNT_THRESHOLD = 100;
const DISCOUNT_PERCENT = 10;

const SAMPLE_SALES: SaleItem[] = [
  {
    id: 1680000000000,
    title: "AylenSale Weekend Market",
    address: "Market Place, Corby",
    postcode: "NN17 1QG",
    day: "Суббота",
    time: "10:00 - 14:00",
    note: "Футболки, техника, декор.",
    google: "https://maps.google.com?q=Market+Place+Corby",
    category: "Смешанное",
    orderAmount: 120,
    customerPhone: "",
    referralCode: "AYL-REF-0001",
    referrerCode: "",
    lat: 52.4917,
    lon: -0.7077,
  },
  {
    id: 1680000001000,
    title: "London Car Boot Club",
    address: "Battersea Park, London",
    postcode: "SW11 4NJ",
    day: "Воскресенье",
    time: "09:00 - 13:00",
    note: "Антиквариат, одежда, книги.",
    google: "https://maps.google.com?q=Battersea+Park+London",
    category: "Антиквариат",
    orderAmount: 85,
    customerPhone: "",
    referralCode: "AYL-REF-0002",
    referrerCode: "",
    lat: 51.4799,
    lon: -0.1550,
  },
];

const STORAGE_KEY = "aylensale-sales";
const ADMIN_PASSWORD = "aylen2026";

const weatherCodeLabels: Record<number, string> = {
  0: "Ясно",
  1: "Малооблачно",
  2: "Облачно",
  3: "Пасмурно",
  45: "Туман",
  48: "Морось",
  51: "Легкий дождь",
  61: "Дождь",
  80: "Ливень",
  95: "Гроза",
};

function getWeatherLabel(code: number) {
  return weatherCodeLabels[code] ?? "Погода";
}

const createReferralCode = (phone: string, id: number) => {
  const digits = phone.replace(/\D/g, "");
  const tail = digits.slice(-4) || id.toString().slice(-4);
  const prefix = `AYL${tail}`.toUpperCase();
  return `${prefix}-${id.toString().slice(-4)}`;
};

export default function Home() {
  const [weather, setWeather] = useState<Record<string, WeatherData | null>>({});
  const [sales, setSales] = useState<SaleItem[]>([]);
  const [adminOpen, setAdminOpen] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<string>("");
  const [form, setForm] = useState({
    title: "",
    address: "",
    postcode: "",
    day: "",
    time: "",
    note: "",
    google: "",
    category: PRODUCT_CATEGORIES[0],
    orderAmount: 0,
    customerPhone: "",
    referrerCode: "",
  });
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_SETTINGS);
  const [categoryFilter, setCategoryFilter] = useState(CATEGORY_ALL);
  const [serverMessages, setServerMessages] = useState<string[]>([]);

  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstance = useRef<any>(null);
  const markersLayer = useRef<any>(null);
  const leafletRef = useRef<any>(null);

  const salesCount = useMemo(() => sales.length, [sales]);
  const filteredSales = useMemo(
    () =>
      categoryFilter === CATEGORY_ALL
        ? sales
        : sales.filter((sale) => sale.category === categoryFilter),
    [sales, categoryFilter]
  );
  const visibleCount = filteredSales.length;

  const referralStats = useMemo(() => {
    const stats: Record<string, { count: number; referrals: string[] }> = {};
    sales.forEach((sale) => {
      if (sale.referrerCode) {
        if (!stats[sale.referrerCode]) {
          stats[sale.referrerCode] = { count: 0, referrals: [] };
        }
        stats[sale.referrerCode].count++;
        stats[sale.referrerCode].referrals.push(sale.referralCode);
      }
    });
    return stats;
  }, [sales]);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as SaleItem[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSales(parsed);
          return;
        }
      } catch {
        // ignore
      }
    }
    setSales(SAMPLE_SALES);
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("aylensale-settings");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as NotificationSettings;
        setSettings({
          telegramToken: parsed.telegramToken ?? "",
          telegramChatId: parsed.telegramChatId ?? "",
          whatsappNumber: parsed.whatsappNumber ?? "",
        });
      } catch {
        // ignore
      }
    }
  }, []);

  useEffect(() => {
    WEATHER_LOCATIONS.forEach((location) => {
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lon}&current_weather=true&timezone=Europe%2FLondon`
      )
        .then((res) => res.json())
        .then((data) => {
          if (data?.current_weather) {
            setWeather((prev) => ({
              ...prev,
              [location.id]: {
                temperature: data.current_weather.temperature,
                windspeed: data.current_weather.windspeed,
                winddirection: data.current_weather.winddirection,
                weathercode: data.current_weather.weathercode,
                time: data.current_weather.time,
              },
            }));
          }
        })
        .catch(() => {
          setWeather((prev) => ({ ...prev, [location.id]: null }));
        });
    });
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    import("leaflet").then((L) => {
      leafletRef.current = L;
      if (mapInstance.current) return;

      const DefaultIcon = L.Icon.Default;
      DefaultIcon.mergeOptions({
        iconRetinaUrl:
          "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.5/images/marker-icon-2x.png",
        iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.5/images/marker-icon.png",
        shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.5/images/marker-shadow.png",
      });

      mapInstance.current = L.map(mapRef.current, {
        center: [52.48, -0.5],
        zoom: 7,
        zoomControl: false,
        scrollWheelZoom: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "© OpenStreetMap contributors",
      }).addTo(mapInstance.current);

      markersLayer.current = L.layerGroup().addTo(mapInstance.current);
    });
  }, []);

  useEffect(() => {
    if (!leafletRef.current || !mapInstance.current || !markersLayer.current) return;
    const L = leafletRef.current;
    markersLayer.current.clearLayers();
    if (sales.length === 0) {
      return;
    }
    sales.forEach((sale) => {
      const marker = L.marker([sale.lat, sale.lon]);
      marker.bindPopup(`<strong>${sale.title}</strong><br/>${sale.address}`);
      marker.addTo(markersLayer.current);
    });
    const first = sales[0];
    mapInstance.current.setView([first.lat, first.lon], 8, { animate: true });
  }, [sales]);

  const handleInput = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "orderAmount" ? Number(value) : value,
    }));
  };

  const handleSettingsChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    const nextSettings = { ...settings, [name]: value };
    setSettings(nextSettings);
    localStorage.setItem("aylensale-settings", JSON.stringify(nextSettings));
    addServerMessage(`Настройки бота обновлены: ${name}`);
  };

  const addServerMessage = (message: string) => {
    setServerMessages((prev) => {
      const next = [
        `${new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}: ${message}`,
        ...prev,
      ].slice(0, 12);
      localStorage.setItem("aylensale-server-messages", JSON.stringify(next));
      return next;
    });
  };

  const getWhatsAppLink = (sale: SaleItem) => {
    const phone = settings.whatsappNumber.replace(/\D/g, "");
    if (!phone) return "";
    const discountText = getDiscountMessage(sale.orderAmount);
    const text = `Новая распродажа:%0A${encodeURIComponent(sale.title)}%0A${encodeURIComponent(
      sale.address
    )}%0A${encodeURIComponent(sale.postcode)}%0A${encodeURIComponent(sale.category)}%0A${encodeURIComponent(
      sale.day
    )} ${encodeURIComponent(sale.time)}%0A${encodeURIComponent(sale.note)}%0A${encodeURIComponent(
      sale.google
    )}%0AСумма заказа: £${sale.orderAmount}%0A${sale.customerPhone ? `Телефон: ${encodeURIComponent(sale.customerPhone)}%0A` : ""}%0AКод приглашения: ${encodeURIComponent(sale.referralCode)}%0A${encodeURIComponent(
      `Приглашайте новых пользователей по коду ${sale.referralCode} и получайте скидки.`
    )}%0A${encodeURIComponent(discountText)}`;
    return `https://wa.me/${phone}?text=${text}`;
  };

  const sendTelegramNotification = async (sale: SaleItem) => {
    if (!settings.telegramToken || !settings.telegramChatId) {
      return;
    }

    try {
      const response = await fetch(
        `https://api.telegram.org/bot${settings.telegramToken}/sendMessage`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chat_id: settings.telegramChatId,
            text: `Новая распродажа:\n${sale.title}\n${sale.address}\n${sale.postcode}\n${sale.category}\n${sale.day} ${sale.time}\n${sale.note}\n${sale.google}\nСумма заказа: £${sale.orderAmount}${sale.customerPhone ? `\nТелефон: ${sale.customerPhone}` : ""}\nКод приглашения: ${sale.referralCode}\nПриглашайте новых пользователей по коду и получайте скидки.\n${getDiscountMessage(sale.orderAmount)}`,
          }),
        }
      );
      const result = await response.json();
      if (!result.ok) {
        throw new Error(result.description || "Telegram error");
      }
      setStatus("Заказ отправлен в Telegram.");
    } catch (error) {
      console.error(error);
      setStatus("Ошибка уведомления Telegram: " + String(error));
    }
  };

  const handleSendTestNotification = async () => {
    const dummy: SaleItem = {
      id: Date.now(),
      title: "Тестовая распродажа",
      address: "Test Address",
      postcode: "00000",
      day: "Сейчас",
      time: "00:00",
      note: "Проверка уведомлений",
      google: "https://maps.google.com",
      category: PRODUCT_CATEGORIES[0],
      orderAmount: 0,
      customerPhone: "",
      referralCode: "AYL-TEST-000",
      referrerCode: "",
      lat: 0,
      lon: 0,
    };

    if (settings.telegramToken && settings.telegramChatId) {
      await sendTelegramNotification(dummy);
    }

    if (settings.whatsappNumber) {
      const link = getWhatsAppLink(dummy);
      if (link) {
        window.open(link, "_blank");
        setStatus((prev) => prev + " Тестовая ссылка WhatsApp открыта.");
      }
    }
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.title.trim() || !form.address.trim()) {
      setStatus("Заполните название и адрес.");
      return;
    }

    setStatus("Сохраняем адрес и ищем координаты...");
    const newId = Date.now();
    const customerPhone = form.customerPhone.trim();
    const tempSale: SaleItem = {
      id: newId,
      title: form.title.trim(),
      address: form.address.trim(),
      postcode: form.postcode.trim(),
      day: form.day.trim(),
      time: form.time.trim(),
      note: form.note.trim(),
      google: form.google.trim(),
      category: form.category,
      orderAmount: Number(form.orderAmount) || 0,
      customerPhone,
      referralCode: createReferralCode(customerPhone, newId),
      referrerCode: form.referrerCode.trim(),
      lat: 52.48,
      lon: -0.5,
    };

    if (settings.whatsappNumber) {
      const waLink = getWhatsAppLink(tempSale);
      if (waLink) {
        window.open(waLink, "_blank");
      }
    }

    let lat = 52.48;
    let lon = -0.5;
    try {
      const query = encodeURIComponent(form.address);
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${query}`
      );
      const results = await response.json();
      if (results?.[0]) {
        lat = Number(results[0].lat);
        lon = Number(results[0].lon);
      }
    } catch {
      // ignore geocode failure
    }

    const nextSale: SaleItem = {
      id: newId,
      title: form.title.trim(),
      address: form.address.trim(),
      postcode: form.postcode.trim(),
      day: form.day.trim(),
      time: form.time.trim(),
      note: form.note.trim(),
      google: form.google.trim(),
      category: form.category,
      orderAmount: Number(form.orderAmount) || 0,
      customerPhone,
      referralCode: createReferralCode(customerPhone, newId),
      referrerCode: form.referrerCode.trim(),
      lat,
      lon,
    };

    const next = [nextSale, ...sales];
    setSales(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    setForm({
      title: "",
      address: "",
      postcode: "",
      day: "",
      time: "",
      note: "",
      google: "",
      category: PRODUCT_CATEGORIES[0],
      orderAmount: 0,
      customerPhone: "",
      referrerCode: "",
    });
    setStatus("Адрес сохранён в localStorage.");

    if (settings.telegramToken && settings.telegramChatId) {
      await sendTelegramNotification(nextSale);
    }

    if (settings.whatsappNumber) {
      const link = getWhatsAppLink(nextSale);
      if (link) {
        window.open(link, "_blank");
      }
    }
  };

  const handleLogin = () => {
    if (password.trim() === ADMIN_PASSWORD) {
      setLoggedIn(true);
      setStatus("Админ доступ открыт.");
      return;
    }
    setLoggedIn(false);
    setStatus("Неверный пароль: aylen2026");
  };

  const handleClearStorage = () => {
    localStorage.removeItem(STORAGE_KEY);
    setSales(SAMPLE_SALES);
    setStatus("Список сброшен. Загружены стартовые адреса.");
    addServerMessage("Список распродаж сброшен до начального состояния.");
  };

  const handleResetBotInfo = () => {
    const nextSettings = DEFAULT_SETTINGS;
    setSettings(nextSettings);
    localStorage.setItem("aylensale-settings", JSON.stringify(nextSettings));
    addServerMessage("Информация бота сброшена.");
    setStatus("Информация бота сброшена.");
  };

  useEffect(() => {
    const stored = localStorage.getItem("aylensale-server-messages");
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as string[];
        setServerMessages(parsed);
      } catch {
        // ignore
      }
    }
  }, []);

  return (
    <div className="page-shell mx-auto max-w-7xl text-slate-100">
      <div className="mb-8 rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 shadow-2xl shadow-slate-950/40 backdrop-blur-xl">
        <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl space-y-6">
            <p className="inline-flex rounded-full bg-sky-500/15 px-4 py-1 text-sm font-semibold text-sky-200">
              AYLENSALE Car Boot Planner
            </p>
            <h1 className="text-4xl font-semibold tracking-tight text-white sm:text-5xl">
              Погода, карта и список car boot продаж в одном месте
            </h1>
            <p className="max-w-xl text-slate-300 sm:text-lg">
              Лёгкий сайт для планирования распродаж: прогноз Open-Meteo, карта Leaflet и админ-форма на localStorage.
              Быстрая рабочая версия для GitHub Pages.
            </p>
            <div className="rounded-[2rem] border border-sky-500/10 bg-sky-500/5 p-6 text-slate-100 shadow-lg shadow-sky-500/5">
              <p className="text-sm uppercase tracking-[0.28em] text-sky-200/80">Акция</p>
              <h2 className="mt-3 text-2xl font-semibold text-white">
                Закажи от £{DISCOUNT_THRESHOLD} и получи {DISCOUNT_PERCENT}% скидки
              </h2>
              <p className="mt-2 text-slate-300">
                Добавьте сумму заказа и номер клиента в админ-панели — система автоматически покажет подходящие распродажи и поможет отправить уведомление.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="glass rounded-3xl p-5">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Текущие продажи</p>
                <p className="mt-3 text-3xl font-semibold">{salesCount}</p>
                <p className="mt-2 text-slate-400">сохранено в браузере</p>
              </div>
              <div className="glass rounded-3xl p-5">
                <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Admin</p>
                <p className="mt-3 text-3xl font-semibold">Локальная панель</p>
                <p className="mt-2 text-slate-400">Пароль: aylen2026</p>
              </div>
            </div>
          </div>
          <div className="grid gap-4 sm:max-w-md">
            <div className="glass rounded-[2rem] border border-white/10 p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.28em] text-sky-300/80">Сейчас</p>
                  <p className="mt-2 text-3xl font-semibold text-white">Смотреть прогноз</p>
                </div>
                <div className="rounded-3xl bg-sky-500/10 px-4 py-3 text-sky-200">Open-Meteo</div>
              </div>
              <div className="mt-6 grid gap-4">
                {WEATHER_LOCATIONS.map((location) => {
                  const item = weather[location.id];
                  return (
                    <div key={location.id} className="rounded-3xl border border-white/10 bg-slate-900/70 p-4">
                      <p className="text-sm text-slate-400">{location.city}</p>
                      {item ? (
                        <div className="mt-3 flex items-center justify-between gap-4">
                          <div>
                            <p className="text-3xl font-semibold text-white">{Math.round(item.temperature)}°C</p>
                            <p className="mt-1 text-sm text-slate-400">{getWeatherLabel(item.weathercode)}</p>
                          </div>
                          <div className="text-right text-sm text-slate-400">
                            <p>Ветер {Math.round(item.windspeed)} км/ч</p>
                            <p>{item.time.split("T")[1] ?? item.time}</p>
                          </div>
                        </div>
                      ) : (
                        <p className="mt-3 text-slate-400">Загрузка...</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="glass rounded-[2rem] border border-white/10 p-6">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Карта</p>
              <p className="mt-2 text-lg font-semibold text-white">Маленькая карта</p>
              <div className="mt-4 h-72 overflow-hidden rounded-[1.5rem] border border-white/10">
                <div ref={mapRef} className="h-full w-full leaflet-container" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="space-y-6">
          <div className="glass rounded-[2rem] border border-white/10 p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-sky-300/80">Список распродаж</p>
                <h2 className="text-3xl font-semibold text-white">Готовые адреса и заметки</h2>
                <p className="mt-2 text-sm text-slate-400">
                  Показано {visibleCount} из {salesCount}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <select
                  value={categoryFilter}
                  onChange={(event) => setCategoryFilter(event.target.value)}
                  className="input rounded-3xl bg-slate-900 px-4 py-3 text-slate-100 outline-none"
                >
                  <option value={CATEGORY_ALL}>{CATEGORY_ALL}</option>
                  {PRODUCT_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <button
                type="button"
                className="inline-flex rounded-full bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
                onClick={() => setAdminOpen((prev) => !prev)}
              >
                {adminOpen ? "Скрыть admin" : "Admin"}
              </button>
            </div>
            <div className="mt-8 grid gap-4">
              {filteredSales.map((sale) => (
                <div key={sale.id} className="card rounded-[1.75rem] p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-xl font-semibold text-white">{sale.title}</p>
                        <span className="rounded-full bg-sky-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-sky-200">
                          {sale.category}
                        </span>
                        {isDiscountEligible(sale.orderAmount) ? (
                          <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-emerald-200">
                            Скидка {DISCOUNT_PERCENT}%
                          </span>
                        ) : null}
                      </div>
                      <p className="text-slate-400">{sale.address}</p>
                      <p className="text-slate-400">{sale.postcode}</p>
                      <p className="text-slate-400">Сумма заказа: £{sale.orderAmount}</p>
                      <p className="text-slate-400">Реферальный код: {sale.referralCode}</p>
                      {sale.customerPhone ? (
                        <p className="text-slate-400">Телефон клиента: {sale.customerPhone}</p>
                      ) : null}
                    </div>
                    <div className="text-right text-slate-400">
                      <p>{sale.day}</p>
                      <p>{sale.time}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-slate-400">{sale.note}</p>
                    {sale.google ? (
                      <a
                        className="text-sky-300 transition hover:text-sky-200"
                        href={sale.google}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Открыть в Google Maps
                      </a>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className={`glass rounded-[2rem] border border-white/10 p-8 ${adminOpen ? "block" : "hidden"}`}>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Админ-панель</p>
            {!loggedIn ? (
              <div className="mt-6 space-y-4">
                <p className="text-base text-slate-200">Введите пароль для редактирования списка.</p>
                <input
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Пароль"
                  className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none transition focus:border-sky-400"
                />
                <button
                  type="button"
                  className="inline-flex w-full justify-center rounded-3xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
                  onClick={handleLogin}
                >
                  Войти
                </button>
              </div>
            ) : (
              <form onSubmit={handleSave} className="mt-6 space-y-4">
                <div className="grid gap-4">
                  <input
                    name="title"
                    value={form.title}
                    onChange={handleInput}
                    placeholder="Название распродажи"
                    className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                  />
                  <input
                    name="address"
                    value={form.address}
                    onChange={handleInput}
                    placeholder="Адрес"
                    className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <input
                      name="postcode"
                      value={form.postcode}
                      onChange={handleInput}
                      placeholder="Postcode"
                      className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                    />
                    <input
                      name="day"
                      value={form.day}
                      onChange={handleInput}
                      placeholder="День"
                      className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                    />
                  </div>
                  <input
                    name="time"
                    value={form.time}
                    onChange={handleInput}
                    placeholder="Время"
                    className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                  />
                  <textarea
                    name="note"
                    value={form.note}
                    onChange={handleInput}
                    placeholder="Заметка"
                    rows={3}
                    className="textarea w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                  />
                  <select
                    name="category"
                    value={form.category}
                    onChange={handleInput}
                    className="input w-full rounded-3xl bg-slate-900 px-4 py-3 text-slate-100 outline-none"
                  >
                    {PRODUCT_CATEGORIES.map((category) => (
                      <option key={category} value={category} className="bg-slate-950 text-white">
                        {category}
                      </option>
                    ))}
                  </select>
                  <input
                    name="orderAmount"
                    type="number"
                    value={form.orderAmount}
                    onChange={handleInput}
                    placeholder="Сумма заказа £"
                    className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                    min="0"
                  />
                  <input
                    name="customerPhone"
                    value={form.customerPhone}
                    onChange={handleInput}
                    placeholder="Телефон клиента"
                    className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                  />
                  <input
                    name="referrerCode"
                    value={form.referrerCode}
                    onChange={handleInput}
                    placeholder="Реферальный код пригласившего (опционально)"
                    className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                  />
                  <p className="text-xs text-slate-500">
                    Код генерируется автоматически по номеру и будет виден на карточке для приглашения новых клиентов.
                  </p>
                  <input
                    name="google"
                    value={form.google}
                    onChange={handleInput}
                    placeholder="Google Maps link"
                    className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                  />
                  <input
                    name="telegramToken"
                    value={settings.telegramToken}
                    onChange={handleSettingsChange}
                    placeholder="Telegram bot token"
                    className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                  />
                  <input
                    name="telegramChatId"
                    value={settings.telegramChatId}
                    onChange={handleSettingsChange}
                    placeholder="Telegram chat id"
                    className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                  />
                  <input
                    name="whatsappNumber"
                    value={settings.whatsappNumber}
                    onChange={handleSettingsChange}
                    placeholder="WhatsApp номер (только цифры)"
                    className="input w-full rounded-3xl px-4 py-3 text-slate-100 outline-none"
                  />
                  <p className="text-sm text-slate-400">Если заполнено, при сохранении откроется WhatsApp со сообщением.</p>
                  <button
                    type="button"
                    className="inline-flex w-full justify-center rounded-3xl border border-slate-700 bg-slate-800/80 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700"
                    onClick={handleSendTestNotification}
                  >
                    Отправить тестовое уведомление
                  </button>
                </div>
                <button
                  type="submit"
                  className="inline-flex w-full justify-center rounded-3xl bg-sky-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-400"
                >
                  Сохранить
                </button>
                <button
                  type="button"
                  className="inline-flex w-full justify-center rounded-3xl bg-slate-700 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-600"
                  onClick={handleClearStorage}
                >
                  Очистить localStorage
                </button>
                <button
                  type="button"
                  className="inline-flex w-full justify-center rounded-3xl bg-orange-500 px-5 py-3 text-sm font-semibold text-white transition hover:bg-orange-400"
                  onClick={handleResetBotInfo}
                >
                  Сбросить настройки бота
                </button>
              </form>
            )}
            {status ? <p className="mt-4 text-sm text-slate-300">{status}</p> : null}
            <div className="mt-6 rounded-[1.75rem] border border-slate-700/80 bg-slate-950/80 p-4">
              <p className="text-sm uppercase tracking-[0.28em] text-slate-400">Сообщения от сервера</p>
              {serverMessages.length > 0 ? (
                <ul className="mt-4 space-y-3 text-slate-300">
                  {serverMessages.map((message, index) => (
                    <li key={index} className="rounded-3xl border border-slate-700/70 bg-slate-900/80 px-4 py-3 text-sm">
                      {message}
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-4 text-sm text-slate-500">Здесь будут появляться системные сообщения.</p>
              )}
            </div>
            </div>
          </div>

        </aside>
      </div>
    </div>
  );
}
