import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';
import { t } from '../i18n';

const API_URL = 'https://elshamyglow.vercel.app/api';

export default function VerifyScreen({ route, navigation }) {
  const { lang } = useLanguage();
  const isRtl = lang === 'ar';
  const token = route.params?.token;
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const inputRef = useRef();

  useEffect(() => {
    sendCode();
  }, []);

  const sendCode = async () => {
    try {
      const res = await fetch(API_URL + '/auth/send-verification', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }
      });
      const data = await res.json();
      if (data.code && !__DEV__) console.log('Verification code:', data.code);
      setSent(true);
    } catch(e) { setError(e.message); }
  };

  const verify = async () => {
    if (code.length !== 6) { setError(lang === 'ar' ? 'أدخل الكود الكامل' : 'Enter full code'); return; }
    setLoading(true); setError('');
    try {
      const res = await fetch(API_URL + '/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      const userStr = await AsyncStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        user.email_verified = 1;
        await AsyncStorage.setItem('user', JSON.stringify(user));
      }
      Alert.alert('', lang === 'ar' ? 'تم التحقق من الإيميل ✓' : 'Email verified ✓', [
        { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Main' }] }) }
      ]);
    } catch(e) { setError(e.message); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={[styles.title, isRtl && { textAlign: 'right' }]}>
        {lang === 'ar' ? 'تحقق من بريدك' : 'Verify Email'}
      </Text>
      <Text style={[styles.sub, isRtl && { textAlign: 'right' }]}>
        {lang === 'ar' ? 'أرسلنا كود من 6 أرقام إلى بريدك الإلكتروني' : 'We sent a 6-digit code to your email'}
      </Text>

      <TextInput
        ref={inputRef}
        style={[styles.input, { textAlign: 'center', fontSize: 28, letterSpacing: 12, fontFamily: 'monospace' }]}
        value={code}
        onChangeText={t => { setCode(t.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="000000"
        autoFocus
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity style={styles.btn} onPress={verify} disabled={loading}>
        {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnText}>{lang === 'ar' ? 'تحقق' : 'Verify'}</Text>}
      </TouchableOpacity>

      <TouchableOpacity style={styles.resendBtn} onPress={sendCode} disabled={!sent}>
        <Text style={styles.resendText}>{lang === 'ar' ? 'إعادة إرسال الكود' : 'Resend Code'}</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 8 },
  sub: { fontSize: 15, color: '#888', marginBottom: 32 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 12,
    padding: 16, fontSize: 28, marginBottom: 8,
  },
  error: { color: '#ef4444', fontSize: 14, marginBottom: 12, textAlign: 'center' },
  btn: {
    backgroundColor: '#FF6B9D', padding: 16, borderRadius: 12,
    alignItems: 'center', marginTop: 16,
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  resendBtn: { padding: 16, alignItems: 'center', marginTop: 8 },
  resendText: { color: '#FF6B9D', fontSize: 15, fontWeight: '600' },
});
