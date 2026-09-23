import { atualizarDestino, criarDestino, listarDestinos, obterResumo, removerDestino } from "./apiDestinos.js";
import { limparLog } from "./httpLogger.js";
import { buscarCidades, buscarPrevisao, descreverTempo } from "./openMeteo.js";

const ROTULOS_STATUS = { planejado: "Planejado", confirmado: "Confirmado", concluido: "Concluído" };
const CORES_STATUS = { planejado: "#f59e0b", confirmado: "#2563eb", concluido: "#16a34a" };

const estado = {
  cidadeSelecionada: null,
  destinoEmEdicao: null,
  pagina: 1,
  porPagina: 5,
  totalPaginas: 0,
};

let graficoStatus = null;
let graficoClima = null;

const $ = (id) => document.getElementById(id);

// ---------- Utilidades ----------
const moeda = (valor) => valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBr = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR");
const diaSemana = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit" });

function avisar(mensagem, tipo = "sucesso") {
  const toast = document.createElement("div");
  toast.className = `toast toast--${tipo}`;
  toast.textContent = mensagem;
  $("toasts").appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ---------- Dashboard (GET /resumo) ----------
async function carregarResumo() {
  try {
    const resumo = await obterResumo();
    $("kpi-total").textContent = resumo.total_destinos;
    $("kpi-orcamento").textContent = moeda(resumo.orcamento_total);
    $("kpi-dias").textContent = resumo.total_dias_viagem;
    if (resumo.proxima_viagem) {
      const p = resumo.proxima_viagem;
      $("kpi-proxima").textContent = `${p.cidade}, ${p.pais}`;
      $("kpi-proxima-detalhe").textContent = `${dataBr(p.data_ida)} a ${dataBr(p.data_volta)}`;
    } else {
      $("kpi-proxima").textContent = "—";
      $("kpi-proxima-detalhe").textContent = "";
    }
    desenharGraficoStatus(resumo.por_status);
  } catch (erro) {
    avisar(erro.message, "erro");
  }
}

function desenharGraficoStatus(porStatus) {
  const chaves = Object.keys(ROTULOS_STATUS);
  const dados = {
    labels: chaves.map((c) => ROTULOS_STATUS[c]),
    datasets: [{ data: chaves.map((c) => porStatus[c] || 0), backgroundColor: chaves.map((c) => CORES_STATUS[c]) }],
  };
  if (graficoStatus) {
    graficoStatus.data = dados;
    graficoStatus.update();
    return;
  }
  graficoStatus = new Chart($("grafico-status"), {
    type: "doughnut",
    data: dados,
    options: {
      maintainAspectRatio: false,
      plugins: { legend: { position: "right" }, title: { display: true, text: "Destinos por status" } },
    },
  });
}

// ---------- Listagem (GET /destinos) ----------
function filtrosAtuais() {
  const [ordenarPor, ordem] = $("filtro-ordenacao").value.split(":");
  return {
    busca: $("filtro-busca").value.trim(),
    status: $("filtro-status").value,
    ordenar_por: ordenarPor,
    ordem,
    pagina: estado.pagina,
    por_pagina: estado.porPagina,
  };
}

async function carregarDestinos() {
  try {
    const resultado = await listarDestinos(filtrosAtuais());
    estado.totalPaginas = resultado.total_paginas;
    if (estado.pagina > 1 && resultado.destinos.length === 0) {
      estado.pagina -= 1;
      return carregarDestinos();
    }
    renderizarLista(resultado.destinos);
    $("pagina-info").textContent = `Página ${resultado.total_paginas ? resultado.pagina : 0} de ${resultado.total_paginas} · ${resultado.total} destino(s)`;
    $("pagina-anterior").disabled = estado.pagina <= 1;
    $("pagina-proxima").disabled = estado.pagina >= estado.totalPaginas;
  } catch (erro) {
    avisar(erro.message, "erro");
  }
}

function renderizarLista(destinos) {
  const lista = $("lista-destinos");
  lista.innerHTML = "";
  if (!destinos.length) {
    lista.innerHTML = `<li class="vazio">Nenhum destino encontrado.</li>`;
    return;
  }
  destinos.forEach((destino) => {
    const item = document.createElement("li");
    item.className = "destino";
    item.innerHTML = `
      <div class="destino__info">
        <strong class="destino__nome"></strong>
        <span class="badge badge--${destino.status}">${ROTULOS_STATUS[destino.status]}</span>
        <small>${dataBr(destino.data_ida)} → ${dataBr(destino.data_volta)} · ${destino.duracao_dias} dia(s) · ${moeda(destino.orcamento)}</small>
        <small class="destino__obs"></small>
      </div>
      <div class="destino__acoes">
        <button class="botao botao--pequeno botao--secundario" data-acao="clima">Clima</button>
        <button class="botao botao--pequeno botao--neutro" data-acao="editar">Editar</button>
        <button class="botao botao--pequeno botao--perigo" data-acao="excluir">Excluir</button>
      </div>`;
    item.querySelector(".destino__nome").textContent = `${destino.cidade}, ${destino.pais}`;
    item.querySelector(".destino__obs").textContent = destino.observacoes || "";
    item.querySelector('[data-acao="clima"]').addEventListener("click", () => mostrarClima(destino));
    item.querySelector('[data-acao="editar"]').addEventListener("click", () => abrirEdicao(destino));
    item.querySelector('[data-acao="excluir"]').addEventListener("click", () => excluir(destino));
    lista.appendChild(item);
  });
}

async function atualizarTela() {
  await Promise.all([carregarResumo(), carregarDestinos()]);
}

// ---------- Cadastro (Open-Meteo + POST /destinos) ----------
async function pesquisarCidade(evento) {
  evento.preventDefault();
  const nome = $("campo-cidade").value.trim();
  if (!nome) return;
  const lista = $("resultados-cidade");
  lista.innerHTML = `<li class="vazio">Buscando...</li>`;
  try {
    const cidades = await buscarCidades(nome);
    lista.innerHTML = "";
    if (!cidades.length) {
      lista.innerHTML = `<li class="vazio">Nenhuma cidade encontrada.</li>`;
      return;
    }
    cidades.forEach((cidade) => {
      const item = document.createElement("li");
      const botao = document.createElement("button");
      botao.type = "button";
      botao.textContent = `📍 ${cidade.cidade}${cidade.regiao ? " - " + cidade.regiao : ""}, ${cidade.pais}`;
      botao.addEventListener("click", () => selecionarCidade(cidade));
      item.appendChild(botao);
      lista.appendChild(item);
    });
  } catch (erro) {
    lista.innerHTML = "";
    avisar(erro.message, "erro");
  }
}

function selecionarCidade(cidade) {
  estado.cidadeSelecionada = cidade;
  $("resultados-cidade").innerHTML = "";
  $("cidade-selecionada").textContent =
    `📍 ${cidade.cidade}, ${cidade.pais} (lat ${cidade.latitude.toFixed(2)}, lon ${cidade.longitude.toFixed(2)})`;
  $("form-destino").hidden = false;
  $("campo-data-ida").focus();
}

function limparCadastro() {
  estado.cidadeSelecionada = null;
  $("form-destino").reset();
  $("form-destino").hidden = true;
  $("campo-cidade").value = "";
  $("resultados-cidade").innerHTML = "";
}

async function salvarDestino(evento) {
  evento.preventDefault();
  const cidade = estado.cidadeSelecionada;
  if (!cidade) return;
  try {
    const criado = await criarDestino({
      cidade: cidade.cidade,
      pais: cidade.pais,
      latitude: cidade.latitude,
      longitude: cidade.longitude,
      data_ida: $("campo-data-ida").value,
      data_volta: $("campo-data-volta").value,
      orcamento: Number($("campo-orcamento").value || 0),
      status: $("campo-status").value,
      observacoes: $("campo-observacoes").value.trim() || null,
    });
    avisar(`Destino ${criado.cidade} cadastrado!`);
    limparCadastro();
    await atualizarTela();
  } catch (erro) {
    avisar(erro.message, "erro");
  }
}

// ---------- Edição (PUT /destinos/{id}) ----------
function abrirEdicao(destino) {
  estado.destinoEmEdicao = destino;
  $("modal-titulo").textContent = `Editar ${destino.cidade}, ${destino.pais}`;
  $("edicao-data-ida").value = destino.data_ida;
  $("edicao-data-volta").value = destino.data_volta;
  $("edicao-orcamento").value = destino.orcamento;
  $("edicao-status").value = destino.status;
  $("edicao-observacoes").value = destino.observacoes || "";
  $("modal-edicao").showModal();
}

async function salvarEdicao(evento) {
  evento.preventDefault();
  const destino = estado.destinoEmEdicao;
  try {
    await atualizarDestino(destino.id, {
      data_ida: $("edicao-data-ida").value,
      data_volta: $("edicao-data-volta").value,
      orcamento: Number($("edicao-orcamento").value || 0),
      status: $("edicao-status").value,
      observacoes: $("edicao-observacoes").value.trim() || null,
    });
    $("modal-edicao").close();
    avisar(`Destino ${destino.cidade} atualizado!`);
    await atualizarTela();
  } catch (erro) {
    avisar(erro.message, "erro");
  }
}

// ---------- Remoção (DELETE /destinos/{id}) ----------
async function excluir(destino) {
  if (!confirm(`Remover o destino ${destino.cidade}, ${destino.pais}?`)) return;
  try {
    await removerDestino(destino.id);
    avisar(`Destino ${destino.cidade} removido.`);
    await atualizarTela();
  } catch (erro) {
    avisar(erro.message, "erro");
  }
}

// ---------- Previsão do tempo (Open-Meteo) ----------
async function mostrarClima(destino) {
  try {
    const dias = await buscarPrevisao(destino.latitude, destino.longitude);
    $("painel-clima").hidden = false;
    $("clima-subtitulo").textContent = `Próximos 7 dias em ${destino.cidade}, ${destino.pais}`;

    const lista = $("clima-dias");
    lista.innerHTML = "";
    dias.forEach((dia) => {
      const [icone, descricao] = descreverTempo(dia.codigo);
      const item = document.createElement("li");
      item.innerHTML = `
        <span class="clima__data">${diaSemana(dia.data)}</span>
        <span class="clima__icone" title="${descricao}">${icone}</span>
        <span class="clima__desc">${descricao}</span>
        <span class="clima__temp"><b>${Math.round(dia.maxima)}°</b> / ${Math.round(dia.minima)}°</span>
        <span class="clima__chuva">💧 ${dia.chanceChuva ?? 0}%</span>`;
      lista.appendChild(item);
    });

    desenharGraficoClima(dias);
    $("painel-clima").scrollIntoView({ behavior: "smooth" });
  } catch (erro) {
    avisar(erro.message, "erro");
  }
}

function desenharGraficoClima(dias) {
  const dados = {
    labels: dias.map((d) => diaSemana(d.data)),
    datasets: [
      { label: "Máxima (°C)", data: dias.map((d) => d.maxima), borderColor: "#dc2626", backgroundColor: "#dc2626", tension: 0.3 },
      { label: "Mínima (°C)", data: dias.map((d) => d.minima), borderColor: "#2563eb", backgroundColor: "#2563eb", tension: 0.3 },
    ],
  };
  if (graficoClima) {
    graficoClima.data = dados;
    graficoClima.update();
    return;
  }
  graficoClima = new Chart($("grafico-clima"), {
    type: "line",
    data: dados,
    options: { maintainAspectRatio: false, plugins: { legend: { position: "bottom" } } },
  });
}

// ---------- Eventos ----------
let temporizadorBusca = null;
function aoMudarFiltro() {
  estado.pagina = 1;
  carregarDestinos();
}

$("form-busca-cidade").addEventListener("submit", pesquisarCidade);
$("form-destino").addEventListener("submit", salvarDestino);
$("botao-cancelar-cadastro").addEventListener("click", limparCadastro);
$("form-edicao").addEventListener("submit", salvarEdicao);
$("botao-fechar-modal").addEventListener("click", () => $("modal-edicao").close());
$("filtro-status").addEventListener("change", aoMudarFiltro);
$("filtro-ordenacao").addEventListener("change", aoMudarFiltro);
$("filtro-busca").addEventListener("input", () => {
  clearTimeout(temporizadorBusca);
  temporizadorBusca = setTimeout(aoMudarFiltro, 400);
});
$("pagina-anterior").addEventListener("click", () => {
  estado.pagina -= 1;
  carregarDestinos();
});
$("pagina-proxima").addEventListener("click", () => {
  estado.pagina += 1;
  carregarDestinos();
});
$("botao-limpar-log").addEventListener("click", limparLog);

atualizarTela();
