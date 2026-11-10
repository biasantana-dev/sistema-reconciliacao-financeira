document.addEventListener('DOMContentLoaded', () => {
   // selecão dos elementos do DOM
   const form = document.querySelector('#formReconciliacao');
   const inputVendas = document.querySelector('#input-vendas');
   const inputExtrato = document.querySelector('#input-extrato');
   const uploadVendas = document.querySelector('.upload-vendas');
   const uploadExtrato = document.querySelector('.upload-extrato');
   const btnExecutar = document.querySelector('.btn-executar');
   const requisitosValidacao = document.querySelectorAll('.requisitos-validacao li');

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

   // função pra validar a checklist de requisitos
   function validarRequisitos() {
      // verificar se o arquivo de vendas e extrato existem e se termina com .csv
      const vendasValido = estadoArquivos.vendas && estadoArquivos.vendas.name.toLowerCase().endsWith('.csv');

      const extratoValido = estadoArquivos.extrato && estadoArquivos.extrato.name.toLowerCase().endsWith('.csv');

      if (vendasValido && extratoValido) {
         requisitosValidacao[0].classList.add('requisitos-ok');
      } else {
         requisitosValidacao[0].classList.remove('requisitos-ok');
      }
   }
});