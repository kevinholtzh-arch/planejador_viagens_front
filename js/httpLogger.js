// Envolve o fetch para registrar, na tela, cada chamada feita aos outros componentes.
const listaLog = document.getElementById("log-chamadas");

function horaAtual() {
  return new Date().toLocaleTimeString("pt-BR");
}

function registrar(componente, metodo, url, status, duracaoMs) {
  const item = document.createElement("li");
  const classeStatus = status >= 200 && status < 400 ? "ok" : "erro";
  item.innerHTML = `
    <span class="log__hora">${horaAtual()}</span>
    <span class="log__componente log__componente--${componente === "Open-Meteo" ? "externo" : "api"}">${componente}</span>
    <span class="log__metodo log__metodo--${metodo.toLowerCase()}">${metodo}</span>
    <span class="log__url"></span>
    <span class="log__status log__status--${classeStatus}">${status || "falha"} · ${duracaoMs} ms</span>`;
  item.querySelector(".log__url").textContent = url;
  listaLog.prepend(item);
}

export async function requisicao(componente, url, opcoes = {}) {
  const metodo = (opcoes.method || "GET").toUpperCase();
  const inicio = performance.now();
  try {
    const resposta = await fetch(url, opcoes);
    registrar(componente, metodo, url, resposta.status, Math.round(performance.now() - inicio));
    return resposta;
  } catch (erro) {
    registrar(componente, metodo, url, 0, Math.round(performance.now() - inicio));
    throw erro;
  }
}

export function limparLog() {
  listaLog.innerHTML = "";
}
