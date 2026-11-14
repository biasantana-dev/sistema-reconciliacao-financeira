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
      const [vendas] = await db.query('SELECT * FROM vendas_sistema');
      const [extratos] = await db.query('SELECT * FROM extrato_bancario');

      console.log(`Pronto para cruzar: ${vendas.length} vendas com ${extratos.length} extratos.`);

      const resultados = [];

      for (const venda of vendas) {
         const dataVendaISO = formatarDataISO(venda.data_venda);
         const valorEsperado = Number(venda.valor_esperado || 0);

         // .find() pra varrer a lista do banco de dados, buscando data ou valor
         const extratoEncontrado = extratos.find((itemBanco) => {
            const dataBancoISO = formatarDataISO(itemBanco.data_compensacao);
            const valorRecebido = Number(itemBanco.valor_recebido || 0);

            const mesmaData = dataVendaISO !== null && dataVendaISO === dataBancoISO;
            const mesmoValor = valorEsperado > 0 && valorEsperado === valorRecebido;
            return mesmaData || mesmoValor;
         });

         if (extratoEncontrado) {
            const dataBancoISO = formatarDataISO(extratoEncontrado.data_compensacao);
            const valorRecebido = Number(extratoEncontrado.valor_recebido || 0);

            const mesmaData = dataVendaISO !== null && dataVendaISO === dataBancoISO;
            const mesmoValor = valorEsperado === valorRecebido;

            let tipoResultado = 'MATCH_PERFEITO';
            valorDiferenca = 0.00;

            if (mesmaData && !mesmoValor) {
               tipoResultado = 'DIFERENCA_VALOR';
               valorDiferenca = valorEsperado - valorRecebido;
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

      // varrer extrato pra achar se tem mais dinheiro que no sistema
      for (const itemBanco of extratos) {

         // verifica se o id de extrato ja foi guardado na lista resultados
         const jaFoiProcessado = resultados.some(r => r.id_extrato === itemBanco.id);

         if (!jaFoiProcessado) {
            const valorRecebido = Number(itemBanco.valor_recebido || 0);

            // nao encontrado no sistema
            resultados.push({
               id_venda: null,
               id_extrato: itemBanco.id,
               tipo_resultado: 'NAO_ENCONTRADO_NO_SISTEMA',
               valor_diferenca: 0 - valorRecebido,
               id_pedido: null,
               codigo_transacao_banco: itemBanco.codigo_transacao_banco,
               data_venda: null,
               data_compensacao: itemBanco.data_compensacao,
               valor_esperado: 0,
               valor_recebido: valorRecebido
            });
         }
      }

      return resultados;

   } catch (erro) {
      console.error('Erro no motor de Reconciliação', erro);
   }
};

// exportar função
module.exports = { executarReconciliacao };
