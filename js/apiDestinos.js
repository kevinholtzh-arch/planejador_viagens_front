// Cliente da API de destinos (componente desenvolvido: planejador_viagens_api).
import { requisicao } from "./httpLogger.js";

const COMPONENTE = "API Viagens";

async function tratarResposta(resposta) {
  const dados = await resposta.json().catch(() => ({}));
  if (!resposta.ok) {
    const mensagem = Array.isArray(dados)
      ? dados.map((e) => e.msg.replace("Value error, ", "")).join("; ")
      : dados.mensagem || "Erro ao comunicar com a API";
    throw new Error(mensagem);
  }
  return dados;
}

export async function listarDestinos(filtros) {
  const params = new URLSearchParams();
  Object.entries(filtros).forEach(([chave, valor]) => {
    if (valor !== "" && valor !== null && valor !== undefined) params.append(chave, valor);
  });
  const resposta = await requisicao(COMPONENTE, `${window.API_URL}/destinos?${params}`);
  return tratarResposta(resposta);
}

export async function obterResumo() {
  const resposta = await requisicao(COMPONENTE, `${window.API_URL}/resumo`);
  return tratarResposta(resposta);
}

export async function criarDestino(destino) {
  const resposta = await requisicao(COMPONENTE, `${window.API_URL}/destinos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(destino),
  });
  return tratarResposta(resposta);
}

export async function atualizarDestino(id, alteracoes) {
  const resposta = await requisicao(COMPONENTE, `${window.API_URL}/destinos/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(alteracoes),
  });
  return tratarResposta(resposta);
}

export async function removerDestino(id) {
  const resposta = await requisicao(COMPONENTE, `${window.API_URL}/destinos/${id}`, { method: "DELETE" });
  return tratarResposta(resposta);
}
