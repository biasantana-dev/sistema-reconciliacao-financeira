const db = require('../config/db');

// função pra inserir multiplas vendas de uma vez
const inserirVendas = async (arrayVendas) => {
   if (arrayVendas.length === 0) return;

   // o pacote mysql2 exige que os multiplos valores sejam formatados como um array de arrays
   const valores = arrayVendas.map(venda => [
      venda.id_pedido,
      venda.data,
      venda.valor
   ]);

   // o comando IGNORE previne que a API quebre caso envie o mesmo arquivo CSV duas vezes
   const query = 'INSERT IGNORE INTO vendas_sistema (id_pedido, data_venda, valor_esperado) VALUES ?';

   await db.query(query, [valores]);
};

// funçao pra inserir multiplos registros do extrato de uma vez
const inserirExtrato = async (arrayExtrato) => {
   if (arrayExtrato.length === 0) return;

   const valores = arrayExtrato.map(extrato => [
      extrato.transacao_banco,
      extrato.data,
      extrato.valor
   ]);

   const query = 'INSERT IGNORE INTO extrato_bancario (codigo_transacao_banco, data_compensacao, valor_recebido) VALUES ?';

   await db.query(query, [valores]);
};

module.exports = {inserirVendas, inserirExtrato}