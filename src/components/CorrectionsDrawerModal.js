import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

/**
 * Painel de Memória Local (Persistência Leve via AsyncStorage)
 * Permite inspecionar todas as correções feitas pelo aluno, reenviar uma questão
 * para comprovar que o Tutor aprendeu a correção, ou excluir um registro.
 */
export default function CorrectionsDrawerModal({
  visible,
  corrections = [],
  onClose,
  onTestCorrectionQuestion,
  onDeleteCorrection,
  onClearAllData,
}) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title}>
                Base Local de Correções ({corrections.length})
              </Text>
              <Text style={styles.subtitle}>
                Persistência leve com AsyncStorage - Memória Human-in-the-Loop
              </Text>
            </View>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Fechar</Text>
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.listArea}
            contentContainerStyle={styles.listContent}
          >
            {corrections.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyTitle}>
                  Nenhuma correção registrada ainda
                </Text>
                <Text style={styles.emptyText}>
                  Para testar a persistência e o Design de Erros: faça qualquer pergunta no chat e toque no botão{' '}
                  <Text style={styles.bold}>"Corrigir Resposta"</Text> abaixo da mensagem do Tutor.
                </Text>
              </View>
            ) : (
              corrections.map((item, idx) => (
                <View key={item.id || idx} style={styles.correctionItem}>
                  <View style={styles.itemHeader}>
                    <View style={styles.categoryBadge}>
                      <Text style={styles.categoryBadgeText}>
                        {item.errorCategory || 'Revisão do Aluno'}
                      </Text>
                    </View>
                    <Text style={styles.dateText}>
                      {item.updatedAt
                        ? new Date(item.updatedAt).toLocaleString('pt-BR')
                        : ''}
                    </Text>
                  </View>

                  <Text style={styles.questionText}>
                    <Text style={styles.bold}>Questão:</Text> {item.question}
                  </Text>

                  <View style={styles.correctedBox}>
                    <Text style={styles.correctedLabel}>
                      Resposta Corrigida pelo Aluno:
                    </Text>
                    <Text style={styles.correctedValue}>
                      {item.correctedAnswer}
                    </Text>
                  </View>

                  {!!item.studentSource && (
                    <Text style={styles.sourceText}>
                      Fonte informada: {item.studentSource}
                    </Text>
                  )}

                  <View style={styles.actionsRow}>
                    <TouchableOpacity
                      style={styles.reaskBtn}
                      onPress={() => {
                        onClose();
                        onTestCorrectionQuestion(item.question);
                      }}
                    >
                      <Text style={styles.reaskBtnText}>
                        Perguntar Novamente (Testar Memória)
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.deleteBtn}
                      onPress={() => onDeleteCorrection(item.id)}
                    >
                      <Text style={styles.deleteBtnText}>Remover</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.clearAllBtn}
              onPress={onClearAllData}
            >
              <Text style={styles.clearAllBtnText}>
                Limpar Todo Histórico e Memória
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={styles.doneBtn} onPress={onClose}>
              <Text style={styles.doneBtnText}>Concluir</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    justifyContent: 'center',
    padding: 14,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    maxHeight: '88%',
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
    backgroundColor: '#F8FAFC',
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  title: {
    fontSize: 15.5,
    fontWeight: '800',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 11.5,
    color: '#475569',
    marginTop: 2,
  },
  closeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  listArea: {
    paddingHorizontal: 14,
  },
  listContent: {
    paddingVertical: 14,
    gap: 12,
  },
  emptyBox: {
    padding: 20,
    backgroundColor: '#F8FAFC',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1E293B',
  },
  emptyText: {
    fontSize: 12.5,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 18,
  },
  bold: {
    fontWeight: '700',
  },
  correctionItem: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 12,
    padding: 12,
    gap: 8,
  },
  itemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 4,
  },
  categoryBadge: {
    backgroundColor: '#EEF2FF',
    borderWidth: 1,
    borderColor: '#C7D2FE',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  dateText: {
    fontSize: 11,
    color: '#64748B',
  },
  questionText: {
    fontSize: 13,
    color: '#0F172A',
    lineHeight: 18,
  },
  correctedBox: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#A5B4FC',
    borderRadius: 8,
    padding: 9,
    gap: 3,
  },
  correctedLabel: {
    fontSize: 11.5,
    fontWeight: '700',
    color: '#4F46E5',
  },
  correctedValue: {
    fontSize: 12.5,
    color: '#1E293B',
    lineHeight: 18,
  },
  sourceText: {
    fontSize: 11.5,
    color: '#475569',
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 2,
  },
  reaskBtn: {
    backgroundColor: '#4F46E5',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  reaskBtnText: {
    color: '#FFFFFF',
    fontSize: 11.5,
    fontWeight: '700',
  },
  deleteBtn: {
    backgroundColor: '#FEE2E2',
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
  },
  deleteBtnText: {
    color: '#991B1B',
    fontSize: 11.5,
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#E2E8F0',
    backgroundColor: '#F8FAFC',
  },
  clearAllBtn: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FCA5A5',
    backgroundColor: '#FEF2F2',
  },
  clearAllBtnText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#B91C1C',
  },
  doneBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#0F172A',
  },
  doneBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
