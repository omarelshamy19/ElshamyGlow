import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, SafeAreaView, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useLanguage } from '../context/LanguageContext';
import { login, register } from '../api';
import { t } from '../i18n';

const API_URL = 'https://elshamyglow.vercel.app/api';

export default function AuthScreen({ navigation }) {
  const { lang } = useLanguage();
  const isRtl = lang === 'ar';
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const data = isLogin
        ? await login({ email, password })
        : await register({ name, email, password, phone });
      const { token, user } = data.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('user', JSON.stringify(user));
      if (isLogin) {
        navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
      } else {
        const code = data.data.verification_code;
        navigation.navigate('Verify', { token, code });
      }
    } catch (err) {
      Alert.alert('', err.response?.data?.error || err.message);
    } finally { setLoading(false); }
  };

  // Google login removed - will be added in a future update

  return (
    <SafeAreaView style={styles.container}>
      <Text style={[styles.title, isRtl && { textAlign: 'right' }]}>
        {isLogin ? t('login', lang) : t('register', lang)}
      </Text>

      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, isLogin && styles.tabActive]}
          onPress={() => setIsLogin(true)}
        >
          <Text style={[styles.tabText, isLogin && styles.tabTextActive]}>
            {t('login', lang)}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, !isLogin && styles.tabActive]}
          onPress={() => setIsLogin(false)}
        >
          <Text style={[styles.tabText, !isLogin && styles.tabTextActive]}>
            {t('register', lang)}
          </Text>
        </TouchableOpacity>
      </View>

      {!isLogin && (
        <TextInput
          style={[styles.input, isRtl && { textAlign: 'right' }]}
          placeholder={t('name', lang)}
          value={name}
          onChangeText={setName}
        />
      )}
      <TextInput
        style={[styles.input, isRtl && { textAlign: 'right' }]}
        placeholder={t('email', lang)}
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={[styles.input, isRtl && { textAlign: 'right' }]}
        placeholder={t('password', lang)}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {!isLogin && (
        <TextInput
          style={[styles.input, isRtl && { textAlign: 'right' }]}
          placeholder={t('phone', lang)}
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
        />
      )}

      <TouchableOpacity style={styles.btn} onPress={handleSubmit} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>
            {isLogin ? t('login', lang) : t('register', lang)}
          </Text>
        )}
      </TouchableOpacity>

      <View style={styles.divider}>
        <View style={styles.dividerLine} />
        <Text style={styles.dividerText}>{lang === 'ar' ? 'أو' : 'or'}</Text>
        <View style={styles.dividerLine} />
      </View>

      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Text style={{ color: '#999', fontSize: 13 }}>
          {lang === 'ar' ? 'تسجيل الدخول عبر Google قريباً' : 'Google login coming soon'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 24, justifyContent: 'center' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#333', marginBottom: 24 },
  tabs: { flexDirection: 'row', marginBottom: 24 },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: '#eee',
  },
  tabActive: { borderBottomColor: '#FF6B9D' },
  tabText: { fontSize: 16, color: '#999', fontWeight: '600' },
  tabTextActive: { color: '#FF6B9D' },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  btn: {
    backgroundColor: '#FF6B9D',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
  divider: {
    flexDirection: 'row', alignItems: 'center', marginVertical: 20,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: '#eee' },
  dividerText: { marginHorizontal: 12, color: '#999', fontSize: 14 },
  googleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ddd',
    backgroundColor: '#fff',
  },
  googleIcon: {
    fontSize: 20,
    fontWeight: '800',
    color: '#4285F4',
    marginRight: 10,
    width: 24,
    textAlign: 'center',
  },
  googleBtnText: { fontSize: 16, fontWeight: '600', color: '#555' },
});
