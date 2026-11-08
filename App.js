import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import ConfidenceBadge from './src/components/ConfidenceBadge';
import CorrectionModal from './src/components/CorrectionModal';
import CorrectionsDrawerModal from './src/components/CorrectionsDrawerModal';
import ExplainabilityCard from './src/components/ExplainabilityCard';
import {
  askGeminiTutor,
  generateContingencyResponse,
  getConfiguredApiKey,
  SUGGESTED_TEST_PROMPTS,
} from './src/services/geminiService';
import {
  clearAllPersistedData,
  loadChatHistory,
  loadCorrections,
  removeCorrectionEntry,
  resetChatHistoryOnly,
  saveChatHistory,
  saveCorrectionEntry,
} from './src/services/storageService';

export default function App() {
  const [messages, setMessages] = useState([]);
  const [corrections, setCorrections] = useState([]);
  const [inputQuestion, setInputQuestion] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isStorageReady, setIsStorageReady] = useState(false);

  const [correctionModalVisible, setCorrectionModalVisible] = useState(false);
  const [selectedMessageToCorrect, setSelectedMessageToCorrect] = useState(null);

  const [drawerVisible, setDrawerVisible] = useState(false);

  const [feedbackBanner, setFeedbackBanner] = useState(null);

  const [forceDemoMode, setForceDemoMode] = useState(false);

  const scrollViewRef = useRef(null);
  const hasApiKey = Boolean(getConfiguredApiKey());

  useEffect(() => {
    let mounted = true;
    async function bootstrap() {
      const [loadedMessages, loadedCorrections] = await Promise.all([
        loadChatHistory(),
        loadCorrections(),
      ]);
      if (mounted) {
        setMessages(loadedMessages);
        setCorrections(loadedCorrections);
        setIsStorageReady(true);
      }
    }
    bootstrap();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (isStorageReady && messages.length > 0) {
      saveChatHistory(messages);
    }
  }, [messages, isStorageReady]);

  const showTemporaryFeedback = (text, type = 'success') => {
    setFeedbackBanner({ text, type });
    setTimeout(() => {
      setFeedbackBanner((prev) => (prev?.text === text ? null : prev));
    }, 4500);
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 120);
  };

  const handleSendQuestion = async (customQuestionText, useContingency = false) => {
    const questionToAsk = (
      typeof customQuestionText === 'string' ? customQuestionText : inputQuestion
    ).trim();

    if (!questionToAsk || isLoading) return;

    if (typeof customQuestionText !== 'string') {
      setInputQuestion('');
    }

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: questionToAsk,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);
    scrollToBottom();

    try {
      let tutorResult;
      if (useContingency || forceDemoMode) {
        await new Promise((r) => setTimeout(r, 450));
        tutorResult = generateContingencyResponse(questionToAsk, corrections);
      } else {
        tutorResult = await askGeminiTutor(questionToAsk, corrections);
      }

      const assistantMsg = {
        id: `tutor-${Date.now()}`,
        role: 'assistant',
        questionAsked: questionToAsk,
        ...tutorResult,
        timestamp: new Date().toISOString(),
        userFeedback: null,
      };

      setMessages((prev) => [...prev, assistantMsg]);
      scrollToBottom();
    } catch (error) {
      const errorMsg = {
        id: `error-${Date.now()}`,
        role: 'system_error',
        questionAsked: questionToAsk,
        code: error.code || 'UNKNOWN_ERROR',
        title: error.title || 'Falha ao consultar o modelo',
        userMessage:
          error.userMessage ||
          'Ocorreu um erro inesperado ao tentar obter a resposta.',
        technicalDetail: error.technicalDetail || error.message || '',
        recoverySuggestion:
          error.recoverySuggestion ||
          'Toque em "Tentar Novamente" ou gere uma resposta demonstrativa local.',
        timestamp: new Date().toISOString(),
      };

      setMessages((prev) => [...prev, errorMsg]);
      scrollToBottom();
    } finally {
      setIsLoading(false);
    }
  };

  const openCorrectionForMessage = (msg) => {
    setSelectedMessageToCorrect(msg);
    setCorrectionModalVisible(true);
  };

  const handleSaveStudentCorrection = async ({
    messageId,
    question,
    correctedAnswer,
    errorCategory,
    studentSource,
  }) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    const originalAiAnswer =
      targetMsg?.originalAiAnswer || targetMsg?.answer || '';

    const correctionRecord = {
      id: targetMsg?.correctionData?.id || `corr-${Date.now()}`,
      messageId,
      question,
      correctedAnswer,
      originalAiAnswer,
      errorCategory,
      studentSource,
      previousSources: targetMsg?.sources || [],
      updatedAt: new Date().toISOString(),
    };

    try {
      const updatedCorrections = await saveCorrectionEntry(correctionRecord);
      setCorrections(updatedCorrections);

      setMessages((prev) =>
        prev.map((m) => {
          if (m.id !== messageId) return m;
          return {
            ...m,
            questionAsked: question,
            answer: correctedAnswer,
            originalAiAnswer,
            confidenceScore: 100,
            confidenceLevel: 'validada',
            confidenceJustification: `Resposta corrigida e validada manualmente pelo aluno (${errorCategory}).`,
            isCorrected: true,
            correctionData: correctionRecord,
            originMode: 'memory_correction',
            sources: [
              {
                title: studentSource,
                authorOrOrigin: 'Revisão Humana (Aluno)',
                type: 'Correção do Aluno',
                snippet: `Substituiu a resposta da IA. Diagnóstico: ${errorCategory}.`,
              },
              ...(m.sources || []).filter((s) => s.type !== 'Correção do Aluno'),
            ],
          };
        })
      );

      setCorrectionModalVisible(false);
      setSelectedMessageToCorrect(null);
      showTemporaryFeedback(
        'Correção salva. A resposta foi atualizada e gravada na memória local (AsyncStorage).',
        'success'
      );
    } catch {
      showTemporaryFeedback(
        'Não foi possível gravar no armazenamento local, mas a resposta foi atualizada na tela.',
        'warning'
      );
    }
  };

  const handleRevertCorrection = async (messageId) => {
    const targetMsg = messages.find((m) => m.id === messageId);
    if (!targetMsg || !targetMsg.isCorrected) return;

    if (targetMsg.correctionData?.id) {
      const updated = await removeCorrectionEntry(targetMsg.correctionData.id);
      setCorrections(updated);
    }

    setMessages((prev) =>
      prev.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          answer: m.originalAiAnswer || m.answer,
          isCorrected: false,
          confidenceScore: 70,
          confidenceLevel: 'media',
          confidenceJustification:
            'Resposta original da IA restaurada pelo aluno após desfazer a edição.',
          sources: (m.sources || []).filter(
            (s) => s.type !== 'Correção do Aluno'
          ),
        };
      })
    );

    setCorrectionModalVisible(false);
    setSelectedMessageToCorrect(null);
    showTemporaryFeedback(
      'Resposta original da IA restaurada com sucesso.',
      'info'
    );
  };

  const handleDeleteCorrectionFromDrawer = async (correctionId) => {
    const updated = await removeCorrectionEntry(correctionId);
    setCorrections(updated);
    showTemporaryFeedback('Correção removida da memória local.', 'info');
  };

  const handleResetChat = async () => {
    const resetMsgs = await resetChatHistoryOnly();
    setMessages(resetMsgs);
    showTemporaryFeedback(
      'Conversa reiniciada (suas correções salvas continuam na memória).',
      'info'
    );
  };

  const handleClearAllStorage = async () => {
    const { messages: initialMsgs, corrections: emptyCorr } =
      await clearAllPersistedData();
    setMessages(initialMsgs);
    setCorrections(emptyCorr);
    setDrawerVisible(false);
    showTemporaryFeedback(
      'Todos os dados persistidos (chat e correções) foram apagados.',
      'info'
    );
  };

  const handleQuickFeedback = (msg, rating) => {
    setMessages((prev) =>
      prev.map((m) => (m.id === msg.id ? { ...m, userFeedback: rating } : m))
    );
    if (rating === 'error') {
      openCorrectionForMessage(msg);
    } else {
      showTemporaryFeedback(
        'Feedback registrado. Obrigado por avaliar a confiança da resposta.',
        'success'
      );
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <KeyboardAvoidingView
        style={styles.mainWrapper}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.responsiveContainer}>
          <View style={styles.header}>
            <View style={styles.headerTopRow}>
              <View style={styles.brandGroup}>
                <View style={styles.avatarBadge}>
                  <Text style={styles.avatarInitials}>IHC</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.appTitle}>Tutor IA - Projeto IHC</Text>
                  <Text style={styles.appSubtitle}>
                    Explicabilidade, Confiança Calibrada e Design de Erros
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.statusToolbar}>
              <TouchableOpacity
                style={[
                  styles.apiStatusPill,
                  hasApiKey && !forceDemoMode
                    ? styles.apiStatusActive
                    : styles.apiStatusDemo,
                ]}
                onPress={() => setForceDemoMode((prev) => !prev)}
                accessibilityRole="button"
                accessibilityLabel="Alternar entre API Gemini e Modo Demonstrativo"
              >
                <Text
                  style={[
                    styles.apiStatusText,
                    hasApiKey && !forceDemoMode
                      ? styles.apiStatusTextActive
                      : styles.apiStatusTextDemo,
                  ]}
                >
                  {hasApiKey && !forceDemoMode
                    ? 'Status: Gemini 3.5 Flash Lite (.env ativo)'
                    : forceDemoMode
                    ? 'Status: Modo Demo Forçado (Toque p/ API)'
                    : 'Status: Sem chave no .env (Modo Guiado)'}
                </Text>
              </TouchableOpacity>

              <View style={styles.toolbarRight}>
                <TouchableOpacity
                  style={styles.memoryBtn}
                  onPress={() => setDrawerVisible(true)}
                >
                  <Text style={styles.memoryBtnText}>
                    Correções ({corrections.length})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={styles.resetChatBtn}
                  onPress={handleResetChat}
                >
                  <Text style={styles.resetChatBtnText}>Limpar Chat</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {!!feedbackBanner && (
            <View
              style={[
                styles.feedbackToast,
                feedbackBanner.type === 'warning' && styles.feedbackToastWarning,
                feedbackBanner.type === 'info' && styles.feedbackToastInfo,
              ]}
            >
              <Text style={styles.feedbackToastText}>{feedbackBanner.text}</Text>
            </View>
          )}

          <View style={styles.QuickPromptsSection}>
            <Text style={styles.quickPromptsTitle}>
              Atalhos de Teste de IHC (toque para enviar):
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.quickPromptsScroll}
            >
              {SUGGESTED_TEST_PROMPTS.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.promptChip}
                  onPress={() => handleSendQuestion(item.question)}
                  disabled={isLoading}
                >
                  <Text style={styles.promptChipTitle}>{item.label}</Text>
                  <Text style={styles.promptChipSub}>{item.shortDesc}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>

          <ScrollView
            ref={scrollViewRef}
            style={styles.chatScroll}
            contentContainerStyle={styles.chatContent}
            keyboardShouldPersistTaps="handled"
          >
            {messages.map((msg) => {
              if (msg.role === 'user') {
                return (
                  <View key={msg.id} style={styles.userRow}>
                    <View style={styles.userBubble}>
                      <Text style={styles.userRoleLabel}>Você (Aluno)</Text>
                      <Text style={styles.userBubbleText}>{msg.text}</Text>
                    </View>
                  </View>
                );
              }

              if (msg.role === 'system_error') {
                return (
                  <View key={msg.id} style={styles.errorCard}>
                    <View style={styles.errorHeader}>
                      <View style={styles.errorAlertTag}>
                        <Text style={styles.errorAlertTagText}>ERRO</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.errorTitle}>{msg.title}</Text>
                        <Text style={styles.errorSubtitle}>
                          Design de Erros (Diagnóstico e Recuperação Assistida)
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.errorBodyText}>{msg.userMessage}</Text>

                    {!!msg.technicalDetail && (
                      <View style={styles.technicalBox}>
                        <Text style={styles.technicalText}>
                          Detalhe: {msg.technicalDetail}
                        </Text>
                      </View>
                    )}

                    <View style={styles.recoveryGuideBox}>
                      <Text style={styles.recoveryGuideLabel}>
                        Como resolver:
                      </Text>
                      <Text style={styles.recoveryGuideText}>
                        {msg.recoverySuggestion}
                      </Text>
                    </View>

                    <View style={styles.errorActionsRow}>
                      <TouchableOpacity
                        style={styles.retryBtn}
                        onPress={() =>
                          handleSendQuestion(msg.questionAsked, false)
                        }
                      >
                        <Text style={styles.retryBtnText}>
                          Tentar Novamente (API)
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.contingencyBtn}
                        onPress={() =>
                          handleSendQuestion(msg.questionAsked, true)
                        }
                      >
                        <Text style={styles.contingencyBtnText}>
                          Gerar Resposta Demonstrativa
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              }

              return (
                <View key={msg.id} style={styles.tutorRow}>
                  <View
                    style={[
                      styles.tutorBubble,
                      msg.isCorrected && styles.tutorBubbleCorrected,
                    ]}
                  >
                    <View style={styles.tutorHeader}>
                      <Text style={styles.tutorRoleLabel}>
                        Tutor Inteligente de IHC
                      </Text>
                      {msg.isCorrected && (
                        <View style={styles.correctedHeaderTag}>
                          <Text style={styles.correctedHeaderTagText}>
                            Corrigida pelo Aluno
                          </Text>
                        </View>
                      )}
                    </View>

                    {msg.isCorrected && (
                      <View style={styles.correctedNoticeBanner}>
                        <Text style={styles.correctedNoticeTitle}>
                          Resposta Revisada pelo Estudante (Human-in-the-Loop)
                        </Text>
                        <Text style={styles.correctedNoticeSub}>
                          Diagnóstico registrado:{' '}
                          {msg.correctionData?.errorCategory ||
                            'Correção Manual'}
                        </Text>
                      </View>
                    )}

                    <Text style={styles.tutorAnswerText}>{msg.answer}</Text>

                    <ConfidenceBadge
                      score={msg.confidenceScore}
                      level={msg.confidenceLevel}
                      justification={msg.confidenceJustification}
                      isCorrected={msg.isCorrected}
                    />

                    <ExplainabilityCard
                      sources={msg.sources}
                      reasoningSteps={msg.reasoningSteps}
                      limitations={msg.limitations}
                      isCorrected={msg.isCorrected}
                      originalAiAnswer={msg.originalAiAnswer}
                      originMode={msg.originMode}
                    />

                    <View style={styles.messageActionsBar}>
                      <TouchableOpacity
                        style={[
                          styles.correctActionBtn,
                          msg.isCorrected && styles.correctActionBtnEdited,
                        ]}
                        onPress={() => openCorrectionForMessage(msg)}
                        activeOpacity={0.8}
                      >
                        <Text style={styles.correctActionBtnText}>
                          {msg.isCorrected
                            ? 'Editar / Ver Correção'
                            : 'Corrigir Resposta'}
                        </Text>
                      </TouchableOpacity>

                      <View style={styles.feedbackButtonsGroup}>
                        <TouchableOpacity
                          style={[
                            styles.thumbBtn,
                            msg.userFeedback === 'helpful' &&
                              styles.thumbBtnActiveGood,
                          ]}
                          onPress={() => handleQuickFeedback(msg, 'helpful')}
                        >
                          <Text style={styles.thumbBtnText}>Resposta Útil</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={[
                            styles.thumbBtn,
                            msg.userFeedback === 'error' &&
                              styles.thumbBtnActiveBad,
                          ]}
                          onPress={() => handleQuickFeedback(msg, 'error')}
                        >
                          <Text style={styles.thumbBtnText}>Reportar Erro</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  </View>
                </View>
              );
            })}

            {isLoading && (
              <View style={styles.loadingCard}>
                <ActivityIndicator size="small" color="#4F46E5" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.loadingTitle}>
                    Consultando o Tutor e analisando nível de confiança...
                  </Text>
                  <Text style={styles.loadingSubtitle}>
                    Extraindo fontes bibliográficas, passos de raciocínio e grau de certeza.
                  </Text>
                </View>
              </View>
            )}
          </ScrollView>

          <View style={styles.inputContainer}>
            <TextInput
              style={styles.textInput}
              value={inputQuestion}
              onChangeText={setInputQuestion}
              placeholder="Digite qualquer questão para o Tutor responder..."
              placeholderTextColor="#94A3B8"
              multiline
              maxLength={600}
              onSubmitEditing={() => handleSendQuestion()}
            />
            <TouchableOpacity
              style={[
                styles.sendButton,
                (!inputQuestion.trim() || isLoading) &&
                  styles.sendButtonDisabled,
              ]}
              onPress={() => handleSendQuestion()}
              disabled={!inputQuestion.trim() || isLoading}
              accessibilityRole="button"
              accessibilityLabel="Enviar pergunta ao Tutor"
            >
              <Text style={styles.sendButtonText}>Enviar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <CorrectionModal
          visible={correctionModalVisible}
          targetMessage={selectedMessageToCorrect}
          onClose={() => {
            setCorrectionModalVisible(false);
            setSelectedMessageToCorrect(null);
          }}
          onSaveCorrection={handleSaveStudentCorrection}
          onRevertCorrection={handleRevertCorrection}
        />

        <CorrectionsDrawerModal
          visible={drawerVisible}
          corrections={corrections}
          onClose={() => setDrawerVisible(false)}
          onTestCorrectionQuestion={(q) => handleSendQuestion(q)}
          onDeleteCorrection={handleDeleteCorrectionFromDrawer}
          onClearAllData={handleClearAllStorage}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F1F5F9',
  },
  mainWrapper: {
    flex: 1,
    alignItems: 'center',
  },
  responsiveContainer: {
    flex: 1,
    width: '100%',
    maxWidth: 820,
    backgroundColor: '#F8FAFC',
    borderLeftWidth: Platform.OS === 'web' ? 1 : 0,
    borderRightWidth: Platform.OS === 'web' ? 1 : 0,
    borderColor: '#E2E8F0',
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 14,
    paddingTop: Platform.OS === 'android' ? 34 : 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    gap: 8,
  },
  headerTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  avatarBadge: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitials: {
    fontSize: 12,
    fontWeight: '800',
    color: '#3730A3',
  },
  appTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  appSubtitle: {
    fontSize: 11.5,
    color: '#475569',
    fontWeight: '500',
  },
  statusToolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  apiStatusPill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  apiStatusActive: {
    backgroundColor: '#F0FDF4',
    borderColor: '#86EFAC',
  },
  apiStatusDemo: {
    backgroundColor: '#FFFBEB',
    borderColor: '#FCD34D',
  },
  apiStatusText: {
    fontSize: 11,
    fontWeight: '700',
  },
  apiStatusTextActive: {
    color: '#166534',
  },
  apiStatusTextDemo: {
    color: '#92400E',
  },
  toolbarRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  memoryBtn: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  memoryBtnText: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#3730A3',
  },
  resetChatBtn: {
    backgroundColor: '#F1F5F9',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
  },
  resetChatBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#475569',
  },
  feedbackToast: {
    backgroundColor: '#DCFCE7',
    borderBottomWidth: 1,
    borderBottomColor: '#86EFAC',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  feedbackToastWarning: {
    backgroundColor: '#FEF3C7',
    borderBottomColor: '#FDE68A',
  },
  feedbackToastInfo: {
    backgroundColor: '#E0E7FF',
    borderBottomColor: '#A5B4FC',
  },
  feedbackToastText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
  },
  QuickPromptsSection: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  quickPromptsTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748B',
    paddingHorizontal: 14,
    marginBottom: 6,
  },
  quickPromptsScroll: {
    paddingHorizontal: 14,
    gap: 8,
  },
  promptChip: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minWidth: 165,
  },
  promptChipTitle: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#0F172A',
  },
  promptChipSub: {
    fontSize: 10.5,
    color: '#64748B',
    marginTop: 1,
  },
  chatScroll: {
    flex: 1,
  },
  chatContent: {
    padding: 14,
    gap: 14,
    paddingBottom: 24,
  },
  userRow: {
    alignItems: 'flex-end',
  },
  userBubble: {
    backgroundColor: '#4F46E5',
    borderRadius: 14,
    borderBottomRightRadius: 4,
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: '86%',
    gap: 3,
  },
  userRoleLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#C7D2FE',
  },
  userBubbleText: {
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 20,
  },
  tutorRow: {
    alignItems: 'flex-start',
  },
  tutorBubble: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    borderTopLeftRadius: 4,
    padding: 14,
    width: '100%',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    gap: 6,
  },
  tutorBubbleCorrected: {
    borderColor: '#6366F1',
    borderWidth: 1.5,
  },
  tutorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 2,
  },
  tutorRoleLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: '#334155',
  },
  correctedHeaderTag: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  correctedHeaderTagText: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  correctedNoticeBanner: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 8,
    padding: 8,
    marginBottom: 4,
  },
  correctedNoticeTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#312E81',
  },
  correctedNoticeSub: {
    fontSize: 11,
    color: '#4338CA',
    marginTop: 2,
  },
  tutorAnswerText: {
    fontSize: 14,
    color: '#0F172A',
    lineHeight: 21,
  },
  messageActionsBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F1F5F9',
  },
  correctActionBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  correctActionBtnEdited: {
    backgroundColor: '#3730A3',
  },
  correctActionBtnText: {
    color: '#FFFFFF',
    fontSize: 12.5,
    fontWeight: '700',
  },
  feedbackButtonsGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  thumbBtn: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 8,
  },
  thumbBtnActiveGood: {
    backgroundColor: '#DCFCE7',
    borderColor: '#22C55E',
  },
  thumbBtnActiveBad: {
    backgroundColor: '#FEE2E2',
    borderColor: '#EF4444',
  },
  thumbBtnText: {
    fontSize: 11.5,
    fontWeight: '600',
    color: '#334155',
  },
  errorCard: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1.5,
    borderColor: '#F87171',
    borderRadius: 14,
    padding: 14,
    gap: 8,
  },
  errorHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  errorAlertTag: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  errorAlertTagText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '800',
  },
  errorTitle: {
    fontSize: 14.5,
    fontWeight: '800',
    color: '#7F1D1D',
  },
  errorSubtitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#991B1B',
  },
  errorBodyText: {
    fontSize: 13,
    color: '#7F1D1D',
    lineHeight: 19,
  },
  technicalBox: {
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 6,
    padding: 7,
  },
  technicalText: {
    fontSize: 11,
    color: '#991B1B',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  recoveryGuideBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 10,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    gap: 3,
  },
  recoveryGuideLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7F1D1D',
  },
  recoveryGuideText: {
    fontSize: 12,
    color: '#1E293B',
    lineHeight: 17,
  },
  errorActionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  retryBtn: {
    backgroundColor: '#DC2626',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  retryBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  contingencyBtn: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  contingencyBtnText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
  loadingCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    borderRadius: 12,
    padding: 12,
  },
  loadingTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1E1B4B',
  },
  loadingSubtitle: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
  },
  textInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#0F172A',
    maxHeight: 100,
  },
  sendButton: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#94A3B8',
  },
  sendButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '800',
  },
});
