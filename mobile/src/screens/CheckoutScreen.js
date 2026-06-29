import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, Alert, SafeAreaView, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../context/LanguageContext';
import { useCart } from '../context/CartContext';
import { createOrder, validateCoupon } from '../api';
const API_URL = 'https://elshamyglow.vercel.app/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { t } from '../i18n';

export default function CheckoutScreen({ navigation }) {
  const { lang } = useLanguage();
  const { items, total, clearCart } = useCart();
  const isRtl = lang === 'ar';

  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [address, setAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [couponMsg, setCouponMsg] = useState('');
  const [checkingCoupon, setCheckingCoupon] = useState(false);
  const [ordering, setOrdering] = useState(false);

  const finalTotal = appliedCoupon
    ? total - Math.round(total * appliedCoupon.discount_percent / 100)
    : total;

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      setCouponMsg(lang === 'ar' ? 'أدخل كود الخصم' : 'Enter coupon code');
      return;
    }
    setCheckingCoupon(true);
    setCouponMsg('');
    try {
      const res = await validateCoupon({ code: couponCode, order_total: total });
      if (res.data.valid) {
        setAppliedCoupon(res.data);
        setCouponMsg(
          (lang === 'ar'
            ? `✓ خصم ${res.data.discount_percent}% مطبق`
            : `✓ ${res.data.discount_percent}% discount applied`)
          + ` (-${Math.round(total * res.data.discount_percent / 100)} ₪)`
        );
      } else {
        setAppliedCoupon(null);
        setCouponMsg(res.data.error || (lang === 'ar' ? 'كود غير صالح' : 'Invalid code'));
      }
    } catch (err) {
      setCouponMsg(lang === 'ar' ? 'خطأ في التحقق' : 'Validation error');
    } finally { setCheckingCoupon(false); }
  };

  const handleOrder = async () => {
    const userStr = await AsyncStorage.getItem('user');
    let user = userStr ? JSON.parse(userStr) : null;
    if (!user) {
      Alert.alert('', lang === 'ar' ? 'يجب تسجيل الدخول أولاً' : 'Please login first');
      navigation.navigate('Auth');
      return;
    }
    // Get latest email_verified from server
    try {
      const token = await AsyncStorage.getItem('token');
      const profRes = await fetch(API_URL + '/auth/profile', {
        headers: { Authorization: 'Bearer ' + token }
      });
      if (profRes.ok) {
        const prof = await profRes.json();
        user.email_verified = prof.email_verified;
        await AsyncStorage.setItem('user', JSON.stringify(user));
      }
    } catch {}
    if (!user.email_verified) {
      Alert.alert('', lang === 'ar' ? 'يرجى التحقق من بريدك الإلكتروني أولاً' : 'Please verify your email first');
      navigation.navigate('Verify', { token: await AsyncStorage.getItem('token') });
      return;
    }
    if (!address || !phone) {
      Alert.alert('', lang === 'ar' ? 'يرجى ملء العنوان والهاتف' : 'Please fill in address and phone');
      return;
    }
    setOrdering(true);
    try {
      const body = {
        items: items.map((i) => ({
          id: i.id, name_ar: i.name_ar, name_en: i.name_en, price: i.price, qty: i.qty,
        })),
        total: finalTotal,
        payment_method: paymentMethod === 'cod' ? 'cash_on_delivery' : 'card',
        shipping_address: address,
        phone,
        notes,
      };
      if (appliedCoupon) body.coupon_code = couponCode;
      await createOrder(body);
      Alert.alert('', t('orderPlaced', lang), [
        { text: 'OK', onPress: () => { clearCart(); setAppliedCoupon(null); setCouponCode(''); navigation.navigate('Orders'); } },
      ]);
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      if (err.response?.status === 403) {
        // Server says email not verified - update local and redirect
        const userStr = await AsyncStorage.getItem('user');
        if (userStr) {
          const u = JSON.parse(userStr);
          u.email_verified = 0;
          await AsyncStorage.setItem('user', JSON.stringify(u));
        }
        Alert.alert('', lang === 'ar' ? 'يرجى التحقق من بريدك الإلكتروني أولاً' : 'Please verify your email first');
        navigation.navigate('Verify', { token: await AsyncStorage.getItem('token') });
      } else {
        Alert.alert('Error', msg);
      }
    } finally { setOrdering(false); }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView style={[styles.container]}>
        <Text style={[styles.title, isRtl && { textAlign: 'right' }]}>
          {t('checkout', lang)}
        </Text>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && { textAlign: 'right' }]}>
            {t('shippingAddress', lang)}
          </Text>
          <TextInput
            style={[styles.input, isRtl && { textAlign: 'right' }]}
            value={address}
            onChangeText={setAddress}
            placeholder={lang === 'ar' ? 'العنوان' : 'Address'}
          />
          <TextInput
            style={[styles.input, isRtl && { textAlign: 'right' }]}
            value={phone}
            onChangeText={setPhone}
            placeholder={t('phone', lang)}
            keyboardType="phone-pad"
          />
          <TextInput
            style={[styles.input, styles.textArea, isRtl && { textAlign: 'right' }]}
            value={notes}
            onChangeText={setNotes}
            placeholder={t('notes', lang)}
            multiline
          />
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && { textAlign: 'right' }]}>
            {lang === 'ar' ? 'كود الخصم' : 'Coupon'}
          </Text>
          <View style={styles.couponRow}>
            <TextInput
              style={[styles.input, styles.couponInput, isRtl && { textAlign: 'right' }]}
              value={couponCode}
              onChangeText={text => { setCouponCode(text.toUpperCase()); setAppliedCoupon(null); setCouponMsg(''); }}
              placeholder={lang === 'ar' ? 'أدخل الكود' : 'Enter code'}
              autoCapitalize="characters"
            />
            <TouchableOpacity style={styles.couponBtn} onPress={applyCoupon} disabled={checkingCoupon}>
              {checkingCoupon ? (
                <ActivityIndicator size="small" color="#FF6B9D" />
              ) : (
                <Text style={styles.couponBtnText}>{lang === 'ar' ? 'تطبيق' : 'Apply'}</Text>
              )}
            </TouchableOpacity>
          </View>
          {couponMsg ? (
            <Text style={[styles.couponMsg, appliedCoupon ? styles.couponSuccess : styles.couponError]}>
              {couponMsg}
            </Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRtl && { textAlign: 'right' }]}>
            {t('payment', lang)}
          </Text>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'cod' && styles.paymentActive,
            ]}
            onPress={() => setPaymentMethod('cod')}
          >
            <Ionicons
              name={paymentMethod === 'cod' ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color="#FF6B9D"
            />
            <Text style={styles.paymentText}>{t('cashOnDelivery', lang)}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.paymentOption,
              paymentMethod === 'card' && styles.paymentActive,
            ]}
            onPress={() => setPaymentMethod('card')}
          >
            <Ionicons
              name={paymentMethod === 'card' ? 'radio-button-on' : 'radio-button-off'}
              size={20}
              color="#FF6B9D"
            />
            <Text style={styles.paymentText}>{t('cardPayment', lang)}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.totalSection}>
          <Text style={styles.totalLabel}>{t('total', lang)}</Text>
          <Text style={styles.totalValue}>
            {finalTotal.toFixed(2)} ₪
            {appliedCoupon && <Text style={styles.originalPrice}>  {total.toFixed(2)} ₪</Text>}
          </Text>
        </View>

        <TouchableOpacity style={styles.orderBtn} onPress={handleOrder} disabled={ordering}>
          {ordering ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.orderBtnText}>{t('placeOrder', lang)}</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#fff' },
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#333', marginBottom: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: '#666', marginBottom: 12 },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    marginBottom: 12,
  },
  textArea: { height: 80, textAlignVertical: 'top' },
  couponRow: { flexDirection: 'row', gap: 8 },
  couponInput: { flex: 1, marginBottom: 0 },
  couponBtn: {
    paddingHorizontal: 20,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF0F5',
  },
  couponBtnText: { color: '#FF6B9D', fontWeight: '700', fontSize: 14 },
  couponMsg: { fontSize: 13, marginTop: 8 },
  couponSuccess: { color: '#10b981' },
  couponError: { color: '#ef4444' },
  paymentOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
  },
  paymentActive: { borderColor: '#FF6B9D', backgroundColor: '#FFF0F5' },
  paymentText: { marginLeft: 12, fontSize: 16, color: '#333' },
  totalSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 20,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  totalLabel: { fontSize: 20, fontWeight: '600' },
  totalValue: { fontSize: 22, fontWeight: 'bold', color: '#FF6B9D' },
  originalPrice: { fontSize: 14, fontWeight: '400', color: '#999', textDecorationLine: 'line-through' },
  orderBtn: {
    backgroundColor: '#FF6B9D',
    padding: 18,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 30,
  },
  orderBtnText: { color: '#fff', fontSize: 18, fontWeight: '700' },
});
