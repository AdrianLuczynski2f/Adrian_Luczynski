import React, { useState, useEffect } from 'react';
import { Text, View, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Card, Button, Title, Paragraph, Divider, ProgressBar, List } from 'react-native-paper';

export default function App() {
  // --- STAN APLIKACJI ---
  const [view, setView] = useState('menu'); // menu, setup, quiz, results
  const [analysisSets, setAnalysisSets] = useState([]);
  const [currentSet, setCurrentSet] = useState(null);
  
  // Pola formularza nowego badania
  const [newName, setNewName] = useState('');
  const [newQuestion, setNewQuestion] = useState('Który czynnik jest ważniejszy?');
  const [newFactors, setNewFactors] = useState('');

  // Ładowanie danych przy starcie
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const saved = await AsyncStorage.getItem('pair_comparison_data');
      if (saved) setAnalysisSets(JSON.parse(saved));
    } catch (e) { console.error(e); }
  };

  const saveData = async (updatedSets) => {
    try {
      await AsyncStorage.setItem('pair_comparison_data', JSON.stringify(updatedSets));
      setAnalysisSets(updatedSets);
    } catch (e) { console.error(e); }
  };

  // --- LOGIKA TWORZENIA PAR ---
  const startNewAnalysis = () => {
    const factorLabels = newFactors.split('\n').filter(f => f.trim() !== '');
    if (factorLabels.length < 2) {
      alert('Podaj przynajmniej 2 czynniki (każdy w nowej linii)');
      return;
    }

    const factors = factorLabels.map((label, index) => ({
      id: Math.random().toString(36).substr(2, 9),
      label: label.trim(),
      order_index: index
    }));

    const pairs = [];
    let pairOrder = 0;
    for (let i = 0; i < factors.length; i++) {
      for (let j = i + 1; j < factors.length; j++) {
        pairs.push({
          id: `pair_${pairOrder}`,
          factor_a_id: factors[i].id,
          factor_b_id: factors[j].id,
          pair_order: pairOrder++,
          answer: null, // 'a', 'b', 'equal'
          points_a: 0,
          points_b: 0
        });
      }
    }

    const newSet = {
      id: Date.now().toString(),
      name: newName || 'Bez nazwy',
      criterion_question: newQuestion,
      factors: factors,
      pairs: pairs,
      status: 'in_progress',
      created_at: new Date().toISOString()
    };

    const updated = [...analysisSets, newSet];
    saveData(updated);
    setCurrentSet(newSet);
    setView('quiz');
  };

  // --- LOGIKA ODPOWIEDZI ---
  const handleAnswer = (pairId, choice) => {
    const updatedSet = { ...currentSet };
    const pairIndex = updatedSet.pairs.findIndex(p => p.id === pairId);
    
    let pa = 0, pb = 0;
    if (choice === 'a') pa = 2;
    else if (choice === 'b') pb = 2;
    else if (choice === 'equal') { pa = 1; pb = 1; }

    updatedSet.pairs[pairIndex] = {
      ...updatedSet.pairs[pairIndex],
      answer: choice,
      points_a: pa,
      points_b: pb,
      answered_at: new Date().toISOString()
    };

    // Sprawdź czy to koniec
    const allAnswered = updatedSet.pairs.every(p => p.answer !== null);
    if (allAnswered) updatedSet.status = 'completed';

    setCurrentSet(updatedSet);
    
    // Zapisz w głównej liście
    const updatedSets = analysisSets.map(s => s.id === updatedSet.id ? updatedSet : s);
    saveData(updatedSets);
  };

  // --- WIDOKI ---

  if (view === 'menu') {
    return (
      <ScrollView style={styles.container}>
        <Title style={styles.title}>Moje Badania</Title>
        <Button mode="contained" onPress={() => setView('setup')} style={styles.btn}>+ Nowe badanie</Button>
        {analysisSets.map(set => (
          <Card key={set.id} style={styles.card} onPress={() => { setCurrentSet(set); setView(set.status === 'completed' ? 'results' : 'quiz'); }}>
            <Card.Content>
              <Title>{set.name}</Title>
              <Paragraph>Status: {set.status === 'completed' ? 'Ukończone' : 'W trakcie'}</Paragraph>
            </Card.Content>
          </Card>
        ))}
      </ScrollView>
    );
  }

  if (view === 'setup') {
    return (
      <ScrollView style={styles.container}>
        <Title>Konfiguracja</Title>
        <TextInput label="Nazwa badania" placeholder="np. Wybór priorytetów" value={newName} onChangeText={setNewName} style={styles.input} />
        <TextInput label="Pytanie" value={newQuestion} onChangeText={setNewQuestion} style={styles.input} />
        <Paragraph>Wpisz czynniki (jeden pod drugim):</Paragraph>
        <TextInput multiline numberOfLines={5} value={newFactors} onChangeText={setNewFactors} style={[styles.input, { height: 120 }]} placeholder="Czynnik A&#10;Czynnik B&#10;Czynnik C" />
        <Button mode="contained" onPress={startNewAnalysis}>Rozpocznij</Button>
        <Button onPress={() => setView('menu')}>Wróć</Button>
      </ScrollView>
    );
  }

  if (view === 'quiz') {
    const nextPair = currentSet.pairs.find(p => p.answer === null);
    
    if (!nextPair) {
      return (
        <View style={styles.container}>
          <Title>Koniec pytań!</Title>
          <Button mode="contained" onPress={() => setView('results')}>Pokaż wyniki</Button>
        </View>
      );
    }

    const factorA = currentSet.factors.find(f => f.id === nextPair.factor_a_id);
    const factorB = currentSet.factors.find(f => f.id === nextPair.factor_b_id);
    const progress = currentSet.pairs.filter(p => p.answer !== null).length / currentSet.pairs.length;

    return (
      <View style={styles.container}>
        <Text>Postęp: {Math.round(progress * 100)}%</Text>
        <ProgressBar progress={progress} style={{ marginBottom: 20 }} />
        <Title style={styles.centerText}>{currentSet.criterion_question}</Title>
        
        <TouchableOpacity style={styles.quizCard} onPress={() => handleAnswer(nextPair.id, 'a')}>
          <Text style={styles.quizText}>{factorA.label}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={[styles.quizCard, { backgroundColor: '#f0f0f0' }]} onPress={() => handleAnswer(nextPair.id, 'equal')}>
          <Text style={[styles.quizText, { color: '#666' }]}>Oba tak samo ważne</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.quizCard} onPress={() => handleAnswer(nextPair.id, 'b')}>
          <Text style={styles.quizText}>{factorB.label}</Text>
        </TouchableOpacity>

        <Button onPress={() => setView('menu')} style={{marginTop: 40}}>Przerwij i zapisz</Button>
      </View>
    );
  }

  if (view === 'results') {
    const results = currentSet.factors.map(f => {
      const ptsA = currentSet.pairs.filter(p => p.factor_a_id === f.id).reduce((sum, p) => sum + p.points_a, 0);
      const ptsB = currentSet.pairs.filter(p => p.factor_b_id === f.id).reduce((sum, p) => sum + p.points_b, 0);
      return { label: f.label, total: ptsA + ptsB };
    }).sort((a, b) => b.total - a.total);

    return (
      <ScrollView style={styles.container}>
        <Title>Wyniki: {currentSet.name}</Title>
        {results.map((res, i) => (
          <List.Item key={i} title={`${i+1}. ${res.label}`} description={`Punkty: ${res.total}`} left={props => <List.Icon {...props} icon="star" />} />
        ))}
        <Button mode="contained" onPress={() => setView('menu')} style={{marginTop: 20}}>Powrót do menu</Button>
      </ScrollView>
    );
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, paddingTop: 50, backgroundColor: '#fff' },
  title: { textAlign: 'center', marginBottom: 20 },
  card: { marginBottom: 10, elevation: 2 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 5, padding: 10, marginBottom: 15 },
  btn: { marginBottom: 20 },
  quizCard: { padding: 25, backgroundColor: '#6200ee', borderRadius: 10, marginVertical: 10, alignItems: 'center' },
  quizText: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  centerText: { textAlign: 'center', marginBottom: 30 }
});