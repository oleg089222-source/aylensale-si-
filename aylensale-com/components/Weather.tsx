'use client';

import { useState, useEffect } from 'react';

interface WeatherProps {
  language: string;
}

interface WeatherData {
  location: string;
  temp: number;
  condition: string;
  day: string;
}

export function Weather({ language }: WeatherProps) {
  const [weatherData, setWeatherData] = useState<WeatherData[]>([
    {
      location: language === 'en' ? 'Saturday Market' : 'शनिवार बाजार',
      temp: 22,
      condition: 'Sunny',
      day: 'Saturday',
    },
    {
      location: language === 'en' ? 'Sunday Market' : 'रविवार बाजार',
      temp: 20,
      condition: 'Cloudy',
      day: 'Sunday',
    },
  ]);

  return (
    <div className="bg-yellow-50 border-b border-yellow-200">
      <div className="container mx-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-4">
          {weatherData.map((weather, idx) => (
            <div key={idx} className="bg-white rounded-lg p-4 shadow-sm">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{weather.location}</p>
                  <p className="text-sm text-gray-600">{weather.day}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-blue-600">{weather.temp}°C</p>
                  <p className="text-sm text-gray-600">{weather.condition}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}