import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import { type Idioma } from '@/api/esquemas';
import { guardarIdioma, obtenerIdiomaGuardado } from '@/utils/storage';

import en from './en.json';
import es from './es.json';
import pt from './pt.json';

const idiomaInicial: Idioma = obtenerIdiomaGuardado() ?? 'es';

void i18n.use(initReactI18next).init({
  resources: {
    es: { translation: es },
    en: { translation: en },
    pt: { translation: pt },
  },
  lng: idiomaInicial,
  fallbackLng: 'es',
  interpolation: {
    escapeValue: false,
  },
});

if (typeof document !== 'undefined') {
  document.documentElement.lang = idiomaInicial;
}

export function cambiarIdiomaInterfaz(idioma: Idioma): void {
  guardarIdioma(idioma);
  if (typeof document !== 'undefined') {
    document.documentElement.lang = idioma;
  }
  void i18n.changeLanguage(idioma);
}

export default i18n;
