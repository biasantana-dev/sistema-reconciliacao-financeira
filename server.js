// importaçao das bibliotecas (dependências)
const express = require('express');
const cors = require('cors');

// inicialização do app
const app = express();
const PORT = 3000; // porta onde o servidor vai rodar localmente

// middleware (os seguranças e tradutores da api)
app.use(cors()); // permite que o frontend converse com a API sem ser bloqueada
app.use(express.json()); // ensina a API a ler e responder objs no formato JSON 

// rota de teste 
app.get('/', (req, res) => {
   res.status(200).json({
      status: 'Online',
      msg: 'API de Reconciliação Financeira rodando com sucesso!'
   });
});

// ligando o motor
app.listen(PORT, () => {
   console.log(`Servidor rodando na porta ${PORT}`);
   console.log(`Acesse: http://localhost:${PORT}`);
});