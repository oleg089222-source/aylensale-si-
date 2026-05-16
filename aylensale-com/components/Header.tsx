interface HeaderProps {
  language: string;
  onLanguageChange: (lang: string) => void;
  onAdminToggle: () => void;
}

export function Header({ language, onLanguageChange, onAdminToggle }: HeaderProps) {
  const languages = [
    { code: 'en', name: 'English' },
    { code: 'hi', name: 'हिंदी' },
    { code: 'pl', name: 'Polski' },
    { code: 'ro', name: 'Română' },
    { code: 'ur', name: 'اردو' },
    { code: 'lv', name: 'Latviešu' },
  ];

  return (
    <header className="bg-gradient-to-r from-blue-600 to-blue-800 text-white">
      <div className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-4">
          <h1 
            onClick={onAdminToggle}
            className="text-4xl font-bold cursor-pointer hover:opacity-80 transition-opacity"
          >
            🏪 AYLENSALE
          </h1>
          <div className="flex gap-2">
            {languages.map((lang) => (
              <button
                key={lang.code}
                onClick={() => onLanguageChange(lang.code)}
                className={`px-3 py-2 rounded transition-colors ${
                  language === lang.code
                    ? 'bg-white text-blue-600 font-semibold'
                    : 'bg-blue-700 hover:bg-blue-600'
                }`}
              >
                {lang.name}
              </button>
            ))}
          </div>
        </div>
        <p className="text-blue-100 text-lg">
          {language === 'en' && 'Live Auctions & Fresh Products'}
          {language === 'hi' && 'लाइव नीलाम और ताजे उत्पाद'}
          {language === 'pl' && 'Aukcje na żywo i świeże produkty'}
          {language === 'ro' && 'Licitații în direct și produse proaspete'}
          {language === 'ur' && 'براہ راست نیلامی اور تازہ مصنوعات'}
          {language === 'lv' && 'Tiešraides izsoles un svaigi produkti'}
        </p>
      </div>
    </header>
  );
}