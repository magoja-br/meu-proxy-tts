// server.js

// Carrega a chave do arquivo .env (apenas localmente)
require('dotenv').config();
const express = require('express');
const axios = require('axios');
const cors = require('cors');

const app = express();
// Usa a porta definida no ambiente (para deploy no Render) ou 3000 como padrão
const port = process.env.PORT || 3000;
// A chave API é lida das Variáveis de Ambiente do Render (online) ou do .env (local)
const apiKey = process.env.GOOGLE_TTS_API_KEY;

// Verificação crucial da chave de API
if (!apiKey || apiKey === "SUA_CHAVE_API_REAL_AQUI" || apiKey.length < 10) {
  console.error("---------------------------------------------------------");
  console.error(" ERRO FATAL: Chave da API do Google não configurada      ");
  console.error(" Verifique as Variáveis de Ambiente no Render (online)   ");
  console.error(" ou o arquivo .env (local).                            ");
  console.error("---------------------------------------------------------");
  process.exit(1); // Encerra a aplicação se a chave não for encontrada
}

// --- Configuração do CORS (LISTA CORRIGIDA) ---
// Lista dos endereços (origens) permitidos a acessar este backend
const allowedOrigins = [
  'http://localhost', // Para testes locais (npx serve, etc.)
  'http://127.0.0.1', // Para testes locais (Live Server, etc.)
  'null',             // Para abrir arquivos file:/// locais

  // URLs dos seus sites no GitHub Pages (sem a barra final)
  'https://magoja-br.github.io/catecismo-web',
  'https://magoja-br.github.io/texto-mp3',
  'https://magoja-br.github.io/meu-leitor-web',
  'https://magoja-br.github.io/minha-biblia-web',
  
  // URL BASE (Adicionado para corrigir o erro de CORS de 'https://magoja-br.github.io')
  'https://magoja-br.github.io' 
];
// --------------------------------------------------

app.use(cors({
  origin: function (origin, callback) {
    // MODIFICADO: Verifica se a origem COMEÇA COM um dos URLs permitidos
    // Isto permite subpáginas como /catecismo-web/index.html
    // E também trata o caso de a origem ser 'https://magoja-br.github.io'
    if (!origin || origin === 'null' || allowedOrigins.some(allowed => origin.startsWith(allowed))) {
      callback(null, true);
    } else {
      console.warn(`Origem NÃO PERMITIDA pelo CORS: ${origin}`);
      callback(new Error(`A origem ${origin} não tem permissão para acessar este recurso.`));
    }
  },
  methods: ['POST', 'OPTIONS'], // Permite métodos POST e pré-verificação OPTIONS
  allowedHeaders: ['Content-Type'] // Permite o cabeçalho Content-Type
}));
// ----------------------------

app.use(express.json()); // Habilita o servidor a entender JSON nas requisições

// Rota principal que seus sites vão chamar
app.post('/synthesize', async (req, res) => {
  console.log(`[${new Date().toISOString()}] Requisição recebida para /synthesize`);
  const { text, voice, speed } = req.body;

  if (!text) {
    console.error("Requisição inválida: Texto ausente.");
    return res.status(400).json({ error: 'O texto para síntese é obrigatório.' });
  }

  // Prepara os dados para enviar ao Google
  const googleRequestBody = {
    input: { text: text },
    voice: {
      languageCode: "pt-BR",
      name: voice || "pt-BR-Chirp3-HD-Algieba" // Usa a voz enviada ou um padrão
    },
    audioConfig: {
      audioEncoding: "MP3",
      speakingRate: speed || 1.0 // Usa a velocidade enviada ou um padrão
    }
  };
  const googleApiUrl = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;

  try {
    console.log("Enviando solicitação para a API do Google TTS...");
    // Faz a chamada REAL para o Google (com sua chave segura)
    const googleResponse = await axios.post(googleApiUrl, googleRequestBody);
    console.log("Resposta recebida do Google TTS.");

    // Verifica e envia o áudio de volta para o site do usuário
    if (googleResponse.data && googleResponse.data.audioContent) {
      res.json({ audioContent: googleResponse.data.audioContent });
      console.log("Áudio enviado com sucesso para o cliente.");
    } else {
      console.error("Resposta inesperada do Google:", googleResponse.data);
      res.status(500).json({ error: 'Resposta inválida da API do Google.' });
    }
  } catch (error) {
    // Captura e loga erros detalhados da chamada ao Google
    let errorMessage = 'Erro desconhecido ao processar áudio.';
    let statusCode = 500;
    if (error.response) {
      // Erro veio da resposta do Google
      console.error('Erro na resposta da API Google TTS:', error.response.status, error.response.data);
      errorMessage = `Erro do Google TTS (${error.response.status}): ${error.response.data?.error?.message || 'Detalhe indisponível'}`;
      statusCode = error.response.status >= 400 && error.response.status < 500 ? 400 : 500; // Repassa erros 4xx como Bad Request
    } else if (error.request) {
      // A requisição foi feita mas não houve resposta
      console.error('Erro de rede ou sem resposta da API Google TTS:', error.message);
      errorMessage = 'Não foi possível conectar à API do Google TTS.';
      statusCode = 504; // Gateway Timeout
    } else {
      // Erro ao configurar a requisição
      console.error('Erro ao configurar a requisição para Google TTS:', error.message);
      errorMessage = 'Erro interno ao preparar a solicitação de áudio.';
    }
    res.status(statusCode).json({ error: errorMessage });
  }
});

// Rota de verificação simples (opcional)
app.get('/', (req, res) => {
  res.send('Servidor Proxy TTS está funcionando!');
});

// Inicia o servidor para escutar na porta definida
app.listen(port, () => {
  // Esta mensagem no Render mostrará uma porta interna (ex: 10000), o que é normal.
  console.log(`Servidor proxy TTS iniciado e escutando em http://localhost:${port}`);
  console.log("Origens CORS permitidas (verifique se seus sites estão aqui para deploy):");
  allowedOrigins.forEach(origin => console.log(` - ${origin}`));
  console.log("---------------------------------------------------------");
});