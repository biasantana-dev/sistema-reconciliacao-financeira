// importando o arquivo de dashboard 
import { carregarDashboard } from "./ui/dashboard.js";

document.addEventListener('DOMContentLoaded', () => {
   // selecão dos elementos do DOM
   const form = document.querySelector('#formReconciliacao');
   const inputVendas = document.querySelector('#input-vendas');
   const inputExtrato = document.querySelector('#input-extrato');
   const uploadVendas = document.querySelector('.upload-vendas');
   const uploadExtrato = document.querySelector('.upload-extrato');
   const btnExecutar = document.querySelector('.btn-executar');
   const requisitosValidacao = document.querySelectorAll('.requisitos-validacao li');
   const passosStepper = document.querySelectorAll('.step');
   const etapaProcessando = document.querySelector('#etapa-processando');
   const etapaResultado = document.querySelector('#etapa-resultados');
   const btnNovaReconciliacao = document.querySelector('#btn-nova-reconciliacao');
   const kpiTotal = document.querySelector('#kpi-total');
   const kpiTaxa = document.querySelector('#kpi-taxa');
   const kpiDivergencias = document.querySelector('#kpi-divergencias');
   const tabelaBody = document.querySelector('#tabela-resultado-body');

   const estadoArquivos = { vendas: null, extrato: null };

   // função auxiliar de formatação de tamanho
   function formatarTamanho(bytes) {
      if (bytes === 0) return '0 Bytes';

      if (bytes < (1024 * 1024)) {
         const KB = bytes / 1024;
         return KB.toFixed(2) + 'KB';
      } else {
         const MB = bytes / (1024 * 1024);
         return MB.toFixed(2) + 'MB';
      }
   }

   // ouvintes de evento nos inputs
   inputVendas.addEventListener('change', e => {
      const arquivo = e.target.files[0];

      if (arquivo) {
         estadoArquivos.vendas = arquivo;

         // chama a função pra atualizar o card na tela
         atualizarStatusCard(uploadVendas, arquivo, 'vendas');
      }
   });

   inputExtrato.addEventListener('change', e => {
      const arquivo = e.target.files[0];

      if (arquivo) {
         estadoArquivos.extrato = arquivo;

         // chama a função pra atualizar o card na tela
         atualizarStatusCard(uploadExtrato, arquivo, 'extrato');
      }
   });

   // função pra atualizar o visual do card
   function atualizarStatusCard(cardElement, arquivo, tipo) {
      const fileStatus = cardElement.querySelector('.file-status');
      const fileName = cardElement.querySelector('.file-name');
      const fileSize = cardElement.querySelector('.file-size');

      if (arquivo) {
         fileName.textContent = arquivo.name; // adicionar nome do arquivo na tela
         if (fileSize) fileSize.textContent = formatarTamanho(arquivo.size); // adicionar tamanho do arquivo na tela
         fileStatus.classList.add('sucesso');

         estadoArquivos[tipo] = arquivo; // adiciona o 'tipo' no obj com o valor do arquivo
      } else {
         fileName.textContent = 'Nenhum arquivo';
         fileSize.textContent = '-';
         fileStatus.classList.remove('sucesso');

         estadoArquivos[tipo] = null; // adicionar o 'tipo' no obj com o valor nulo
      }

      // chamar a validação do checklist sempre que o card mudar
      validarRequisitos();
   }

   // colunas que o sistema espera encontrar na primeira linha do CSV
   const colunasVendasEsperadas = ['id_pedido', 'data_venda', 'valor_esperado'];
   const colunasExtratoEsperadas = ['codigo_transacao_banco', 'data_compensacao', 'valor_recebido'];

   // função pra validar a checklist de requisitos
   async function validarRequisitos() {
      // valida o formato .csv
      const vendasValido = estadoArquivos.vendas && estadoArquivos.vendas.name.toLowerCase().endsWith('.csv');
      const extratoValido = estadoArquivos.extrato && estadoArquivos.extrato.name.toLowerCase().endsWith('.csv');

      if (vendasValido && extratoValido) {
         requisitosValidacao[0].classList.add('requisitos-ok');
      } else {
         requisitosValidacao[0].classList.remove('requisitos-ok');
      }

      // validas colunas obrigatórias
      if (estadoArquivos.vendas && estadoArquivos.extrato) {
         const vendasOk = await verificarColunasCSV(estadoArquivos.vendas, colunasVendasEsperadas);
         const extratoOk = await verificarColunasCSV(estadoArquivos.extrato, colunasExtratoEsperadas);

         if (vendasOk && extratoOk) {
            requisitosValidacao[1].classList.add('requisitos-ok');
         } else {
            requisitosValidacao[1].classList.remove('requisitos-ok');
         }
      } else {
         requisitosValidacao[1].classList.remove('requisitos-ok');
      }

      const tudoPronto = vendasValido && extratoValido && requisitosValidacao[1].classList.contains('requisitos-ok');
      btnExecutar.classList.toggle('pronto', Boolean(tudoPronto));
   }

   // função pra configurar drag e drop 
   function configurarDragAndDrop(cardElement, inputElement, tipo) {
      // previnir o comportamento padrão do navegador ao arrastar sobre a caixa
      ['dragenter', 'dragover'].forEach(eventName => {
         cardElement.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();

            cardElement.classList.add('dragover');
         });
      });

      // previnir o comportamento e remover o destaque visual ao sair ou soltar
      ['dragleave', 'drop'].forEach(eventName => {
         cardElement.addEventListener(eventName, e => {
            e.preventDefault();
            e.stopPropagation();

            cardElement.classList.remove('dragover');
         });
      });

      // capturar o arquivo solto na caixa
      cardElement.addEventListener('drop', e => {
         const arquivo = e.dataTransfer.files[0];

         if (arquivo) {
            inputElement.files = e.dataTransfer.files;
            atualizarStatusCard(cardElement, arquivo, tipo)
         }
      });
   }

   configurarDragAndDrop(uploadVendas, inputVendas, 'vendas');
   configurarDragAndDrop(uploadExtrato, inputExtrato, 'extrato');

   form.addEventListener('submit', async e => {
      e.preventDefault();

      if (!estadoArquivos.vendas || !estadoArquivos.extrato) {
         alert('Por favor, selecione os dois arquivos (.csv) antes de executar.');
         return;
      }

      const formData = new FormData();
      formData.append('vendas', estadoArquivos.vendas);
      formData.append('extrato', estadoArquivos.extrato);

      // aplicar o estado de carregamento no botao
      const textoOriginalBotao = btnExecutar.innerHTML;
      btnExecutar.disabled = true;
      btnExecutar.innerHTML = '<span>Cruzando dados...</span>';

      // avança o stepper pra etapa 2 (cruzamento de dados)
      irParaEtapa(2);

      try {
         // garantir que o usuário veja o spinner por pelo menos 1.5 segundo
         const tempoMinimoLoading = new Promise(resolve => setTimeout(resolve, 2600));

         // enviar os arquivos csv pra serem salvos no mySQL
         const processarNoServidor = async () => {
            const resUpload = await fetch('http://localhost:3000/api/reconciliacao', {
               method: 'POST',
               body: formData
            });
            if (!resUpload.ok) throw new Error(`Erro no upload: ${resUpload.status}`);

            // dispara o motor de cruzamento
            const resMotor = await fetch('http://localhost:3000/api/executar-reconciliacao', {
               method: 'POST'
            });
            if (!resMotor.ok) throw new Error(`Erro no cruzamento: ${resMotor.status}`);

            return resMotor.json();
         }


         // executa o servidor e o cronômetro em paralelo e pega o retorno do servidor
         const [dados] = await Promise.all([processarNoServidor(), tempoMinimoLoading]);

         renderizarResultados(dados);
         irParaEtapa(3);

      } catch (erro) {
         console.error('Erro na requisição', erro);
         alert('Falha ao processar os arquivos no servidor.');

         // em caso de erro, volta pra etapa 1
         irParaEtapa(1);

      } finally {
         btnExecutar.disabled = false;
         btnExecutar.innerHTML = textoOriginalBotao;
      }
   });

   //função pra verificação de colunas obrigatórias
   function verificarColunasCSV(arquivo, colunasEsperadas) {
      return new Promise((resolve) => {
         const leitor = new FileReader();

         leitor.onload = e => {
            const texto = e.target.result;

            // pega a primeira linha e limpa espaços/quebras 
            const primeiraLinha = texto.split('\n')[0].toLowerCase();

            // verifica se TODAS as colunas esperadas estão presente na primeira linha
            const temTodasColunas = colunasEsperadas.every(coluna => primeiraLinha.includes(coluna.toLowerCase()));

            resolve(temTodasColunas);
         }

         // pra ler só o início do arquivo em texto
         leitor.readAsText(arquivo);
      });
   }

   // função pra atualizar as etapas 
   function irParaEtapa(numeroEtapa) {
      passosStepper.forEach((passo, index) => {
         const numeroDoPasso = index + 1; // como o index começa com 0, somar mais um pra ficar: 1, 2 e 3
         const badge = passo.querySelector('.step-badge');

         if (numeroDoPasso < numeroEtapa) {
            passo.classList.add('completed');
            passo.classList.remove('active');
            if (badge) badge.textContent = '✓';

         } else if (numeroDoPasso === numeroEtapa) {
            passo.classList.add('active');
            passo.classList.remove('completed');
            if (badge) badge.textContent = numeroDoPasso;

         } else {
            passo.classList.remove('active', 'completed');
            if (badge) badge.textContent = numeroDoPasso;
         }
      });


      form.classList.add('oculto');
      etapaProcessando.classList.add('oculto');
      etapaResultado.classList.add('oculto');

      if (numeroEtapa === 1) {
         form.classList.remove('oculto');
      } else if (numeroEtapa === 2) {
         etapaProcessando.classList.remove('oculto');
      } else {
         etapaResultado.classList.remove('oculto');
      }
   }

   // função pra formatar as datas 
   function formatarDataBR(data) {
      if (!data) return '-';
      const d = new Date(data);
      if (isNaN(d.getTime()) || d.getUTCFullYear() < 1970) return '-';
      return d.toLocaleDateString('pt-BR', { timeZone: 'UTC' });
   }

   // traduzir o enum pra um texto e classe de cor
   const mapaStatusUI = {
      MATCH_PERFEITO: { texto: 'Match Perfeito', classe: 'match' },
      DIFERENCA_VALOR: { texto: 'Divergência de Valor', classe: 'alerta' },
      DIFERENCA_DATA: { texto: 'Divergência de Data', classe: 'aviso' },
      NAO_ENCONTRADO_NO_BANCO: { texto: 'Ausente no Banco', classe: 'alerta' },
      NAO_ENCONTRADO_NO_SISTEMA: { texto: 'Ausente no Sistema', classe: 'aviso' }
   };

   //função pra renderizar na tela o resultado do cruzamento
   function renderizarResultados(dados) {
      const lista = dados.resultados || [];
      const totalItens = lista.length;
      const acertos = lista.filter(item => item.tipo_resultado === 'MATCH_PERFEITO').length;
      const qtdDivergencias = dados.totalDivergencias ?? (totalItens - acertos);

      const btnTodos = document.querySelector('.filtro-pill[data-filtro="TODOS"]');
      const btnDivergencias = document.querySelector('.filtro-pill[data-filtro="DIVERGENCIAS"]');
      const btnMatch = document.querySelector('.filtro-pill[data-filtro="MATCH"]');

      if (btnTodos) {
         btnTodos.classList.add('active');
         btnTodos.textContent = `Todos (${totalItens})`;
      }

      if (btnDivergencias) {
         btnDivergencias.classList.remove('active');
         btnDivergencias.textContent = `Divergências (${qtdDivergencias})`;
      }

      if (btnMatch) {
         btnMatch.classList.remove('active');
         btnMatch.textContent = `Conciliados (${acertos})`;
      }

      // soma o valor recebido dos itens com MATCH_PERFEITO
      const totalReconciliacao = lista.filter(item => item.tipo_resultado === 'MATCH_PERFEITO').reduce((acc, item) => acc + Number(item.valor_recebido || 0), 0);

      const taxaMatch = totalItens > 0 ? ((acertos / totalItens) * 100).toFixed(1) : '0.0';

      // atualiza kpis
      kpiTotal.textContent = totalReconciliacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      kpiDivergencias.textContent = qtdDivergencias;
      kpiTaxa.textContent = `${taxaMatch}%`;
      kpiTaxa.parentElement.style.setProperty('--taxa', `${taxaMatch}%`);

      // subtitulos e cor das divergencias 
      const subTotal = document.querySelector('#kpi-total-sub');
      const subDiv = document.querySelector('#kpi-div-sub');
      const subTaxa = document.querySelector('#kpi-taxa-sub');
      const iconDiv = document.querySelector('#icon-kpi-divergencias');
      const contadorEl = document.querySelector('#contador-registros');

      if (subTotal) subTotal.textContent = `${acertos} de ${totalItens} transações validadas`;
      if (subTaxa) subTaxa.textContent = taxaMatch === '100.0' ? 'Conciliação integral sem perdas' : 'Baseado no volume cruzado';
      if (contadorEl) contadorEl.textContent = `${totalItens} ${totalItens === 1 ? 'registro' : 'registros'}`;

      if (qtdDivergencias > 0) {
         kpiDivergencias.classList.add('alerta');
         kpiDivergencias.classList.remove('sucesso');
         if (iconDiv) iconDiv.className = 'kpi-icon vermelho';
         if (subDiv) subDiv.textContent = 'Requer revisão manual';
      } else {
         kpiDivergencias.classList.remove('alerta');
         kpiDivergencias.classList.add('sucesso');
         if (iconDiv) iconDiv.className = 'kpi-icon verde';
         if (subDiv) subDiv.textContent = 'Nenhuma inconsistência detectada';
      }

      // reseta o visual dos botões de filtro pra 'Todos' a cada nova reconciliação
      document.querySelectorAll('.filtro-pill').forEach(btn => {
         btn.classList.toggle('active', btn.dataset.filtro === 'TODOS');
      })

      // Renderiza linhas da tabela
      tabelaBody.innerHTML = '';

      lista.forEach(item => {
         const tr = document.createElement('tr');
         tr.dataset.status = item.tipo_resultado;

         const dataVendaFormatada = formatarDataBR(item.data_venda);
         const dataExtratoFormatada = formatarDataBR(item.data_compensacao);
         const valorEsperadoFormatado = Number(item.valor_esperado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
         const valorRecebidoFormatado = Number(item.valor_recebido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

         const statusInfo = mapaStatusUI[item.tipo_resultado] || { texto: item.tipo_resultado, classe: 'aviso' };

         // pra destacar o campo que divergiu entre sistema e banco
         const classeDataExtrato = item.tipo_resultado === 'DIFERENCA_DATA' ? 'celula-aviso' : '';
         const classeValorRecebido = item.tipo_resultado === 'DIFERENCA_VALOR' ? 'celula-alerta' : '';

         // injetar os dados na tabela
         tr.innerHTML = `
              <td>
                  <div class="celula-ids">
                     <span class="id-principal">${item.id_pedido || 'Sem pedido'}</span>
                     <span class="id-secundario">${item.codigo_transacao_banco || 'Sem transação'}</span>
                  </div>
               </td>
               <td class="col-data">${dataVendaFormatada}</td>
               <td class="col-data ${classeDataExtrato}">${dataExtratoFormatada}</td>
               <td class="col-numero">${valorEsperadoFormatado}</td>
               <td class="col-numero valor-destaque ${classeValorRecebido}">${valorRecebidoFormatado}</td>
               <td class="col-status">
                  <span class="badge-status ${statusInfo.classe}">
                     <span class="status-dot"></span>
                     ${statusInfo.texto}
                  </span>
               </td>
            `;

         tabelaBody.appendChild(tr);
      });
   }

   // ouvinte dos botoes de filtro 
   document.querySelectorAll('.filtro-pill').forEach(botao => {
      botao.addEventListener('click', () => {
         document.querySelectorAll('.filtro-pill').forEach(b => b.classList.remove('active'));
         botao.classList.add('active');

         const filtro = botao.dataset.filtro;
         const linhas = tabelaBody.querySelectorAll('tr');
         let visiveis = 0;

         linhas.forEach(tr => {
            const isMatch = tr.dataset.status === 'MATCH_PERFEITO';
            const mostrar =
               filtro === 'TODOS' ||
               (filtro === 'MATCH' && isMatch) ||
               (filtro === 'DIVERGENCIAS' && !isMatch);

            tr.style.display = mostrar ? '' : 'none';
            if (mostrar) visiveis++;
         });

         const contadorEl = document.querySelector('#contador-registros');
         if (contadorEl) {
            contadorEl.textContent = `${visiveis} ${visiveis === 1 ? 'registro' : 'registros'}`;
         }
      });
   });

   // ouvinte de evencto no btnNovaReconciliacao 
   btnNovaReconciliacao.addEventListener('click', () => {
      form.reset();

      atualizarStatusCard(uploadVendas, null, 'vendas');
      atualizarStatusCard(uploadExtrato, null, 'extrato');

      irParaEtapa(1);
   });

   // navegação entre upload e dashboard na sidebar
   document.querySelectorAll('.nav-sidebar a[data-view]').forEach(link => {
      link.addEventListener('click', e => {
         e.preventDefault();
         const viewAlvo = link.dataset.view;

         document.querySelectorAll('.nav-sidebar a').forEach(a => a.classList.remove('active'));
         link.classList.add('active');

         document.querySelectorAll('.view-section').forEach(sec => sec.classList.add('oculto'));
         document.querySelector(`#view-${viewAlvo}`).classList.remove('oculto');

         if (viewAlvo === 'dashboard') carregarDashboard();
      });
   });

   // botao e atualizar o dashboard
   document.querySelector('#btn-atualizar-dashboard')?.addEventListener('click', carregarDashboard);
});