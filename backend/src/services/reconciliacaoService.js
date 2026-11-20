// importando a conexão com o banco de dados
const db = require('../config/db');

// função pra converter as datas em texto
const formatarDataISO = data => {
   if (!data) return null;

   const d = new Date(data);
   if (isNaN(d.getTime()) || d.getUTCFullYear() < 1970) return null;

   return d.toISOString().split('T')[0];
}

// cria a funçao principal do motor
const executarReconciliacao = async () => {
   try {
      const [vendas] = await db.query(
         "SELECT * FROM vendas_sistema WHERE status_reconciliacao IS NULL OR status_reconciliacao = 'PENDENTE'"
      );
      const [extratos] = await db.query(
         "SELECT * FROM extrato_bancario WHERE status_reconciliacao IS NULL OR status_reconciliacao = 'PENDENTE'"
      );

      const resultados = [];
      const extratosUsados = new Set(); // pra evitar que 1 lançamento bancario pague 2 vendas

      for (const venda of vendas) {
         const dataVendaISO = formatarDataISO(venda.data_venda);
         const valorEsperado = Number(venda.valor_esperado || 0);

         // primeira prioridade: match perfeito
         let extratoEncontrado = extratos.find(item => {
            if (extratosUsados.has(item.id)) return false;
            const dataBancoISO = formatarDataISO(item.data_compensacao);
            const valorRecebido = Number(item.valor_recebido || 0);

            return dataVendaISO !== null && dataVendaISO === dataBancoISO && valorEsperado === valorRecebido;
         });


         // segunda prioridade: mesmo valor e data diferente
         if (!extratoEncontrado) {
            extratoEncontrado = extratos.find(item => {
               if (extratosUsados.has(item.id)) return false;
               const valorRecebido = Number(item.valor_recebido || 0);

               return valorEsperado > 0 && valorEsperado === valorRecebido;
            });
         }

         // terceira prioridade: mesma data e valor diferente
         if (!extratoEncontrado) {
            extratoEncontrado = extratos.find(item => {
               if (extratosUsados.has(item.id)) return false;
               const dataBancoISO = formatarDataISO(item.data_compensacao);

               return dataVendaISO !== null && dataVendaISO === dataBancoISO;
            });
         }

         if (extratoEncontrado) {
            extratosUsados.add(extratoEncontrado.id);

            const dataBancoISO = formatarDataISO(extratoEncontrado.data_compensacao);
            const valorRecebido = Number(extratoEncontrado.valor_recebido || 0);

            const mesmaData = dataVendaISO !== null && dataVendaISO === dataBancoISO;
            const mesmoValor = valorEsperado === valorRecebido;

            let tipoResultado = 'MATCH_PERFEITO';
            let valorDiferenca = 0.00;

            if (mesmaData && !mesmoValor) {
               tipoResultado = 'DIFERENCA_VALOR';
               valorDiferenca = Number((valorEsperado - valorRecebido).toFixed(2));

            } else if (!mesmaData && mesmoValor) {
               tipoResultado = 'DIFERENCA_DATA';
               valorDiferenca = 0.00;
            }

            resultados.push({
               id_venda: venda.id,
               id_extrato: extratoEncontrado.id,
               tipo_resultado: tipoResultado,
               valor_diferenca: valorDiferenca,
               id_pedido: venda.id_pedido,
               codigo_transacao_banco: extratoEncontrado.codigo_transacao_banco,
               data_venda: venda.data_venda,
               data_compensacao: extratoEncontrado.data_compensacao,
               valor_esperado: valorEsperado,
               valor_recebido: valorRecebido
            });

         } else {
            // não achou nem valor e nem a data - undefined
            resultados.push({
               id_venda: venda.id,
               id_extrato: null,
               tipo_resultado: 'NAO_ENCONTRADO_NO_BANCO',
               valor_diferenca: valorEsperado,
               id_pedido: venda.id_pedido,
               codigo_transacao_banco: null,
               data_venda: venda.data_venda,
               data_compensacao: null,
               valor_esperado: valorEsperado,
               valor_recebido: 0
            });
         }
      }

      // varrer extrato pra achar entradas que nao casaram com nenhuma venda
      for (const itemBanco of extratos) {
         if (!extratosUsados.has(itemBanco.id)) {
            const valorRecebido = Number(itemBanco.valor_recebido || 0);

            resultados.push({
               id_venda: null,
               id_extrato: itemBanco.id,
               tipo_resultado: 'NAO_ENCONTRADO_NO_SISTEMA',
               valor_diferenca: Number((0 - valorRecebido).toFixed(2)),
               id_pedido: null,
               codigo_transacao_banco: itemBanco.codigo_transacao_banco,
               data_venda: null,
               data_compensacao: itemBanco.data_compensacao,
               valor_esperado: 0,
               valor_recebido: valorRecebido
            });
         }
      }

      // atualiza status nas tabelas originais pra não reprocessar no proximo upload
      const idsVendas = vendas.map(v => v.id);
      const idsExtratos = extratos.map(e => e.id);

      if (idsVendas.length > 0) {
         await db.query("UPDATE vendas_sistema SET status_reconciliacao = 'CONCILIADO' WHERE id IN (?)", [idsVendas]);
      }

      if (idsExtratos.length > 0) {
         await db.query("UPDATE extrato_bancario SET status_reconciliacao = 'CONCILIADO' WHERE id IN (?)", [idsExtratos]);
      }

      return resultados;

   } catch (erro) {
      console.error('Erro no motor de Reconciliação', erro);
      throw erro;
   }
};

// exportar função
module.exports = { executarReconciliacao };
