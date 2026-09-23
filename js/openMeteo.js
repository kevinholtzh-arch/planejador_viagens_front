// Cliente da API externa Open-Meteo (https://open-meteo.com) — gratuita e sem cadastro.
import { requisicao } from "./httpLogger.js";

const COMPONENTE = "Open-Meteo";
const URL_GEOCODIFICACAO = "https://geocoding-api.open-meteo.com/v1/search";
const URL_PREVISAO = "https://api.open-meteo.com/v1/forecast";

// Busca cidades pelo nome e retorna nome, país e coordenadas.
export async function buscarCidades(nome) {
  const params = new URLSearchParams({ name: nome, count: 5, language: "pt", format: "json" });
  const resposta = await requisicao(COMPONENTE, `${URL_GEOCODIFICACAO}?${params}`);
  if (!resposta.ok) throw new Error("Falha ao buscar cidades na Open-Meteo");
  const dados = await resposta.json();
  return (dados.results || []).map((cidade) => ({
    cidade: cidade.name,
    regiao: cidade.admin1 || "",
    pais: cidade.country || cidade.country_code,
    latitude: cidade.latitude,
    longitude: cidade.longitude,
  }));
}

// Busca a previsão diária (7 dias) para as coordenadas informadas.
export async function buscarPrevisao(latitude, longitude) {
  const params = new URLSearchParams({
    latitude,
    longitude,
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    timezone: "auto",
    forecast_days: 7,
  });
  const resposta = await requisicao(COMPONENTE, `${URL_PREVISAO}?${params}`);
  if (!resposta.ok) throw new Error("Falha ao buscar a previsão na Open-Meteo");
  const { daily } = await resposta.json();
  return daily.time.map((dia, i) => ({
    data: dia,
    codigo: daily.weather_code[i],
    maxima: daily.temperature_2m_max[i],
    minima: daily.temperature_2m_min[i],
    chanceChuva: daily.precipitation_probability_max[i],
  }));
}

// Tradução dos códigos de tempo da OMM (WMO) usados pela Open-Meteo.
const CODIGOS_TEMPO = {
  0: ["☀️", "Céu limpo"],
  1: ["🌤️", "Predominantemente limpo"],
  2: ["⛅", "Parcialmente nublado"],
  3: ["☁️", "Nublado"],
  45: ["🌫️", "Neblina"],
  48: ["🌫️", "Neblina com geada"],
  51: ["🌦️", "Garoa fraca"],
  53: ["🌦️", "Garoa moderada"],
  55: ["🌦️", "Garoa intensa"],
  56: ["🌧️", "Garoa congelante"],
  57: ["🌧️", "Garoa congelante intensa"],
  61: ["🌧️", "Chuva fraca"],
  63: ["🌧️", "Chuva moderada"],
  65: ["🌧️", "Chuva forte"],
  66: ["🌧️", "Chuva congelante"],
  67: ["🌧️", "Chuva congelante forte"],
  71: ["🌨️", "Neve fraca"],
  73: ["🌨️", "Neve moderada"],
  75: ["❄️", "Neve forte"],
  77: ["🌨️", "Grãos de neve"],
  80: ["🌦️", "Pancadas de chuva fracas"],
  81: ["🌧️", "Pancadas de chuva"],
  82: ["⛈️", "Pancadas de chuva fortes"],
  85: ["🌨️", "Pancadas de neve"],
  86: ["❄️", "Pancadas de neve fortes"],
  95: ["⛈️", "Trovoada"],
  96: ["⛈️", "Trovoada com granizo"],
  99: ["⛈️", "Trovoada com granizo forte"],
};

export function descreverTempo(codigo) {
  return CODIGOS_TEMPO[codigo] || ["❔", "Indefinido"];
}
