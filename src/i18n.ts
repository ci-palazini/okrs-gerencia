import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import ptTranslation from './locales/pt/common.json';
import esTranslation from './locales/es/common.json';
import enTranslation from './locales/en/common.json';

i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
        resources: {
            pt: {
                translation: ptTranslation,
            },
            es: {
                translation: esTranslation,
            },
            en: {
                translation: enTranslation,
            },
        },
        fallbackLng: 'pt',
        supportedLngs: ['pt', 'es', 'en'],
        load: 'languageOnly', // map region variants (en-US -> en) to base language
        interpolation: {
            escapeValue: false, // not needed for react as it escapes by default
        },
        detection: {
            order: ['queryString', 'cookie', 'localStorage', 'navigator'],
            caches: ['localStorage', 'cookie'],
        },
    });

export default i18n;
