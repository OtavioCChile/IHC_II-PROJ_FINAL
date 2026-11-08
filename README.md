# Tutor Inteligente de IHC - Explicabilidade, Confiança Calibrada e Design de Erros

Projeto desenvolvido para a disciplina de **Interface Humano-Computador (IHC)** utilizando **React Native (Expo)** e a **API do Google Gemini (`gemini-3.5-flash-lite`)**.

O objetivo central deste projeto não é apenas responder perguntas com Inteligência Artificial, mas demonstrar na prática uma **Interface Centrada no Humano para Sistemas de IA (Human-AI Interaction - HAI)** focada em três pilares fundamentais de IHC:

1. **Explicabilidade (XAI - Explainable AI)**: Exibição transparente das fontes consultadas, origem da resposta, passos do raciocínio (*Chain-of-Thought* simplificado) e limitações do modelo.
2. **Confiança Calibrada do Usuário (*Calibrated Trust*)**: Indicador visual e semântico do nível de confiança (`Alta`, `Média`, `Baixa` ou `Validada pelo Aluno`) acompanhado da justificativa do modelo, evitando tanto a confiança cega (*overtrust*) quanto o abandono da ferramenta.
3. **Design de Erros e Controle Humano (*Human-in-the-Loop*)**: Permite ao estudante **corrigir a resposta de qualquer questão**, diagnosticar o tipo de erro cometido pela IA, informar sua própria fonte de referência, restaurar a versão original se desejar (desfazer) e recuperar-se de falhas de conexão/API sem perder o fluxo de uso.

---

## Fundamentação de IHC Aplicada na Interface

| Conceito de IHC | Referência Teórica | Como foi implementado no App |
| :--- | :--- | :--- |
| **Explicabilidade (XAI) e Divulgação Progressiva** | *Amershi et al. (2019) - Diretriz G11 ("Make clear why the system did what it did")* | Cada resposta exibe imediatamente os cards de **Fontes e Fundamentação** e oferece o botão expansível **"Como a IA pensou? (Ver Raciocínio e Limitações)"** com os passos do raciocínio e limitações. |
| **Confiança Calibrada (*Calibrated Trust*)** | *Amershi et al. (2019) - Diretrizes G1 e G2 ("Make clear how well the system can do what it can do")* | Componente [`ConfidenceBadge`](src/components/ConfidenceBadge.js) com barra de progresso, código de cores acessível (`Alta >= 80%`, `Média 50-79%`, `Baixa < 50%`, `100% Revisado pelo Aluno`) e justificativa explicativa. |
| **Suporte à Correção Eficiente pelo Usuário** | *Amershi et al. (2019) - Diretriz G9 ("Support efficient correction")* | Botão **"Corrigir Resposta"** em todas as mensagens do Tutor, abrindo o [`CorrectionModal`](src/components/CorrectionModal.js) para classificar a falha, editar a resposta e salvar na memória local. |
| **Controle e Liberdade do Usuário** | *3ª Heurística de Usabilidade de Jakob Nielsen (1994)* | O aluno pode editar uma resposta, **comparar com a resposta original da IA** antes da correção e usar o botão **"Restaurar IA Original"** para desfazer a correção a qualquer momento. |
| **Prevenção de Erros** | *5ª Heurística de Usabilidade de Jakob Nielsen (1994)* | Validação preventiva no formulário de correção (impede salvar respostas vazias/incompletas), botões de preenchimento rápido e desativação do botão de envio durante requisições em andamento. |
| **Reconhecer, Diagnosticar e Recuperar-se de Erros** | *9ª Heurística de Usabilidade de Jakob Nielsen (1994)* | Em caso de ausência de chave `.env`, erro de rede ou limite de requisições da API, o sistema exibe um **Card de Diagnóstico e Recuperação** em linguagem clara com botões para **"Tentar Novamente (API)"** ou **"Gerar Resposta Demonstrativa"**. |

---

## Estrutura do Projeto

```text
chatbot/
├── App.js                                   # Tela principal do Chatbot Tutor e gerenciamento de estado
├── src/
│   ├── components/
│   │   ├── ConfidenceBadge.js               # Medidor visual e justificativa do Nível de Confiança
│   │   ├── ExplainabilityCard.js            # Fontes, Raciocínio Passo a Passo e Comparação Antes/Depois
│   │   ├── CorrectionModal.js               # Modal de Correção pelo Aluno (Human-in-the-Loop)
│   │   └── CorrectionsDrawerModal.js        # Painel de inspeção da Memória Local (AsyncStorage)
│   └── services/
│       ├── geminiService.js                 # Integração com a API do Gemini (modelo leve Flash Lite) + Contingência
│       └── storageService.js                # Persistência local leve com @react-native-async-storage/async-storage
├── .env.example                             # Modelo de variáveis de ambiente (vai para o Git)
├── .env                                     # Arquivo local com sua chave secreta (IGNORADO pelo .gitignore)
└── .gitignore                               # Configurado para proteger o arquivo .env
```

---

## Configuração da Chave da API do Gemini (Segurança no Git)

A chave da API **não fica exposta no código-fonte**. O arquivo `.gitignore` já está configurado para ignorar `.env`, `.env.local` e variações, garantindo que sua chave nunca seja enviada ao GitHub.

### Passo a passo para configurar:

1. Acesse o [Google AI Studio](https://aistudio.google.com/app/apikey) e gere uma chave gratuita da API do Gemini.
2. Abra o arquivo `.env` na raiz do projeto (ou copie de `.env.example`) e cole sua chave:

```env
EXPO_PUBLIC_GEMINI_API_KEY=AIzaSySuaChaveRealAqui...
EXPO_PUBLIC_GEMINI_MODEL=gemini-3.5-flash-lite
```

> **Nota sobre modelos leves:** Por padrão, o projeto utiliza o modelo leve e rápido `gemini-3.5-flash-lite` (com fallback automático para variantes Flash Lite caso necessário).

---

## Como Executar o Projeto

### 1. Instalar dependências (caso necessário)
```bash
npm install
```

### 2. Iniciar o servidor do Expo (limpando o cache para carregar o `.env`)
```bash
npx expo start -c
```

- **Para testar no Navegador (Web):** Pressione a tecla **`w`** no terminal (ou rode `npx expo start --web`).
- **Para testar no Celular (Android / iOS):** Instale o aplicativo **Expo Go** no celular e escaneie o QR Code exibido no terminal.

---

