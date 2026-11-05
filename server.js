// importaçao das bibliotecas (dependências)
const express = require('express');
const cors = require('cors');
const multer = require('multer');

// inicialização do app
const app = express();
const PORT = 3000; // porta onde o servidor vai rodar localmente

// middleware (os seguranças e tradutores da api)
app.use(cors()); // permite que o frontend converse com a API sem ser bloqueada
app.use(express.json()); // ensina a API a ler e responder objs no formato JSON 

// configurando o multer pra guardar os arquivos na mémoria ram 
const upload = multer({ storage: multer.memoryStorage() });

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
]), (req, res) => {

   // validação de segurança: o usuário mandou os dois arquivos???
   if (!req.files || !req.files.vendas || !req.files.extrato) {
      return res.status(400).json({
         erro: 'Por favor, envie os dois arquivos CSV: "vendas" e "extrato".' 
      });
   }

   // se passou pela validação, capturamos os arquivos da memória
   const arquivoVendas = req.files.vendas[0];
   const arquivoExtrato = req.files.extrato[0];

   // resposta temporária só pra provar que os arquivos chegaram 
   res.status(200).json({
      msg: 'Arquivos recebidos com sucesso na memória!',
      vendasInfo: { nome: arquivoVendas.originalname, tamanhoBytes: arquivoVendas.size },
      extratoInfo: { nome: arquivoExtrato.originalname, tamanhoBytes: arquivoExtrato.size }
   });
});

// ligando o motor
app.listen(PORT, () => {
   console.log(`Servidor rodando na porta ${PORT}`);
   console.log(`Acesse: http://localhost:${PORT}`);
});