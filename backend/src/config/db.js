require('dotenv').config();
const mysql = require('mysql2/promise'); //usar a versão com promises pra poder usar async/await

// criação do pool de ligações
const pool = mysql.createPool({
   host: process.env.DB_HOST || 'localhost', // onde o mySQL vai rodar 
   user: process.env.DB_USER || 'root', // utilizador padrão do mySQL
   password: process.env.DB_PASSWORD || '',
   database: process.env.DB_NAME || 'reconciliacao_financeira',
   waitForConnections: true,
   connectionLimit: 10, // permite até 10 ligações simultaneas para processamento rápido
   queueLimit: 0
});

// teste rápido de ligação ao iniciar ficheiro
pool.getConnection()
   .then(connection => {
      console.log('Ligação a base de dados My SQL estabelecida com sucesso!');
      connection.release(); // devolve a ligação a 'piscina' pra não prender ela
   })
   .catch(err => {
      console.error('Erro: não foi possível ligar a base de dados.', err.message);
   });

// exportando a pool pra ser usado em outros ficheiros da API
module.exports = pool;