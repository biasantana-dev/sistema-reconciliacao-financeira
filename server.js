// importaçao das bibliotecas (dependências)
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const csv = require('csv-parser');
const {Readable} = require('stream'); // módulo nativo do node
const db = require('./src/config/db');
const {inserirVendas, inserirExtrato, inserirResultados} = require('./src/services/dbService');
const { executarReconciliacao } = require('./src/services/reconciliacaoService');

// inicialização do app
const app = express();
const PORT = 3000; // porta onde o servidor vai rodar localmente

// middleware (os seguranças e tradutores da api)
app.use(cors()); // permite que o frontend converse com a API sem ser bloqueada
app.use(express.json()); // ensina a API a ler e responder objs no formato JSON 

// configurando o multer pra guardar os arquivos na mémoria ram 
const upload = multer({ storage: multer.memoryStorage() });

// função pra transformar o buffer da memória em array de objs JS
const lerCSV = (buffer) => {
   return new Promise((resolve, reject) => {
      const resultados = [];
      const stream = Readable.from(buffer); // transforma a memória num fluxo de dados

      stream.pipe(csv()) // passa os dados pelo tradutor CSV 
      .on('data', (linha) => resultados.push(linha)) // a cada linha lida, guarda no array
      .on('end', () => resolve(resultados)) // quando terminar, devolve o array
      .on('error', (erro) => reject(erro)); // se der erro avisa
   });
}

// rota de teste 
app.get('/', (req, res) => {
   res.status(200).json({
      status: 'Online',
      msg: 'API de Reconciliação Financeira rodando com sucesso!'
   });
});

// rota POST: onde o upload acontece
// upload.fields bloqueia arquivos não solicitados e espera nomes especificos
app.post('/api/reconciliacao', upload.fields([
   { name: 'vendas', maxCount: 1 },
   { name: 'extrato', maxCount: 1 }
]), async (req, res) => {

   // validação de segurança: o usuário mandou os dois arquivos???
   if (!req.files || !req.files.vendas || !req.files.extrato) {
      return res.status(400).json({
         erro: 'Por favor, envie os dois arquivos CSV: "vendas" e "extrato".' 
      });
   }

   try {
      //pegar os buffers 
      const vendasBuffer = req.files.vendas[0].buffer;
      const extratoBuffer = req.files.extrato[0].buffer;

      // mandar pra função ler e esperar await o resultado
      const arrayVendas = await lerCSV(vendasBuffer);
      const arrayExtrato = await lerCSV(extratoBuffer);

      // dispara as duas gravações ao mesmo tempo no mySQL
      await Promise.all([
         inserirVendas(arrayVendas),
         inserirExtrato(arrayExtrato)
      ]);

      // confirmando gravação
      res.status(200).json({
         msg: 'Arquivos processados e salvos no banco de dados com sucesso!',
         totalVendas: arrayVendas.length,
         totalExtrato: arrayExtrato.length,
      });   
   } catch (erro) {
      console.error(erro);
      res.status(500).json({erro: 'Falha ao processar a leitura dos arquivos CSV.'})
   }
});

// rota POST: pra disparar o cruzamento de dados
app.post('/api/executar-reconciliacao', async (req, res) => {
   try {
      const resultadosProntos = await executarReconciliacao(); 

      if (!resultadosProntos || resultadosProntos.length === 0) {
         return res.status(400).json({ erro: 'Nenhum dado encontrado para cruzar.'}); // pra ter certeza que o resultadosProntos tem algo pra adicionar no inserirResultado
      }

      // mandando os resultados pro banco de dados
      await inserirResultados(resultadosProntos);


      const itensDivergentes = resultadosProntos.filter(item => item.tipo_resultado !== 'MATCH_PERFEITO')

      res.status(200).json({
         msg: 'Reconciliação executada com sucesso!',
         totalCruzamentos: resultadosProntos.length,
         amostraCruzamento: resultadosProntos[0],
         totalDivergencias: itensDivergentes.length,
         divergencias: itensDivergentes
      });

   } catch (erro) {
      console.error(erro);
      res.status(500).json({ erro: 'Falha ao executar motor de reconciliação.'});
   }
});

// ligando o motor
app.listen(PORT, () => {
   console.log(`Servidor rodando na porta ${PORT}`);
   console.log(`Acesse: http://localhost:${PORT}`);
});