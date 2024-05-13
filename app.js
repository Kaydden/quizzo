
const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { Pool } = require('pg');


require('dotenv').config();

const pool = new Pool({
  user: process.env.USER,
  host: process.env.HOST,
  database: process.env.DATABASE,
  password: process.env.PASSWORD,
  port: 5432,
});

const app = express();

app.set('view engine', 'ejs');

app.use(express.static('public'));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(session({
  secret: 'secreto',
  resave: false,
  saveUninitialized: true
}));

app.get('/', (req, res) => {
  res.redirect('/register');
});

app.post('/login', async (req, res) => {
  const { nickname } = req.body;
  try {
    const { rowCount, rows } = await pool.query('SELECT * FROM users WHERE nickname = $1', [nickname]);
    if (rowCount > 0) {
      req.session.userId = rows[0].id;
      res.redirect('/select-bimester');
    } else {
      res.status(404).send('Usuário não encontrado. Por favor, registre-se.');
    }
  } catch (error) {
    console.error('Erro ao fazer login:', error);
    res.status(500).send('Erro ao fazer login');
  }
});


app.get('/register', (req, res) => {
  res.render('register.ejs');
});

app.post('/register', async (req, res) => {
  const { nickname } = req.body;
  try {
    const { rowCount } = await pool.query('SELECT * FROM users WHERE nickname = $1', [nickname]);
    if (rowCount > 0) {
      res.status(400).send('Usuário já existe. Por favor, escolha outro nickname.');
    } else {
      const { rows } = await pool.query('INSERT INTO users (nickname) VALUES ($1) RETURNING id', [nickname]);
      req.session.userId = rows[0].id;
      res.redirect('/select-bimester');
    }
  } catch (error) {
    console.error('Erro ao registrar o nome do usuário:', error);
    res.status(500).send('Erro ao registrar o nome do usuário');
  }
});

app.get('/select-bimester', (req, res) => {
  res.render('select_bimester');
});

app.get('/load-questions', async (req, res) => {
  const selectedBimester = req.query.bimester;

  try {
    const { rows: questions } = await pool.query('SELECT * FROM questions WHERE bimester = $1', [selectedBimester]);
    res.render('quiz', { questions });
  } catch (error) {
    console.error('Erro ao buscar perguntas:', error);
    res.status(500).send('Erro ao buscar perguntas');
  }
});

app.post('/quiz/submit', async (req, res) => {
  const userAnswers = req.body;
  const userId = req.session.userId;
  if (!userId) {
    return res.status(400).send('Usuário não identificado. Por favor, faça o registro antes de submeter suas respostas.');
  }

  try {
    const { rows: questions } = await pool.query('SELECT * FROM questions');
    let score = 0;
    questions.forEach(question => {
      if (userAnswers[question.id] === question.correct_answer) {
        score++;
      }
    });

    const query = 'INSERT INTO results (user_id, score) VALUES ($1, $2)';
    await pool.query(query, [userId, score]);
    res.redirect('/quiz/results');
  } catch (error) {
    console.error('Erro ao processar respostas:', error);
    res.status(500).send('Erro ao processar respostas');
  }
});

app.get('/quiz/results', async (req, res) => {
  const userId = req.session.userId;
  try {
    const query = 'SELECT * FROM results WHERE user_id = $1 ORDER BY id DESC LIMIT 1';
    const { rows: [latestResult] } = await pool.query(query, [userId]);
    res.render('results', { latestResult });
  } catch (error) {
    console.error('Erro ao buscar resultados:', error);
    res.status(500).send('Erro ao buscar resultados');
  }
});


app.post('/admin/create', async (req, res) => {
  const { question, option1, option2, option3, correct_answer, bimester} = req.body;

  try {
    const questionInsertQuery = 'INSERT INTO questions (question, option1, option2, option3, correct_answer, bimester) VALUES ($1, $2, $3, $4, $5, $6)';
    await pool.query(questionInsertQuery, [question, option1, option2, option3, correct_answer, bimester]);

    res.send('Pergunta criada com sucesso!');
  } catch (error) {
    console.error('Erro ao criar pergunta:', error);
    res.status(500).send('Erro ao criar pergunta');
  }
});


  app.get('/admin/create', async (req, res) => {
    try {
      const query = `
        SELECT users.nickname, results.score
        FROM users
        LEFT JOIN results ON users.id = results.user_id
        ORDER BY users.nickname
      `;
      const { rows: userResults } = await pool.query(query);
      res.render('create_questions', { userResults });
    } catch (error) {
      console.error('Erro ao buscar resultados e usuários:', error);
      res.status(500).send('Erro ao buscar resultados e usuários');
    }
  });

  app.get('/admin/all-results', async (req, res) => {
    try {
      const query = `
        SELECT users.nickname, results.score
        FROM users
        LEFT JOIN results ON users.id = results.user_id
        ORDER BY users.nickname
      `;
      const { rows: userResults } = await pool.query(query);
      res.render('all_results', { userResults });
    } catch (error) {
      console.error('Erro ao buscar todos os resultados dos usuários:', error);
      res.status(500).send('Erro ao buscar todos os resultados dos usuários');
    }
  });  


  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
});