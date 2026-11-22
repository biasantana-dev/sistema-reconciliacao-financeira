let chartEvolucao = null;
let chartStatus = null;

const formatarMoeda = valor => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const mapaBadges = {
   DIFERENCA_VALOR: { texto: 'Divergência de Valor', classe: 'alerta' },
   DIFERENCA_DATA: { texto: 'Divergência de Data', classe: 'aviso' },
   NAO_ENCONTRADO_NO_BANCO: { texto: 'Ausente no Banco', classe: 'alerta' },
   NAO_ENCONTRADO_NO_SISTEMA: { texto: 'Ausente no Sistema', classe: 'aviso' }
};

// exportar dashboard pra o arquivo app.js
export async function carregarDashboard() {
   try {
      const resposta = await fetch('http://localhost:3000/api/dashboard');
      if (!resposta.ok) throw new Error('Falha ao buscar métricas');

      const dados = await resposta.json();
      atualizarKPIs(dados.kpis);
      renderizarGraficosEvolucao(dados.evolucao_diaria);
      renderizarGraficoStatus(dados.distribuicao);
      renderizarTabelaDivergencias(dados.maiores_divergencias);

   } catch (erro) {
      console.log('Erro no Dashboard:', erro);
   }
}


// ataualizar os kpis de forma dinamica
function atualizarKPIs(kpis) {
   document.querySelector('#dash-kpi-volume').textContent = formatarMoeda(kpis.volume_conciliado);
   document.querySelector('#dash-kpi-volume-sub').textContent = `${kpis.total_match} de ${kpis.total_transacoes} transações validadas`;
   document.querySelector('#dash-kpi-taxa').textContent = `${kpis.taxa_conformidade}%`;
   document.querySelector('#dash-kpi-divergencias').textContent = kpis.total_divergencias;
   document.querySelector('#dash-kpi-impacto').textContent = formatarMoeda(kpis.impacto_divergente);
}

// montar os graficos do dashboard
function renderizarGraficosEvolucao(serie) {
   const ctx = document.querySelector('#grafico-evolucao').getContext('2d');
   if (chartEvolucao) chartEvolucao.destroy();

   chartEvolucao = new Chart(ctx, {
      type: 'bar',
      data: {
         labels: serie.map(item => item.data),
         datasets: [
            {
               label: 'Vendas (Sistema)',
               data: serie.map(item => item.vendas),
               backgroundColor: '#6b75db',
               borderRadius: 6,
               barPercentage: 0.65
            },

            {
               label: 'Extrato (Banco)',
               data: serie.map(item => item.extrato),
               backgroundColor: '#67C38A',
               borderRadius: 6,
               barPercentage: 0.65
            }
         ]
      },
      options: {
         responsive: true,
         maintainAspectRatio: false,
         plugins: { legend: { display: false } },
         scales: {
            x: {
               grid: { display: false },
               ticks: { color: '#94a3b8', font: { size: 11 } }
            },

            y: {
               grid: { color: 'rgba(255, 255, 255, 0.05)' },
               ticks: { color: '#94a3b8', font: { size: 11 } }
            }
         }
      }
   });
}

function renderizarGraficoStatus(dist) {
   const ctx = document.querySelector('#grafico-status').getContext('2d');
   if (chartStatus) chartStatus.destroy();

   chartStatus = new Chart(ctx, {
      type: 'doughnut',
      data: {
         labels: ['Match Perfeito', 'Dif. Data', 'Dif. Valor', 'Ausente Banco', 'Ausente Sistema'],
         datasets: [{
            data: [
               dist.MATCH_PERFEITO,
               dist.DIFERENCA_DATA,
               dist.DIFERENCA_VALOR,
               dist.NAO_ENCONTRADO_NO_BANCO,
               dist.NAO_ENCONTRADO_NO_SISTEMA
            ],
            backgroundColor: ['#67C38A', '#FBBF24', '#F87171', '#6B75DB', '#94A3B8'],
            borderWidth: 0
         }]
      },

      options: {
         responsive: true,
         maintainAspectRatio: false,
         cutout: '68%',
         plugins: {
            legend: {
               position: 'right',
               labels: { color: '#CBD5E1', boxWidth: 10, padding: 12, font: { size: 11 } }
            }
         }
      }
   });
}

// montar tabela de divergencia
function renderizarTabelaDivergencias(lista) {
   const tbody = document.querySelector('#dash-tabela-divergencias');
   tbody.innerHTML = '';

   if (!lista || lista.length === 0) {
      tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; opacity: 0.6; padding: 18px"> Nenhuma divergência registrada até o momento.</td></tr>';
      return;
   }

   lista.forEach(item => {
      const info = mapaBadges[item.tipo_resultado] || { texto: item.tipo_resultado, classe: 'aviso' };
      const tr = document.createElement('tr');
      tr.innerHTML = `
         <td>
            <div class="celula-ids">
               <span class="id-principal">${item.id_pedido || 'Sem pedido'}</span>
               <span class="id-secundario">${item.codigo_transacao_banco || 'Sem transação'}</span>
            </div>
         </td>
         <td><span class="badge-status ${info.classe}"><span class="status-dot"></span>${info.texto}</span></td>
         <td class="col-numero">${formatarMoeda(item.valor_esperado)}</td>
         <td class="col-numero">${formatarMoeda(item.valor_recebido)}</td>
         <td class="col-numero valor-destaque">${formatarMoeda(item.valor_diferenca)}</td>
      `;

      tbody.appendChild(tr)
   });
}