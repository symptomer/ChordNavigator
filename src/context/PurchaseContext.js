import React, { createContext, useContext, useState, useEffect } from 'react';
import Purchases, { LOG_LEVEL } from 'react-native-purchases';

const PurchaseContext = createContext(null);

// RevenueCat API Key — App Store Connect에서 발급 후 여기에 입력
const RC_API_KEY_IOS = 'appl_DRgqJLXRysIFcMwTWEBCqaImUxh';

// TODO: react-native-purchases가 Expo Go에서 지원 안됨 → EAS Build 필요
// 개발 시 시뮬레이터 빌드: eas build --profile development --platform ios
const IS_DEV = __DEV__;

export function PurchaseProvider({ children }) {
  const [isPremium,      setIsPremium]      = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [monthlyPkg,     setMonthlyPkg]     = useState(null);
  const [lifetimePkg,    setLifetimePkg]    = useState(null);

  useEffect(() => {
    async function init() {
      try {
        if (IS_DEV) Purchases.setLogLevel(LOG_LEVEL.DEBUG);
        await Purchases.configure({ apiKey: RC_API_KEY_IOS });

        // 구독 상태 확인
        const info = await Purchases.getCustomerInfo();
        setIsPremium(info.entitlements.active['premium'] != null);

        // 상품 패키지 로드
        const offerings = await Purchases.getOfferings();
        const current   = offerings.current;
        if (current) {
          const monthly  = current.availablePackages.find(p => p.identifier === '$rc_monthly');
          const lifetime = current.availablePackages.find(p => p.identifier === '$rc_lifetime');
          if (monthly)  setMonthlyPkg(monthly);
          if (lifetime) setLifetimePkg(lifetime);
        }
      } catch (e) {
        console.warn('[RevenueCat] init error:', e.message);
      }
    }
    init();
  }, []);

  function showPaywall() { setPaywallVisible(true); }
  function hidePaywall() { setPaywallVisible(false); }

  async function purchaseMonthly() {
    if (!monthlyPkg) return;
    try {
      const { customerInfo } = await Purchases.purchasePackage(monthlyPkg);
      setIsPremium(customerInfo.entitlements.active['premium'] != null);
      setPaywallVisible(false);
    } catch (e) {
      if (!e.userCancelled) console.warn('[RevenueCat] monthly purchase error:', e.message);
    }
  }

  async function purchaseLifetime() {
    if (!lifetimePkg) return;
    try {
      const { customerInfo } = await Purchases.purchasePackage(lifetimePkg);
      setIsPremium(customerInfo.entitlements.active['premium'] != null);
      setPaywallVisible(false);
    } catch (e) {
      if (!e.userCancelled) console.warn('[RevenueCat] lifetime purchase error:', e.message);
    }
  }

  async function restorePurchases() {
    try {
      const info = await Purchases.restorePurchases();
      const ok   = info.entitlements.active['premium'] != null;
      setIsPremium(ok);
      setPaywallVisible(false);
      return ok;
    } catch (e) {
      console.warn('[RevenueCat] restore error:', e.message);
      return false;
    }
  }

  return (
    <PurchaseContext.Provider value={{
      isPremium,
      paywallVisible, showPaywall, hidePaywall,
      purchaseMonthly, purchaseLifetime, restorePurchases,
      // 가격 표시용 (로드 전엔 기본값)
      monthlyPrice:  monthlyPkg?.product?.priceString  ?? '₩1,900',
      lifetimePrice: lifetimePkg?.product?.priceString ?? '₩8,800',
    }}>
      {children}
    </PurchaseContext.Provider>
  );
}

export const usePurchase = () => useContext(PurchaseContext);
