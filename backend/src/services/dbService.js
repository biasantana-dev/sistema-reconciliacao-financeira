const db = require('../config/db');

// função pra inserir multiplas vendas de uma vez
const inserirVendas = async (arrayVendas) => {
   if (arrayVendas.length === 0) return;

   // o pacote mysql2 exige que os multiplos valores sejam formatados como um array de arrays
   const valores = arrayVendas.map(venda => [
      venda.id_pedido,
      venda.data_venda,
      venda.valor_esperado
   ]);

   // o comando IGNORE previne que a API quebre caso envie o mesmo arquivo CSV duas vezes
   const query = 'INSERT IGNORE INTO vendas_sistema (id_pedido, data_venda, valor_esperado) VALUES ?';

   await db.query(query, [valores]);
};

// funçao pra inserir multiplos registros do extrato de uma vez
const inserirExtrato = async (arrayExtrato) => {
   if (arrayExtrato.length === 0) return;

   const valores = arrayExtrato.map(extrato => [
      extrato.codigo_transacao_banco,
      extrato.data_compensacao,
      extrato.valor_recebido
   ]);

   const query = 'INSERT IGNORE INTO extrato_bancario (codigo_transacao_banco, data_compensacao, valor_recebido) VALUES ?';

   await db.query(query, [valores]);
};

const inserirResultados = async (arrayResultados) => {
   if (arrayResultados.length === 0) return;

   // transforma a lista de objs em uma matriz pra o mySQL
   const valores = arrayResultados.map(resultado => [
      resultado.id_venda,
      resultado.id_extrato,
      resultado.tipo_resultado,
      resultado.valor_diferenca
   ]);

   const query = 'INSERT INTO resultado_reconciliacao (id_venda, id_extrato, tipo_resultado, valor_diferenca) VALUES ?';

   await db.query(query, [valores]);
};

const obterDadosDashboard = async () => {
   // kpis e contagem por status
   const [resumoRows] = await db.query(`
      SELECT 
         COUNT(*) AS total_transacoes, 
         SUM(CASE WHEN r.tipo_resultado = 'MATCH_PERFEITO' THEN 1 ELSE 0 END) AS total_match,
         SUM(CASE WHEN r.tipo_resultado <> 'MATCH_PERFEITO' THEN 1 ELSE 0 END) AS total_divergencias, 
         COALESCE(SUM(CASE WHEN r.tipo_resultado = 'MATCH_PERFEITO' THEN e.valor_recebido ELSE 0 END), 0) AS volume_conciliado,
         COALESCE(SUM(CASE WHEN r.tipo_resultado <> 'MATCH_PERFEITO' THEN ABS(r.valor_diferenca) ELSE 0 END), 0) AS impacto_divergente,
         SUM(CASE WHEN r.tipo_resultado = 'DIFERENCA_DATA' THEN 1 ELSE 0 END) AS qtd_dif_data,
         SUM(CASE WHEN r.tipo_resultado = 'DIFERENCA_VALOR' THEN 1 ELSE 0 END) AS    qtd_dif_valor,
         SUM(CASE WHEN r.tipo_resultado = 'NAO_ENCONTRADO_NO_BANCO' THEN 1 ELSE 0 END) AS qtd_ausente_banco,
         SUM(CASE WHEN r.tipo_resultado = 'NAO_ENCONTRADO_NO_SISTEMA' THEN 1 ELSE 0 END) AS qtd_ausente_sistema
      FROM resultado_reconciliacao r
      LEFT JOIN extrato_bancario e ON r.id_extrato = e.id
   `);

   // evoluçao diaria: vendas vs extrato
   const [evolucaoRows] = await db.query(`
      SELECT 
         DATE_FORMAT(COALESCE(v.data_venda, e.data_compensacao), '%d/%m') AS data_label,
         COALESCE(v.data_venda, e.data_compensacao) AS data_ordem,
         COALESCE(SUM(v.valor_esperado), 0) AS total_vendas,
         COALESCE(SUM(e.valor_recebido), 0) AS total_extrato
      FROM resultado_reconciliacao r
      LEFT JOIN vendas_sistema v ON r.id_venda = v.id
      LEFT JOIN extrato_bancario e ON r.id_extrato = e.id
      WHERE COALESCE(v.data_venda, e.data_compensacao) IS NOT NULL
      GROUP BY data_label, data_ordem
      ORDER BY data_ordem ASC 
      LIMIT 10
   `);

   // 5 maiores divergencias pra ação rapida
   const [divergenciasRows] = await db.query(`
      SELECT 
         r.id,
         v.id_pedido,
         e.codigo_transacao_banco,
         r.tipo_resultado,
         COALESCE(v.valor_esperado, 0) AS valor_esperado,
         COALESCE(e.valor_recebido, 0) AS valor_recebido,
         r.valor_diferenca
      FROM resultado_reconciliacao r
      LEFT JOIN vendas_sistema v ON r.id_venda = v.id
      LEFT JOIN extrato_bancario e ON r.id_extrato = e.id
      WHERE r.tipo_resultado <> 'MATCH_PERFEITO'
      ORDER BY ABS(r.valor_diferenca) DESC
      LIMIT 5
   `);

   const resumo = resumoRows[0];
   const totalTransacoes = Number(resumo.total_transacoes || 0);
   const totalMatch = Number(resumo.total_match || 0);
   const taxaConformidade = totalTransacoes > 0 ? Number(((totalMatch / totalTransacoes) * 100).toFixed(1)) : 0;

   return {
      kpis: {
         volume_conciliado: Number(resumo.volume_conciliado || 0),
         taxa_conformidade: taxaConformidade,
         total_divergencias: Number(resumo.total_divergencias || 0),
         impacto_divergente: Number(resumo.impacto_divergente || 0),
         total_transacoes: totalTransacoes,
         total_match: totalMatch 
      },

      distribuicao: {
         MATCH_PERFEITO: totalMatch,
         DIFERENCA_DATA: Number(resumo.qtd_dif_data || 0),
         DIFERENCA_VALOR: Number(resumo.qtd_dif_valor || 0),
         NAO_ENCONTRADO_NO_BANCO: Number(resumo.qtd_ausente_banco || 0),
         NAO_ENCONTRADO_NO_SISTEMA: Number(resumo.qtd_ausente_sistema || 0)
      },

      evolucao_diaria: evolucaoRows.map(row => ({
         data: row.data_label,
         vendas: Number(row.total_vendas),
         extrato: Number(row.total_extrato)
      })),

      maiores_divergencias: divergenciasRows
   };
};

module.exports = { inserirVendas, inserirExtrato, inserirResultados, obterDadosDashboard };