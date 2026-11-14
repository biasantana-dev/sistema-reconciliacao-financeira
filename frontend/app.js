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
         // enviar os arquivos csv pra serem salvos no mySQL
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

         // recebe e processa os dados de sucesso
         const dados = await resMotor.json();

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

         if (numeroDoPasso < numeroEtapa) {
            // etapa já concluída
            passo.classList.add('completed');
            passo.classList.remove('active');
         } else if (numeroDoPasso === numeroEtapa) {
            // etapa atual 
            passo.classList.add('active');
            passo.classList.remove('completed');
         } else {
            // etapa futura
            passo.classList.remove('active', 'completed');
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

   //função pra renderizar na tela o resultado do cruzamento
   function renderizarResultados(dados) {
      const lista = dados.resultados || [];

      // soma o valor recebido dos itens com MATCH_PERFEITO
      const totalReconciliacao = lista.filter(item => item.tipo_resultado === 'MATCH_PERFEITO').reduce((acc, item) => acc + Number(item.valor_recebido || 0), 0);

      // calcula a taxa de match
      const totalItens = lista.length;
      const acertos = lista.filter(item => item.tipo_resultado === 'MATCH_PERFEITO').length;
      const taxaMatch = totalItens > 0 ? ((acertos / totalItens) * 100).toFixed(1) : '0.0';

      // formatar numeros em texto pra o formato de dinheiro padrao brasileiro
      kpiTotal.textContent = totalReconciliacao.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
      kpiDivergencias.textContent = dados.totalDivergencias;
      kpiTaxa.textContent = `${taxaMatch}%`;

      // limpar os dados da tabela
      tabelaBody.innerHTML = '';

      lista.forEach(item => {
         const tr = document.createElement('tr');

         const dataVendaFormatada = formatarDataBR(item.data_venda);
         const dataExtratoFormatada = formatarDataBR(item.data_compensacao);
         const valorEsperadoFormatado = Number(item.valor_esperado || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
         const valorRecebidoFormatado = Number(item.valor_recebido || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

         // injetar os dados na tabela
         tr.innerHTML = `
               <td>${item.id_pedido || '-'} / ${item.codigo_transacao_banco || '-'}</td>
               <td>${dataVendaFormatada}</td>
               <td>${dataExtratoFormatada}</td>
               <td>${valorEsperadoFormatado}</td>
               <td>${valorRecebidoFormatado}</td>
               <td><span class="badge-status">${item.tipo_resultado}</span></td>
            `;

         tabelaBody.appendChild(tr);
      });
   }


   // ouvinte de evencto no btnNovaReconciliacao 
   btnNovaReconciliacao.addEventListener('click', () => {
      form.reset();

      atualizarStatusCard(uploadVendas, null, 'vendas');
      atualizarStatusCard(uploadExtrato, null, 'extrato');

      irParaEtapa(1);
   });
});