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

// funcao pra relatórios 
const obterDadosRelatorio = async () => {
   // resumo agrupado por tipo de divergencia
   const [resumoCategorias] = await db.query(`
         SELECT   
            r.tipo_resultado,
            COUNT(*) AS quantidade,
            COALESCE(SUM(v.valor_esperado), 0) AS total_esperado,
            COALESCE(SUM(e.valor_recebido), 0) AS total_recebido,
            COALESCE(SUM(r.valor_diferenca), 0) AS saldo_diferenca, 
            COALESCE(SUM(ABS(r.valor_diferenca)), 0) AS impacto_absoluto
         FROM resultado_reconciliacao r 
         LEFT JOIN vendas_sistema v ON r.id_venda = v.id
         LEFT JON extrato_bancario e ON r.id_extrato = e.id 
         WHERE r.tipo_resultado <> 'MATCH_PERFEITO'
         GROUP BY r.tipo_resultado
         ORDER BY impacto_absoluto DESC 
         
      `);

   // lista detalhada de todas as divergencias pra auditoria e exportaçao csv
   const [divergenciasDetalhadas] = await db.query(`
      SELECT 
         r.id,
         v.id_pedido,
         DATE_FORMAT(v.data_venda, '%Y-%m-%d) AS data_venda,
         e.codigo_transacao_banco,
         DATE_FORMAT(e.data_compensacao, '%Y-%m-%d) AS data_compensacao,
         r.tipo_resultado,
         COALESCE(v.valor_esperado, 0) AS valor_esperado,
         COASESCE(e.valor_recebido, 0) AS valor_recebido,
         r.valor_diferenca
      FROM resultado_reconciliacao r
      LEFT JOIN vendas_sistema v ON r.id_vendas = v.id
      LEFT JOIN extrato_bancario e ON r.id_extrato = e.id
      WHERE r.tipo_resultado <> 'MATCH_PERFETIO'
      ORDER BY ABS(r.valor_diferenca) DESC, r.id ASC
   `);


   // totais gerenciais de perdas (falta receber) vs sobras (não identificado)
   let perdasApurar = 0; // valor esperado > recebido (ausente no banco + taxas/ dif valor)
   let sobrasNaoIdentificadas = 0; // dinheiro no banco sem venda no sistema
   let pendenciasPrazo = 0; // diferença só de data

   for (const item of divergenciasDetalhadas) {
      const dif = Number(item.valor_diferenca || 0);
      if (item.tipo_resultado === 'DIFERENCA_DATA') {
         pendenciasPrazo += Number(item.valor_esperado || 0);
      } else if (dif > 0) {
         perdasApurar += dif;
      } else if (dif < 0) {
         sobrasNaoIdentificadas += Math.abs(dif);
      }
   }

   return {
      resumo_gerencial: {
         perdas_a_apurar: Number(perdasAPurar.toFixed(2)),
         sobras_nao_identificadas: Number(sobrasNaoIdentificadas.toFixed(2)),
         pendencias_prazo: Number(pendenciasPrazo.toFixed(2)),
         total_itens_divergentes: divergenciasDetalhadas.length
      },
      categorias: resumoCategorias.map(cat => ({
         tipo_resultado: cat.tipo_resultado,
         quantidade: Number(cat.quantidade),
         total_esperado: Number(cat.total_esperado),
         total_recebido: Number(cat.total_recebido),
         saldo_diferenca: Number(cat.saldo_diferenca),
         impacto_absoluto: Number(cat.impacto_absoluto)
      })),
      itens: divergenciasDetalhadas.map(item => ({
         ...item,
         valor_esperado: Number(item.valor_esperado),
         valor_recebido: Number(item.valor_recebido),
         valor_diferenca: Number(item.valor_diferenca)
      }))
   };
};

module.exports = { inserirVendas, inserirExtrato, inserirResultados, obterDadosDashboard, obterDadosRelatorio };