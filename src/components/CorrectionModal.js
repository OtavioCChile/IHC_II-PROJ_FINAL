import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

const ERROR_CATEGORIES = [
  'Erro Conceitual / Factual',
  'Alucinação / Fonte Imprecisa',
  'Resposta Incompleta',
  'Fora do Contexto da Disciplina',
];

/**
 * Modal de Correção Assistida pelo Aluno (Human-in-the-Loop & Design de Erros)
 * Implementa:
 * - Heurística 3 de Nielsen (Controle e liberdade do usuário: editar, restaurar original, cancelar)
 * - Heurística 5 de Nielsen (Prevenção de erros: validação antes do envio e preenchimento assistido)
 * - Diretriz G9 de Amershi et al. (Suporte a correção eficiente pelo usuário)
 */
export default function CorrectionModal({
  visible,
  targetMessage,
  onClose,
  onSaveCorrection,
  onRevertCorrection,
}) {
  const [questionText, setQuestionText] = useState('');
  const [correctedAnswer, setCorrectedAnswer] = useState('');
  const [errorCategory, setErrorCategory] = useState(ERROR_CATEGORIES[0]);
  const [studentSource, setStudentSource] = useState('');
  const [validationError, setValidationError] = useState('');

  useEffect(() => {
    if (targetMessage && visible) {
      setQuestionText(targetMessage.questionAsked || '');
      setCorrectedAnswer(
        targetMessage.isCorrected
          ? targetMessage.answer
          : targetMessage.answer || ''
      );
      setErrorCategory(
        targetMessage.correctionData?.errorCategory || ERROR_CATEGORIES[0]
      );
      setStudentSource(
        targetMessage.correctionData?.studentSource ||
          'Material de aula de IHC / Revisão do Aluno'
      );
      setValidationError('');
    }
  }, [targetMessage, visible]);

  if (!targetMessage) return null;

  const handleConfirmSave = () => {
    const cleanQuestion = questionText.trim();
    const cleanAnswer = correctedAnswer.trim();

    if (!cleanQuestion) {
      setValidationError(
        'Por favor, informe a pergunta de referência para indexar esta correção.'
      );
      return;
    }

    if (cleanAnswer.length < 8) {
      setValidationError(
        'Prevenção de erro: A resposta corrigida deve conter pelo menos 8 caracteres explicativos.'
      );
      return;
    }

    setValidationError('');
    onSaveCorrection({
      messageId: targetMessage.id,
      question: cleanQuestion,
      correctedAnswer: cleanAnswer,
      errorCategory,
      studentSource: studentSource.trim() || 'Revisão Direta do Aluno',
    });
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.overlay}
      >
        <View style={styles.modalCard}>
          <View style={styles.header}>
            <View style={styles.headerTextGroup}>
              <Text style={styles.headerTitle}>Corrigir Resposta da Questão</Text>
              <Text style={styles.headerSubtitle}>
                Design de Erros e Controle Humano (Human-in-the-Loop)
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeBtn}
              accessibilityRole="button"
              accessibilityLabel="Fechar janela de correção sem salvar"
            >
              <Text style={styles.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollBody}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>1. Questão de Referência:</Text>
              <TextInput
                style={styles.questionInput}
                value={questionText}
                onChangeText={(t) => {
                  setQuestionText(t);
                  if (validationError) setValidationError('');
                }}
                placeholder="Digite a pergunta correspondente..."
                multiline
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                2. Diagnóstico do Erro (Por que a resposta precisa de ajuste?):
              </Text>
              <View style={styles.categoryGrid}>
                {ERROR_CATEGORIES.map((cat) => {
                  const selected = errorCategory === cat;
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[
                        styles.categoryChip,
                        selected && styles.categoryChipSelected,
                      ]}
                      onPress={() => setErrorCategory(cat)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.categoryChipText,
                          selected && styles.categoryChipTextSelected,
                        ]}
                      >
                        {selected ? '[Selecionado] ' : ''}
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <View style={styles.labelRow}>
                <Text style={styles.fieldLabel}>
                  3. Sua Correção (Resposta Correta):
                </Text>
                <View style={styles.quickActionRow}>
                  <TouchableOpacity
                    onPress={() => setCorrectedAnswer('')}
                    style={styles.miniActionBtn}
                  >
                    <Text style={styles.miniActionText}>Limpar texto</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      setCorrectedAnswer(
                        targetMessage.originalAiAnswer || targetMessage.answer || ''
                      )
                    }
                    style={styles.miniActionBtn}
                  >
                    <Text style={styles.miniActionText}>Usar texto da IA</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <TextInput
                style={styles.answerInput}
                value={correctedAnswer}
                onChangeText={(t) => {
                  setCorrectedAnswer(t);
                  if (validationError) setValidationError('');
                }}
                placeholder="Escreva aqui a resposta correta que o Tutor deve apresentar e memorizar..."
                multiline
                textAlignVertical="top"
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>
                4. Fonte / Referência da sua Correção (Explicabilidade):
              </Text>
              <TextInput
                style={styles.sourceInput}
                value={studentSource}
                onChangeText={setStudentSource}
                placeholder="Ex: Livro Barbosa e Silva (2010), Notas de Aula do Professor..."
              />
            </View>

            {!!validationError && (
              <View style={styles.validationBanner}>
                <Text style={styles.validationBannerText}>
                  Atenção: {validationError}
                </Text>
              </View>
            )}

            <View style={styles.persistenceInfoBox}>
              <Text style={styles.persistenceInfoText}>
                <Text style={styles.boldText}>Persistência Local Ativa:</Text> Ao salvar, esta correção atualizará a resposta imediatamente no chat e ficará gravada no armazenamento local (AsyncStorage). Se você perguntar novamente sobre este tema, o Tutor usará sua correção como fonte prioritária.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            {targetMessage.isCorrected && (
              <TouchableOpacity
                style={styles.revertBtn}
                onPress={() => onRevertCorrection(targetMessage.id)}
              >
                <Text style={styles.revertBtnText}>Restaurar IA Original</Text>
              </TouchableOpacity>
            )}

            <View style={styles.footerRightBtns}>
              <TouchableOpacity style={styles.cancelBtn} onPress={onClose}>
                <Text style={styles.cancelBtnText}>Cancelar</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.saveBtn}
                onPress={handleConfirmSave}
              >
                <Text style={styles.saveBtnText}>Salvar Correção</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    justifyContent: 'center',
    padding: 14,
  },
  modalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '92%',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#EEF2FF',
    borderBottomWidth: 1,
    borderBottomColor: '#C7D2FE',
  },
  headerTextGroup: {
    flex: 1,
    paddingRight: 8,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1E1B4B',
  },
  headerSubtitle: {
    fontSize: 11.5,
    color: '#4338CA',
    marginTop: 2,
    fontWeight: '600',
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E0E7FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#312E81',
  },
  scrollBody: {
    paddingHorizontal: 16,
  },
  scrollContent: {
    paddingVertical: 14,
    gap: 14,
  },
  fieldGroup: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: '#0F172A',
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: 8,
  },
  miniActionBtn: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  miniActionText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#334155',
  },
  questionInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 13.5,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
    minHeight: 44,
  },
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  categoryChip: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#F8FAFC',
  },
  categoryChipSelected: {
    backgroundColor: '#4F46E5',
    borderColor: '#4338CA',
  },
  categoryChipText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#334155',
  },
  categoryChipTextSelected: {
    color: '#FFFFFF',
  },
  answerInput: {
    borderWidth: 1.5,
    borderColor: '#6366F1',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#0F172A',
    backgroundColor: '#FFFFFF',
    minHeight: 115,
    lineHeight: 20,
  },
  sourceInput: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0F172A',
    backgroundColor: '#F8FAFC',
  },
  validationBanner: {
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FCA5A5',
    borderRadius: 8,
    padding: 10,
  },
  validationBannerText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#991B1B',
  },
  persistenceInfoBox: {
    backgroundColor: '#F0FDF4',
    borderWidth: 1,
    borderColor: '#BBF7D0',
    borderRadius: 8,
    padding: 10,
  },
  persistenceInfoText: {
    fontSize: 12,
    color: '#166534',
    lineHeight: 17,
  },
  boldText: {
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  revertBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  revertBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#475569',
  },
  footerRightBtns: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginLeft: 'auto',
  },
  cancelBtn: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  saveBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    backgroundColor: '#4F46E5',
  },
  saveBtnText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
