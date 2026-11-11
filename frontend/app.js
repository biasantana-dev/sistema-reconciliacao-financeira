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
         // disparo da fetch api
         const response = await fetch('/api/reconciliacao', {
            method: 'POST',
            body: formData
         });

         if (!response.ok) throw new Error(`Erro na requisição: ${response.status}`);

         // recebe e processa os dados de sucesso
         const dados = await response.json();
         console.log('Resultado do processamento:', dados);

         // avança o stepper pra etapa 3 (resultados e match)
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
   }
});