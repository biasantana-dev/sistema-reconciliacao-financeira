// importando a conexão com o banco de dados
const db = require('../config/db');

// cria a funçao principal do motor
const executarReconciliacao = async () => {
   try {
      // buscando vendas
      const queryVendas = 'SELECT * FROM vendas_sistema';
      const [vendas] = await db.query(queryVendas);

      // buscando extratos
      const queryExtrato = 'SELECT * FROM extrato_bancario';
      const [extratos] = await db.query(queryExtrato);

      console.log(`Pronto para cruzar: ${vendas.length} vendas com ${extratos.length} extratos.`);

      const resultados = [];

      for (const venda of vendas) {

         // .find() pra varrer a lista do banco de dados, buscando data ou valor
         const extratoEncontrado = extratos.find((itemBanco) => {
            return (venda.data_venda === itemBanco.data_compensacao) || (venda.valor_esperado === itemBanco.valor_recebido);
         });

         if (extratoEncontrado) {
             const mesmaData = (venda.data_venda === extratoEncontrado.data_compensacao);
             const mesmoValor = (venda.valor_esperado === extratoEncontrado.valor_recebido);

            // verificar se os valores batem
            if (mesmaData && mesmoValor) {

               // match perfeito
               resultados.push({
                  id_venda: venda.id,
                  id_extrato: extratoEncontrado.id,
                  tipo_resultado: 'MATCH_PERFEITO',
                  valor_diferenca: 0.00
               });
            } else if (mesmaData && !mesmoValor) {

               // pagou no dia certo, mas o valor errado
               resultados.push({
                  id_venda: venda.id,
                  id_extrato: extratoEncontrado.id,
                  tipo_resultado: 'DIFERENCA_VALOR',
                  valor_diferenca: venda.valor_esperado - extratoEncontrado.valor_recebido
               });
            } else if (!mesmaData && mesmoValor) {
               
               // pagou valor certo, mas no dia errado
               resultados.push({
                  id_venda: venda.id,
                  id_extrato: extratoEncontrado.id,
                  tipo_resultado: 'DIFERENCA_DATA',
                  valor_diferenca: 0.00
               });
            }

         } else {
            // não achou nem valor e nem a data - undefined
            resultados.push({
               id_venda: venda.id,
               id_extrato: null,
               tipo_resultado: 'NAO_ENCONTRADO_NO_BANCO',
               valor_diferenca: venda.valor_esperado
            });
         } 
      }

      // varrer extrato pra achar se tem mais dinheiro que no sistema
      for (const itemBanco of extratos) {
         // verifica se o id de extrato ja foi guardado na lista resultados
         const jaFoiProcessado = resultados.some((resultadoAtual) => {
            return resultadoAtual.id_extrato === itemBanco;
         });

         if (!jaFoiProcessado) {

            // nao encontrado no sistema
            resultados.push({
               id_venda: null,
               id_extrato: itemBanco.id,
               tipo_resultado: 'NAO_ENCONTRADO_NO_SISTEMA',
               valor_diferenca: 0 - itemBanco.valor_recebido
            });
         }
      };

      return resultados;
   } catch (erro) {
      console.error('Erro no motor de Reconciliação', erro);
   }
};

// exportar função
module.exports = { executarReconciliacao };
